import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { CosmosClient, Container, OperationInput, Resource } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import { randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { Actor, Opportunity, TENANT_ID, applyCommand, canSee, createOpportunity, DomainError, hasRole } from '../../shared/model.js';
import { verifyAccessToken } from './auth.js';

const allowedOrigin = process.env.ALLOWED_ORIGIN ?? 'https://sales.diedingdokter.co.za';
const authSettings = { tenant: process.env.ENTRA_TENANT_ID ?? TENANT_ID, audience: process.env.ENTRA_API_CLIENT_ID ?? '', client: process.env.ENTRA_SPA_CLIENT_ID ?? '' };
let container: Container | undefined;
function store() {
  if (!process.env.COSMOS_ENDPOINT) throw new DomainError(503, 'The sales data store is not configured.');
  container ??= new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, aadCredentials: new DefaultAzureCredential() }).database(process.env.COSMOS_DATABASE ?? 'sales').container(process.env.COSMOS_CONTAINER ?? 'records');
  return container;
}
function commercialSettings() {
  // Missing commercial controls fail closed; no production margin floor is inferred.
  const rawMargin = process.env.MARGIN_FLOOR;
  const marginFloor = Number(rawMargin);
  const rawTax = process.env.SALES_TAX_RATE;
  const taxRate = rawTax === undefined || rawTax.trim() === '' ? null : Number(rawTax);
  if (!rawMargin || !Number.isFinite(marginFloor) || marginFloor < 0 || marginFloor > 1 || (taxRate !== null && (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 1))) throw new DomainError(503, 'Finance must configure valid commercial controls.');
  return { marginFloor, taxRate };
}
const json = (status: number, jsonBody: unknown): HttpResponseInit => ({ status, jsonBody, headers: { 'Access-Control-Allow-Origin': allowedOrigin, Vary: 'Origin', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'", 'Referrer-Policy': 'no-referrer' } });
async function body(req: HttpRequest) {
  if (!(req.headers.get('content-type') ?? '').startsWith('application/json')) throw new DomainError(415, 'Use application/json.');
  if (Number(req.headers.get('content-length') ?? 0) > 65536) throw new DomainError(413, 'The request is too large.');
  const text = await req.text();
  if (Buffer.byteLength(text) > 65536) throw new DomainError(413, 'The request is too large.');
  try { return JSON.parse(text); } catch { throw new DomainError(400, 'The request is not valid JSON.'); }
}
async function read(id: string, actor: Actor) {
  if (!z.uuid().safeParse(id).success) throw new DomainError(404, 'Opportunity not found.');
  try {
    const { resource } = await store().item(id, actor.tid).read<Opportunity>();
    if (!resource || resource.kind !== 'opportunity' || !canSee(actor, resource)) throw new DomainError(404, 'Opportunity not found.');
    return resource;
  } catch (e) { if ((e as { code?: number }).code === 404) throw new DomainError(404, 'Opportunity not found.'); throw e; }
}
function safeRecord(o: Opportunity & Partial<Resource> & { _attachments?: string }) {
  const { _etag, _rid, _self, _ts, _attachments, ...clean } = o;
  return clean;
}
async function transaction(operations: OperationInput[], actor: Actor) {
  let result;
  try { result = await store().items.batch(operations, actor.tid); }
  catch (e) {
    const cause = (e as { cause?: { code?: number } }).cause;
    const code = cause?.code ?? (e as { code?: number }).code;
    if (code === 409 || code === 412) throw new DomainError(409, 'The record or accounting reference changed. Refresh and check the original invoice before retrying.');
    if (code === 429) throw new DomainError(429, 'The workspace is busy. Wait briefly, then refresh before retrying.');
    throw e;
  }
  if (result.code === 409 || result.code === 412 || result.result?.some(r => r.statusCode === 409 || r.statusCode === 412)) throw new DomainError(409, 'Another user changed this record. Refresh the workspace and try again.');
  if ((result.code ?? 500) >= 400 || result.result?.some(r => r.statusCode >= 400)) throw new DomainError(503, 'The change could not be saved. Refresh to check the record before retrying.');
}
async function handler(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const requestId = randomUUID();
  try {
    const origin = req.headers.get('origin');
    if (origin && origin !== allowedOrigin) throw new DomainError(403, 'This origin is not permitted.');
    if (req.method === 'OPTIONS') return { status: 204, headers: { 'Access-Control-Allow-Origin': allowedOrigin, 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Authorization,Content-Type', 'Access-Control-Max-Age': '600', Vary: 'Origin' } };
    const bearer = req.headers.get('authorization');
    if (!bearer?.startsWith('Bearer ') || bearer.length > 20000) throw new DomainError(401, 'Sign in with your Die Ding Dokter work account.');
    let actor: Actor;
    try { actor = await verifyAccessToken(bearer.slice(7), authSettings); }
    catch (e) { if (e instanceof DomainError) throw e; throw new DomainError(401, 'Your session could not be verified. Sign in again.'); }
    const path = req.params.path ?? '';
    if (path === 'session' && req.method === 'GET') return json(200, { actor, settings: commercialSettings() });
    if (path === 'opportunities' && req.method === 'GET') {
      const cursor = req.query.get('cursor') ?? undefined;
      if (cursor && cursor.length > 16000) throw new DomainError(400, 'Invalid page cursor.');
      const privileged = hasRole(actor, 'Admin', 'Manager', 'Finance');
      const parameters = [{ name: '@tenant', value: actor.tid }, ...(!privileged ? [{ name: '@owner', value: actor.oid }] : [])];
      const query = `SELECT * FROM c WHERE c.kind = 'opportunity' AND c.tenantId = @tenant${privileged ? '' : ' AND c.ownerId = @owner'} ORDER BY c.updatedAt DESC`;
      const result = await store().items.query<Opportunity>({ query, parameters }, { partitionKey: actor.tid, maxItemCount: 100, continuationToken: cursor }).fetchNext();
      return json(200, { items: result.resources.map(safeRecord), nextCursor: result.continuationToken ?? null });
    }
    if (path === 'opportunities' && req.method === 'POST') {
      const o = createOpportunity(await body(req), actor, randomUUID());
      await transaction([{ operationType: 'Create', resourceBody: o }, { operationType: 'Create', resourceBody: { id: randomUUID(), tenantId: actor.tid, kind: 'audit', opportunityId: o.id, action: 'create', actorId: actor.oid, actorName: actor.name, createdAt: o.createdAt, version: o.version, snapshot: o } }], actor);
      return json(201, o);
    }
    const match = /^opportunities\/([^/]+)\/(commands|audit)$/.exec(path);
    if (!match) throw new DomainError(404, 'Endpoint not found.');
    const existing = await read(match[1], actor);
    if (match[2] === 'audit' && req.method === 'GET') {
      const cursor = req.query.get('cursor') ?? undefined;
      if (cursor && cursor.length > 16000) throw new DomainError(400, 'Invalid page cursor.');
      const result = await store().items.query({ query: 'SELECT c.action, c.actorName, c.createdAt, c.version FROM c WHERE c.tenantId = @tenant AND c.kind = @kind AND c.opportunityId = @id ORDER BY c.createdAt DESC', parameters: [{ name: '@tenant', value: actor.tid }, { name: '@kind', value: 'audit' }, { name: '@id', value: existing.id }] }, { partitionKey: actor.tid, maxItemCount: 100, continuationToken: cursor }).fetchNext();
      return json(200, { items: result.resources, nextCursor: result.continuationToken ?? null });
    }
    if (match[2] !== 'commands' || req.method !== 'POST') throw new DomainError(405, 'Method not allowed.');
    const input = z.object({ version: z.number().int().positive(), command: z.unknown() }).strict().parse(await body(req));
    if (input.version !== existing.version) throw new DomainError(409, 'This record changed. Refresh before saving.');
    const next = applyCommand(existing, actor, input.command, commercialSettings());
    const clean = safeRecord(next);
    const command = input.command as { action: string; reference?: string; amountCents?: number };
    await transaction([
      ...(command.action === 'invoice' ? [{ operationType: 'Create' as const, resourceBody: { id: `invoice-ref-${createHash('sha256').update(command.reference!.trim().toLowerCase()).digest('hex')}`, tenantId: actor.tid, kind: 'invoice-reference', opportunityId: existing.id } }] : []),
      { operationType: 'Replace', id: existing.id, resourceBody: clean, ifMatch: existing._etag },
      { operationType: 'Create', resourceBody: { id: randomUUID(), tenantId: actor.tid, kind: 'audit', opportunityId: existing.id, action: command.action, actorId: actor.oid, actorName: actor.name, createdAt: next.updatedAt, version: next.version, receiptReference: command.action === 'receipt' ? command.reference ?? '' : '', receiptAmountCents: command.action === 'receipt' ? command.amountCents ?? 0 : 0, snapshot: clean } }
    ], actor);
    return json(200, clean);
  } catch (e) {
    if (e instanceof DomainError) return json(e.status, { error: e.message, requestId });
    if (e instanceof z.ZodError) return json(400, { error: 'Check the required fields, dates and amounts.', requestId });
    const code = (e as { code?: number }).code;
    if (code === 429) return { ...json(429, { error: 'The workspace is busy. Wait briefly, then refresh before retrying.', requestId }), headers: { ...json(429, {}).headers, 'Retry-After': '5' } };
    // Correlation only: never log tokens, request bodies or customer details.
    ctx.error(`Sales API request failed: ${requestId}`);
    return json(503, { error: 'The workspace could not complete the request. Refresh to check the result before retrying.', requestId });
  }
}
app.http('sales', { methods: ['GET', 'POST', 'OPTIONS'], authLevel: 'anonymous', route: '{*path}', handler });
