import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from 'jose';
import { TENANT_ID, Actor, createOpportunity, applyCommand, totals, csvCell, canSee } from '../shared/model.js';
import { validateClaims, verifyAccessToken } from '../api/src/auth.js';
const rep: Actor = { oid: '11111111-1111-4111-8111-111111111111', tid: TENANT_ID, name: 'Rep', roles: ['SalesRep'] };
const manager: Actor = { ...rep, oid: '22222222-2222-4222-8222-222222222222', name: 'Manager', roles: ['Manager'] };
const finance: Actor = { ...manager, name: 'Finance', roles: ['Finance'] };
const data = { title: 'Repair', customer: 'Example', email: '', phone: '', category: 'Repairs', nextAction: 'Confirm scope', dueDate: '2026-12-01', notes: 'Parts included', lines: [{ description: 'Repair service', quantity: 2, priceCents: 10000, costCents: 6500 }] };
const settings = { marginFloor: .2, taxRate: 0 };
const base = () => createOpportunity(data, rep, '33333333-3333-4333-8333-333333333333');
test('tenant and record ownership isolate representatives', () => {
  assert.equal(canSee({ ...rep, oid: manager.oid }, base()), false);
  assert.equal(canSee({ ...manager, tid: 'another-tenant' }, base()), false);
  assert.throws(() => applyCommand(base(), { ...rep, oid: manager.oid }, { action: 'submit' }, settings), /not found/);
});
test('approval, acceptance, completion and finance follow controlled transitions', () => {
  let o = base();
  assert.throws(() => applyCommand(o, rep, { action: 'deliver', reference: 'X' }, settings), /acceptance/);
  o = applyCommand(o, rep, { action: 'submit' }, settings);
  assert.throws(() => applyCommand(o, rep, { action: 'approve' }, settings), /Manager/);
  assert.throws(() => applyCommand(o, manager, { action: 'approve' }, { ...settings, taxRate: null }), /tax/);
  o = applyCommand(o, manager, { action: 'approve' }, settings);
  assert.equal(o.quotes.length, 1);
  o = applyCommand(o, rep, { action: 'accept', reference: 'Customer PO 42' }, settings);
  assert.throws(() => applyCommand(o, rep, { action: 'edit', data }, settings), /locked/);
  assert.throws(() => applyCommand(o, rep, { action: 'invoice', reference: 'INV42', dueDate: '2026-12-02' }, settings), /role/);
  o = applyCommand(o, finance, { action: 'invoice', reference: 'INV42', dueDate: '2026-12-02' }, settings);
  o = applyCommand(o, finance, { action: 'receipt', reference: 'BANK42', amountCents: 15000 }, settings);
  assert.equal(o.invoice?.paidCents, 15000);
  assert.throws(() => applyCommand(o, finance, { action: 'receipt', reference: 'bank42', amountCents: 1000 }, settings), /already/);
  o = applyCommand(o, rep, { action: 'followup', nextAction: 'Arrange completion', dueDate: '2026-12-05' }, settings);
  assert.equal(o.nextAction, 'Arrange completion');
  assert.throws(() => applyCommand(o, finance, { action: 'receipt', reference: 'BANK43', amountCents: 10000 }, settings), /exceeds/);
  o = applyCommand(o, rep, { action: 'deliver', reference: 'Signed completion 42' }, settings);
  assert.equal(o.stage, 'Delivered');
});
test('margin floors and immutable quotation history survive revisions', () => {
  let o = applyCommand(base(), rep, { action: 'submit' }, settings);
  assert.throws(() => applyCommand(o, manager, { action: 'approve' }, { ...settings, marginFloor: .5 }), /Margin/);
  o = applyCommand(o, manager, { action: 'approve' }, settings);
  o = applyCommand(o, rep, { action: 'revise' }, settings);
  o = applyCommand(o, rep, { action: 'edit', data: { ...data, lines: [{ ...data.lines[0], priceCents: 12000 }] } }, settings);
  assert.equal(o.revision, 2); assert.equal(o.quotes[0].netCents, 20000); assert.equal(totals(o.lines).netCents, 24000);
});
test('validation rejects hidden fields, invalid dates, negatives and fractional cents', () => {
  assert.throws(() => createOpportunity({ ...data, ownerId: 'forged' }, rep, 'id'));
  assert.throws(() => createOpportunity({ ...data, dueDate: '2026-02-31' }, rep, 'id'));
  assert.throws(() => createOpportunity({ ...data, lines: [{ ...data.lines[0], priceCents: -.01 }] }, rep, 'id'));
  assert.throws(() => createOpportunity({ ...data, lines: [{ ...data.lines[0], priceCents: 1.2 }] }, rep, 'id'));
});
test('spreadsheet exports neutralise formula injection and preserve quotes', () => {
  assert.equal(csvCell('=HYPERLINK("evil")'), '"\'=HYPERLINK(""evil"")"');
  assert.equal(csvCell('  +1'), '"\'  +1"'); assert.equal(csvCell('Normal, value'), '"Normal, value"');
});
test('claims reject wrong tenant, client, scope and unassigned roles', () => {
  const p = { tid: TENANT_ID, ver: '2.0', oid: rep.oid, azp: 'spa', scp: 'access_as_user', roles: ['SalesRep'] };
  assert.equal(validateClaims(p, TENANT_ID, 'spa').roles[0], 'SalesRep');
  for (const patch of [{ tid: 'wrong' }, { azp: 'wrong' }, { scp: 'User.Read' }, { roles: [] }, { ver: '1.0' }]) assert.throws(() => validateClaims({ ...p, ...patch }, TENANT_ID, 'spa'));
});
test('JWT signature, audience, issuer and expiry are enforced before claims', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey); jwk.kid = 'test'; jwk.alg = 'RS256';
  const keys = createLocalJWKSet({ keys: [jwk] });
  const make = (audience: string, expiry: string | number = '1h') => new SignJWT({ tid: TENANT_ID, oid: rep.oid, ver: '2.0', azp: 'spa', scp: 'access_as_user', roles: ['SalesRep'] }).setProtectedHeader({ alg: 'RS256', kid: 'test' }).setIssuer(`https://login.microsoftonline.com/${TENANT_ID}/v2.0`).setAudience(audience).setIssuedAt().setNotBefore('0s').setExpirationTime(expiry).sign(privateKey);
  const cfg = { tenant: TENANT_ID, audience: 'api', client: 'spa' };
  assert.equal((await verifyAccessToken(await make('api'), cfg, keys)).oid, rep.oid);
  await assert.rejects(() => verifyAccessToken('not.a.jwt', cfg, keys));
  await assert.rejects(async () => verifyAccessToken(await make('other-api'), cfg, keys));
  await assert.rejects(async () => verifyAccessToken(await make('api', Math.floor(Date.now() / 1000) - 120), cfg, keys));
});
