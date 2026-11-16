import { Actor, createOpportunity, Opportunity, TENANT_ID } from '../shared/model';
export const demoActor: Actor = { oid: 'demo-manager', tid: TENANT_ID, name: 'Sample manager', roles: ['Admin'] };
export function sampleData(): Opportunity[] {
  const inputs = [
    ['Business laptop refresh', 'Sample Business A', 'Hardware', 12500, 9800, 'Confirm the required specifications'],
    ['Workshop repair', 'Sample Customer B', 'Repairs', 1850, 950, 'Confirm the repair scope'],
    ['Office equipment setup', 'Sample Business C', 'Business services', 4200, 2600, 'Arrange the installation date'],
    ['Replacement workstation', 'Sample Business D', 'Hardware', 8900, 6500, 'Follow up on the quotation']
  ];
  return inputs.map((v, i) => {
    const o = createOpportunity({ title: v[0], customer: v[1], email: '', phone: '', category: v[2], nextAction: v[5], dueDate: new Date(Date.now() + i * 86400000).toISOString().slice(0, 10), notes: 'Fictional sample record. No customer data.', lines: [{ description: v[0], quantity: 1, priceCents: Number(v[3]) * 100, costCents: Number(v[4]) * 100 }] }, demoActor, `sample-0${i + 1}-0000-0000-000000000000`);
    if (i === 2) { o.stage = 'Delivered'; o.quoteStatus = 'Accepted'; o.acceptanceReference = 'Sample acceptance'; o.deliveryReference = 'Sample completion'; o.invoice = { reference: 'SAMPLE-INV-001', netCents: 420000, paidCents: 300000, dueDate: o.dueDate, recordedAt: o.createdAt }; }
    if (i === 3) o.quoteStatus = 'Awaiting approval';
    return o;
  });
}
