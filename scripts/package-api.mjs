import fs from 'node:fs/promises';
// Run after `npm ci --omit=dev` in CI. The workspace itself is excluded from the copy.
const dest = 'artifacts/api';
await fs.mkdir(dest, { recursive: true });
for (const f of ['package.json', 'host.json', 'dist']) await fs.cp(`api/${f}`, `${dest}/${f}`, { recursive: true });
await fs.cp('node_modules', `${dest}/node_modules`, { recursive: true, filter: src => !src.startsWith('node_modules/@ddd') });
console.log('API deployment package prepared.');
