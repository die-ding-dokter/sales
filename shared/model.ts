import { z } from 'zod';

export const TENANT_ID = 'fa446f15-b4e8-4968-b1c7-00296029852e';
export const roles = ['SalesRep', 'Manager', 'Finance', 'Admin'] as const;
export type Role = typeof roles[number];
export type Actor = { oid: string; tid: string; name: string; roles: Role[] };
export class DomainError extends Error { constructor(public status: number, message: string) { super(message); } }
const boundedText = (n: number) => z.string().trim().min(1).max(n);
export const lineSchema = z.object({
  description: boundedText(200), quantity: z.number().int().min(1).max(1000),
  priceCents: z.number().int().min(0).max(100_000_000),
  costCents: z.number().int().min(0).max(100_000_000)
}).strict();
export const opportunitySchema = z.object({
  title: boundedText(160), customer: boundedText(160),
  email: z.union([z.email(), z.literal('')]), phone: z.string().trim().max(40),
  category: z.enum(['Repairs', 'Hardware', 'Business services', 'Other']),
  nextAction: boundedText(300), dueDate: z.iso.date(),
  lines: z.array(lineSchema).min(1).max(30), notes: z.string().trim().max(2000)
}).strict();
export type OpportunityInput = z.infer<typeof opportunitySchema>;
export type Totals = { netCents: number; costCents: number; gpCents: number; margin: number };
export type Invoice = { reference: string; netCents: number; paidCents: number; dueDate: string; recordedAt: string };
export type QuoteSnapshot = { number: string; revision: number; approvedBy: string; approvedAt: string; lines: OpportunityInput['lines']; netCents: number; taxRate: number };
export type Opportunity = OpportunityInput & {
  id: string; kind: 'opportunity'; tenantId: string; ownerId: string; ownerName: string;
  stage: 'Qualified' | 'Quoted' | 'Accepted' | 'Delivered' | 'Lost';
  quoteStatus: 'Draft' | 'Awaiting approval' | 'Approved' | 'Accepted'; revision: number;
  quotes: QuoteSnapshot[]; acceptanceReference?: string; deliveryReference?: string;
  lostReason?: string; invoice?: Invoice; receiptReferences?: string[]; updatedAt: string; createdAt: string; version: number;
  _etag?: string;
};
export function totals(lines: OpportunityInput['lines']): Totals {
  const netCents = lines.reduce((s, l) => s + l.quantity * l.priceCents, 0);
  const costCents = lines.reduce((s, l) => s + l.quantity * l.costCents, 0);
  return { netCents, costCents, gpCents: netCents - costCents, margin: netCents ? (netCents - costCents) / netCents : 0 };
}
export const hasRole = (a: Actor, ...r: Role[]) => a.roles.some(x => r.includes(x));
export const canSee = (a: Actor, o: Opportunity) => o.tenantId === a.tid && (o.ownerId === a.oid || hasRole(a, 'Admin', 'Manager', 'Finance'));
export const canSell = (a: Actor, o: Opportunity) => canSee(a, o) && (o.ownerId === a.oid || hasRole(a, 'Manager', 'Admin'));
export const commandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('edit'), data: opportunitySchema }).strict(),
  z.object({ action: z.literal('followup'), nextAction: boundedText(300), dueDate: z.iso.date() }).strict(),
  z.object({ action: z.literal('submit') }).strict(),
  z.object({ action: z.literal('revise') }).strict(),
  z.object({ action: z.literal('approve') }).strict(),
  z.object({ action: z.literal('accept'), reference: boundedText(300) }).strict(),
  z.object({ action: z.literal('deliver'), reference: boundedText(300) }).strict(),
  z.object({ action: z.literal('lose'), reason: boundedText(300) }).strict(),
  z.object({ action: z.literal('invoice'), reference: boundedText(100), dueDate: z.iso.date() }).strict(),
  z.object({ action: z.literal('receipt'), amountCents: z.number().int().positive().max(100_000_000), reference: boundedText(100) }).strict()
]);
export type Command = z.infer<typeof commandSchema>;
export function applyCommand(o: Opportunity, actor: Actor, input: unknown, settings: { marginFloor: number; taxRate: number | null }, now = new Date().toISOString()): Opportunity {
  if (!canSee(actor, o)) throw new DomainError(404, 'Opportunity not found.');
  const cmd = commandSchema.parse(input);
  const financial = cmd.action === 'invoice' || cmd.action === 'receipt';
  if (financial ? !hasRole(actor, 'Finance', 'Admin') : !canSell(actor, o)) throw new DomainError(403, 'Your role cannot perform this action.');
  const next = structuredClone(o);
  if (cmd.action === 'edit') {
    if (o.quoteStatus !== 'Draft' || o.stage !== 'Qualified') throw new DomainError(409, 'Revise the quote before editing. Accepted work is locked.');
    Object.assign(next, cmd.data);
  } else if (cmd.action === 'followup') {
    next.nextAction = cmd.nextAction; next.dueDate = cmd.dueDate;
  } else if (cmd.action === 'submit') {
    if (o.quoteStatus !== 'Draft' || o.stage !== 'Qualified' || totals(o.lines).netCents <= 0) throw new DomainError(409, 'A positive draft quotation is required.');
    next.quoteStatus = 'Awaiting approval';
  } else if (cmd.action === 'revise') {
    if (!['Qualified', 'Quoted'].includes(o.stage) || o.quoteStatus === 'Draft') throw new DomainError(409, 'Only a submitted or approved, unaccepted quote can be revised.');
    if (o.quotes.length >= 20) throw new DomainError(409, 'Revision limit reached. Contact your manager.');
    next.quoteStatus = 'Draft'; next.stage = 'Qualified'; next.revision += 1;
  } else if (cmd.action === 'approve') {
    if (!hasRole(actor, 'Manager', 'Admin')) throw new DomainError(403, 'Manager approval is required.');
    if (o.quoteStatus !== 'Awaiting approval' || o.stage !== 'Qualified') throw new DomainError(409, 'An open opportunity submitted for approval is required.');
    if (settings.taxRate === null) throw new DomainError(409, 'Finance must configure the tax treatment before quotes can be approved.');
    const t = totals(o.lines);
    if (t.margin < settings.marginFloor) throw new DomainError(409, 'Margin is below the approved floor. Revise the offer.');
    next.quotes.push({ number: `DDD-Q-${o.createdAt.slice(0, 4)}-${o.id.slice(0, 8).toUpperCase()}`, revision: o.revision, approvedBy: actor.name, approvedAt: now, lines: structuredClone(o.lines), netCents: t.netCents, taxRate: settings.taxRate });
    next.quoteStatus = 'Approved'; next.stage = 'Quoted';
  } else if (cmd.action === 'accept') {
    if (o.quoteStatus !== 'Approved' || o.stage !== 'Quoted') throw new DomainError(409, 'An approved quote is required.');
    next.quoteStatus = 'Accepted'; next.stage = 'Accepted'; next.acceptanceReference = cmd.reference;
  } else if (cmd.action === 'deliver') {
    if (o.stage !== 'Accepted') throw new DomainError(409, 'Written customer acceptance is required first.');
    next.stage = 'Delivered'; next.deliveryReference = cmd.reference;
  } else if (cmd.action === 'lose') {
    if (!['Qualified', 'Quoted'].includes(o.stage)) throw new DomainError(409, 'Accepted or closed work cannot be marked lost.');
    next.stage = 'Lost'; next.lostReason = cmd.reason;
  } else if (cmd.action === 'invoice') {
    if (!['Accepted', 'Delivered'].includes(o.stage) || o.invoice) throw new DomainError(409, 'An accepted, uninvoiced order is required.');
    next.invoice = { reference: cmd.reference, dueDate: cmd.dueDate, netCents: totals(o.lines).netCents, paidCents: 0, recordedAt: now };
  } else if (cmd.action === 'receipt') {
    if (!next.invoice) throw new DomainError(409, 'Record the accounting invoice first.');
    const reference = cmd.reference.toLowerCase();
    if (next.receiptReferences?.includes(reference)) throw new DomainError(409, 'This receipt reference has already been recorded.');
    if (next.invoice.paidCents + cmd.amountCents > next.invoice.netCents) throw new DomainError(409, 'Receipt exceeds the unpaid net balance.');
    next.invoice.paidCents += cmd.amountCents;
    next.receiptReferences = [...(next.receiptReferences ?? []), reference];
  }
  next.updatedAt = now; next.version += 1;
  return next;
}
export function createOpportunity(input: unknown, actor: Actor, id: string, now = new Date().toISOString()): Opportunity {
  if (!hasRole(actor, 'SalesRep', 'Manager', 'Admin')) throw new DomainError(403, 'Sales access is required.');
  const data = opportunitySchema.parse(input);
  return { ...data, id, kind: 'opportunity', tenantId: actor.tid, ownerId: actor.oid, ownerName: actor.name, stage: 'Qualified', quoteStatus: 'Draft', revision: 1, quotes: [], createdAt: now, updatedAt: now, version: 1 };
}
export function csvCell(value: unknown) {
  let s = String(value ?? '');
  if (typeof value !== 'number' && /^[\s]*[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
