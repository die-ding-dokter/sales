import './style.css';
import { Actor, Opportunity, OpportunityInput, totals, hasRole, csvCell, applyCommand, createOpportunity, Command } from '../shared/model';
import { api, config, configured, graph, initAuth, login, logout, signedIn } from './auth';
import { demoActor, sampleData } from './demo';

const app = document.querySelector<HTMLDivElement>('#app')!;
const money = (c: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(c / 100);
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]!));
const paths: Record<string, string> = {
  dashboard: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  pipeline: '<path d="M4 4h16l-6 7v8l-4 2V11z"/>', quote: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h5"/>',
  invoice: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h4M15 15v3"/>',
  team: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 4v2"/>',
  connect: '<path d="m9 15 6-6M8 17l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 7l2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(1 0) scale(.9)"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6M17 2v6M3 11h18M7 15h3M14 15h3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>', check: '<path d="m5 12 4 4L19 6"/>',
  logout: '<path d="M10 4H4v16h6M12 12h9m-4-4 4 4-4 4"/>', menu: '<path d="M3 6h18M3 12h18M3 18h18"/>'
};
const icon = (name: string) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.quote}</svg>`;
type Page = 'dashboard' | 'pipeline' | 'quotes' | 'invoices' | 'team' | 'integrations' | 'settings';
let page: Page = 'dashboard', demo = false, actor: Actor | undefined, records: Opportunity[] = [];
let settings = { marginFloor: .15, taxRate: null as number | null };
let busy = false;
const date = (d: string) => new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium', timeZone: 'Africa/Johannesburg' }).format(new Date(d.length === 10 ? d + 'T12:00:00Z' : d));
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
function notify(message: string, error = false) { const n = document.querySelector<HTMLDivElement>('#notice')!; n.textContent = message; n.className = error ? 'visible error' : 'visible'; setTimeout(() => { n.className = ''; }, 6500); }
async function run(action: () => Promise<void>) { if (busy) return; busy = true; document.documentElement.setAttribute('aria-busy', 'true'); try { await action(); } catch (e) { notify(e instanceof Error ? e.message : 'The action could not be completed.', true); } finally { busy = false; document.documentElement.removeAttribute('aria-busy'); } }
function brand() { return '<span class="brand-icon"><img src="/ddd-logo.png" alt="" width="40" height="40"/></span><span><b>Die Ding Dokter</b><small>SALES WORKSPACE</small></span>'; }
function loginPage(error = '') {
  app.innerHTML = `<main id="main" class="login-page"><header class="login-header"><a href="https://www.diedingdokter.co.za" class="brand">${brand()}</a><button class="icon-button" data-action="theme" aria-label="Switch colour theme">${icon('sun')}</button></header><div class="login-grid"><section class="login-story"><p class="eyebrow">ONE TEAM. ONE CLEAR PROCESS.</p><h1>Good work.<br/>Better business.</h1><p class="intro">A clear view of every opportunity, every promise and the next step that moves it forward.</p><div class="login-principles"><div><span>01</span><strong>Sell with confidence</strong><p>Scope the need. Build the quote. Know the margin.</p></div><div><span>02</span><strong>Keep your promises</strong><p>Connect customer decisions to dependable delivery.</p></div><div><span>03</span><strong>Grow together</strong><p>See progress, share what works and get support.</p></div></div><div class="login-footer">POWERED BY SKUNKWORKS <span>STRATEGY / ENGINEERING / INTELLIGENCE</span></div></section><section class="login-panel"><div class="login-card"><div class="security-icon">${icon('lock')}</div><p class="eyebrow">YOUR TEAM WORKSPACE</p><h2>Welcome back.</h2><p>Sign in with your Die Ding Dokter Microsoft work account to access your sales workspace.</p>${error ? `<p class="callout danger">${esc(error)}</p>` : ''}<button class="button full" data-action="login" ${configured() ? '' : 'disabled'}><span class="ms-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>Sign in with Microsoft ${icon('arrow')}</button><p class="hint">${configured() ? 'Access is restricted to authorised users in the Die Ding Dokter tenant.' : 'Work account sign-in is awaiting activation by your tenant administrator.'}</p><div class="divider"><span>EXPLORE THE WORKSPACE</span></div><button class="button secondary full" data-action="demo">Open sample workspace ${icon('arrow')}</button><p class="hint">Fictional examples. No access to customer records or connected Microsoft services.</p><a class="text-link" href="mailto:sales@diedingdokter.co.za">Need help signing in?</a></div><p class="secure-note">${icon('lock')} Microsoft Entra ID / Single tenant / Role based access</p></section></div></main>`;
}
const stages = ['Qualified', 'Quoted', 'Accepted', 'Delivered', 'Lost'] as const;
function pill(s: string) { return `<span class="pill ${s === 'Delivered' || s === 'Approved' || s === 'Accepted' ? 'success' : s === 'Awaiting approval' ? 'warning' : ''}">${esc(s)}</span>`; }
function empty(title: string, message: string) { return `<div class="empty">${icon('pipeline')}<h3>${title}</h3><p>${message}</p><button class="button secondary" data-action="new">Create an opportunity ${icon('plus')}</button></div>`; }
function header(eyebrow: string, title: string, desc: string, action = '') { return `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${desc}</p></div>${action}</div>`; }
function table(rows = records) {
  if (!rows.length) return empty('Your next opportunity starts here.', 'Capture a customer need and give it a clear next step.');
  return `<div class="table-scroll" role="region" aria-label="Opportunities" tabindex="0"><table><thead><tr><th>Opportunity</th><th>Stage</th><th>Net value</th><th>Next action</th><th>Due</th><th><span class="sr-only">Open</span></th></tr></thead><tbody>${rows.map(o => `<tr data-search="${esc((o.title + ' ' + o.customer + ' ' + o.ownerName).toLowerCase())}"><td><button class="row-link" data-action="detail" data-id="${esc(o.id)}">${esc(o.title)}</button><small>${esc(o.customer)} / ${esc(o.ownerName)}</small></td><td>${pill(o.stage)}</td><td class="numeric">${money(totals(o.lines).netCents)}</td><td>${esc(o.nextAction)}</td><td>${date(o.dueDate)}</td><td><button class="icon-button" data-action="detail" data-id="${esc(o.id)}" aria-label="Open ${esc(o.title)}">${icon('arrow')}</button></td></tr>`).join('')}</tbody></table></div>`;
}
function dashboard() {
  const open = records.filter(o => ['Qualified', 'Quoted'].includes(o.stage));
  const booked = records.filter(o => ['Accepted', 'Delivered'].includes(o.stage));
  const invoiced = records.filter(o => o.invoice);
  const netPipeline = open.reduce((s, o) => s + totals(o.lines).netCents, 0);
  const bookedValue = booked.reduce((s, o) => s + totals(o.lines).netCents, 0);
  const collected = invoiced.reduce((s, o) => s + o.invoice!.paidCents, 0);
  const balance = invoiced.reduce((s, o) => s + o.invoice!.netCents - o.invoice!.paidCents, 0);
  const overdue = records.filter(o => o.dueDate < today() && !['Delivered', 'Lost'].includes(o.stage));
  const approvals = records.filter(o => o.quoteStatus === 'Awaiting approval' && o.stage === 'Qualified');
  return header('YOUR WORKSPACE', `Let’s move business forward.`, `${date(today())}. Your visible records across all dates.`, `<button class="button" data-action="new">${icon('plus')} New opportunity</button>`) +
    `<div class="metric-grid">${[['Open pipeline', money(netPipeline), `${open.length} active opportunities`, 'pipeline'], ['Accepted orders', money(bookedValue), `${booked.length} accepted or delivered`, 'check'], ['Net receipts recorded', money(collected), 'Manually reconciled by finance', 'invoice'], ['Net balance outstanding', money(balance), 'Across recorded invoices', 'quote']].map(m => `<section class="metric"><div><span>${m[0]}</span>${icon(m[3])}</div><strong>${m[1]}</strong><small>${m[2]}</small></section>`).join('')}</div>
    <div class="dashboard-grid"><section class="panel"><div class="section-heading"><div><p class="eyebrow">OPPORTUNITY FLOW</p><h2>A clear view of the work.</h2></div><button class="text-button" data-page="pipeline">View pipeline ${icon('arrow')}</button></div><div class="stage-grid">${stages.slice(0, 4).map((s, i) => { const a = records.filter(o => o.stage === s); return `<div><span class="stage-number">0${i + 1}</span><h3>${s}</h3><strong>${a.length}</strong><small>${money(a.reduce((n, o) => n + totals(o.lines).netCents, 0))}</small></div>`; }).join('')}</div><p class="hint">Order value, delivery and cash are tracked separately. No forecast probabilities are assumed.</p></section><section class="panel attention"><p class="eyebrow">FOCUS FOR TODAY</p><h2>The next right step.</h2><button class="focus-row" data-page="quotes"><span><strong>${approvals.length}</strong> quotes awaiting approval</span>${icon('arrow')}</button><button class="focus-row" data-page="pipeline"><span><strong>${overdue.length}</strong> follow-ups past their date</span>${icon('arrow')}</button><p class="hint">Clear blockers early. Ask for support before a customer promise is at risk.</p></section></div>
    <section class="panel"><div class="section-heading"><div><p class="eyebrow">NEXT ACTIONS</p><h2>Keep the conversation moving.</h2></div><button class="text-button" data-action="export">${icon('download')} Export CSV</button></div>${table(records.filter(o => !['Lost', 'Delivered'].includes(o.stage)).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5))}</section>`;
}
function pipeline() { return header('SALES PIPELINE', 'Every opportunity. A clear next step.', 'Qualify, price, approve and deliver from one shared record.', `<button class="button" data-action="new">${icon('plus')} New opportunity</button>`) + `<section class="panel"><div class="toolbar"><label class="search">${icon('search')}<input id="record-search" type="search" placeholder="Search customer, opportunity or owner" aria-label="Search opportunities"/></label><button class="button secondary" data-action="export">${icon('download')} Export CSV</button></div>${table()}</section>`; }
function quotes() {
  const list = records.filter(o => o.stage !== 'Lost');
  return header('QUOTATIONS', 'Price with purpose.', 'Approval protects margin. Written acceptance protects the promise.') + `<section class="panel"><div class="section-heading"><h2>Quote register</h2><span class="hint">${list.length} records</span></div>${!list.length ? empty('No quotes yet.', 'Create an opportunity to prepare your first quotation.') : `<div class="table-scroll"><table><thead><tr><th>Customer and scope</th><th>Revision</th><th>Net value</th><th>GP margin</th><th>Status</th><th>Action</th></tr></thead><tbody>${list.map(o => `<tr><td><button class="row-link" data-action="detail" data-id="${o.id}">${esc(o.title)}</button><small>${esc(o.customer)}</small></td><td>R${o.revision}</td><td>${money(totals(o.lines).netCents)}</td><td>${(totals(o.lines).margin * 100).toFixed(1)}%</td><td>${pill(o.quoteStatus)}</td><td><button class="text-button" data-action="detail" data-id="${o.id}">Review ${icon('arrow')}</button></td></tr>`).join('')}</tbody></table></div>`}<p class="hint">Tax treatment must be confirmed before approval. Approved revisions remain in the record when a new revision is prepared.</p></section>`;
}
function invoices() {
  const list = records.filter(o => o.invoice);
  return header('FINANCE', 'From accepted work to collected cash.', 'Register invoices issued by your accounting system and reconcile net receipts.') + `<div class="callout">This register does not issue tax invoices. Finance records the original accounting reference and the net amount allocated to it.</div><section class="panel"><h2>Invoice register</h2>${list.length ? `<div class="table-scroll"><table><thead><tr><th>Accounting reference</th><th>Customer</th><th>Net invoiced</th><th>Net received</th><th>Net balance</th><th>Due</th><th>Action</th></tr></thead><tbody>${list.map(o => `<tr><td>${esc(o.invoice!.reference)}</td><td>${esc(o.customer)}</td><td>${money(o.invoice!.netCents)}</td><td>${money(o.invoice!.paidCents)}</td><td>${money(o.invoice!.netCents - o.invoice!.paidCents)}</td><td>${date(o.invoice!.dueDate)}</td><td><button class="text-button" data-action="detail" data-id="${o.id}">Open ${icon('arrow')}</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><h3>No accounting invoices recorded.</h3><p>Finance can register an invoice from an accepted opportunity.</p></div>'}</section>`;
}
function team() {
  const byOwner = new Map<string, { name: string; accepted: number; delivered: number; collectedGP: number; open: number }>();
  for (const o of records) { const v = byOwner.get(o.ownerId) ?? { name: o.ownerName, accepted: 0, delivered: 0, collectedGP: 0, open: 0 }; const t = totals(o.lines); if (['Accepted', 'Delivered'].includes(o.stage)) v.accepted += t.netCents; if (o.stage === 'Delivered') { v.delivered += t.netCents; if (o.invoice?.netCents) v.collectedGP += Math.round(t.gpCents * o.invoice.paidCents / o.invoice.netCents); } if (['Qualified', 'Quoted'].includes(o.stage)) v.open++; byOwner.set(o.ownerId, v); }
  return header('TEAM PERFORMANCE', 'Progress people can trust.', 'All-time operational totals for records you are authorised to see. Finance validates recognised revenue separately.') + `<div class="callout">Monthly quotas, revenue recognition and incentive policies are awaiting management adoption. These totals do not calculate payroll or declare a monthly revenue winner.</div><section class="panel"><h2>Team scorecard</h2>${byOwner.size ? `<div class="table-scroll"><table><thead><tr><th>Representative</th><th>Open</th><th>Accepted value</th><th>Delivered value</th><th>Collected GP on delivered work</th></tr></thead><tbody>${[...byOwner.values()].sort((a, b) => b.delivered - a.delivered).map(v => `<tr><td>${esc(v.name)}</td><td>${v.open}</td><td>${money(v.accepted)}</td><td>${money(v.delivered)}</td><td>${money(v.collectedGP)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><h3>Performance starts with reliable records.</h3><p>Capture opportunities to build the team’s operational view.</p></div>'}</section><section class="panel"><p class="eyebrow">SHARED ACCOUNTABILITY</p><div class="three-columns"><div><h3>Daily</h3><p>Review due actions and customer promises. Escalate blockers with an owner and date.</p></div><div><h3>Weekly</h3><p>Review conversion, capacity and cash exposure. Agree one practical coaching action.</p></div><div><h3>Monthly</h3><p>Finance reconciles results. Leadership recognises useful practices and reviews feasible targets.</p></div></div></section>`;
}
function integrations() {
  return header('CONNECTED WORK', 'Your Microsoft workspace, connected.', 'Request access only when you use a feature. Customer messages stay in your control.') + `<div class="integration-grid"><section class="panel">${icon('mail')}<h2>Outlook Email</h2><p>Create a customer follow-up as an Outlook draft from an opportunity. Review it in Outlook before sending.</p><span class="pill">Mail.ReadWrite / On demand</span><button class="button secondary" data-page="pipeline">Choose opportunity ${icon('arrow')}</button></section><section class="panel">${icon('calendar')}<h2>Outlook Calendar</h2><p>Read your upcoming appointments or add a private follow-up reminder to your own calendar.</p><span class="pill">Calendars.ReadWrite / On demand</span><div class="button-row"><button class="button secondary" data-action="calendar">View my calendar</button><button class="text-button" data-action="reminder">Add reminder</button></div><div id="calendar-list" role="status"></div></section><section class="panel">${icon('team')}<h2>Microsoft Teams</h2><p>Open your approved team channel for collaboration. No automatic messages are posted from this portal.</p><span class="pill">${config?.teamsChannelUrl ? 'Channel configured' : 'Channel not configured'}</span><button class="button secondary" data-action="teams">Open Teams ${icon('arrow')}</button></section><section class="panel">${icon('download')}<h2>Spreadsheets</h2><p>Export the opportunities visible to your role as an Excel-compatible CSV. Values use ZAR; amounts and dates have separate columns.</p><span class="pill">CSV / Your authorised records</span><button class="button secondary" data-action="export">Download opportunities ${icon('download')}</button></section></div>`;
}
function settingsPage() { return header('WORKSPACE SETTINGS', 'A clear foundation for good work.', 'Configuration, access and commercial controls for the first release.') + `<section class="panel"><h2>Workspace status</h2><dl class="detail-grid"><div><dt>Workspace</dt><dd>${demo ? 'Sample preview / isolated fictional data' : 'Live / authenticated API'}</dd></div><div><dt>Your role</dt><dd>${esc(actor?.roles.join(', '))}</dd></div><div><dt>Tenant</dt><dd>Die Ding Dokter / single tenant</dd></div><div><dt>Minimum quotation margin</dt><dd>${(settings.marginFloor * 100).toFixed(0)}% ${demo ? '/ example only' : '/ server controlled'}</dd></div><div><dt>Tax configuration</dt><dd>${settings.taxRate === null ? 'Awaiting finance confirmation' : (settings.taxRate * 100).toFixed(0) + '%' + (demo ? ' / fictional example' : '')}</dd></div><div><dt>Invoice source</dt><dd>External accounting system / manual register</dd></div></dl></section><section class="panel"><h2>Access responsibilities</h2><div class="three-columns"><div><h3>Sales representative</h3><p>Own opportunities, quote preparation, customer acceptance and delivery evidence.</p></div><div><h3>Manager</h3><p>Team pipeline, quote approval, margin controls and coaching.</p></div><div><h3>Finance and admin</h3><p>Accounting references, receipts, configuration and access governance.</p></div></div><p class="hint">Roles must be assigned on the API enterprise application. The server validates the tenant, token audience, client, delegated scope and role before returning data.</p></section>`; }
function render() {
  if (!actor) return loginPage();
  const navigation: [Page, string, string][] = [['dashboard', 'Overview', 'dashboard'], ['pipeline', 'Sales pipeline', 'pipeline'], ['quotes', 'Quotations', 'quote'], ['invoices', 'Invoice register', 'invoice'], ['team', 'Team performance', 'team'], ['integrations', 'Integrations', 'connect'], ['settings', 'Settings', 'settings']];
  const views = { dashboard, pipeline, quotes, invoices, team, integrations, settings: settingsPage };
  app.innerHTML = `<div class="workspace"><aside class="sidebar" id="sidebar"><a class="brand" href="#dashboard">${brand()}</a><p class="nav-label">WORKSPACE</p><nav aria-label="Sales workspace">${navigation.map(([p, t, i]) => `<button data-page="${p}" ${page === p ? 'aria-current="page"' : ''}>${icon(i)}<span>${t}</span>${p === 'quotes' && records.some(o => o.quoteStatus === 'Awaiting approval' && o.stage === 'Qualified') ? `<span class="nav-count" aria-hidden="true">${records.filter(o => o.quoteStatus === 'Awaiting approval' && o.stage === 'Qualified').length}</span>` : ''}</button>`).join('')}</nav><div class="sidebar-note"><span class="eyebrow">THE OPERATING PROMISE</span><p>Clear ownership.<br/>Sound economics.<br/>Dependable delivery.</p><a href="https://brand.skunkworks.africa/" target="_blank" rel="noopener noreferrer">Built with Skunkworks ${icon('arrow')}</a></div><button class="profile" data-action="signout"><span class="avatar">${esc(actor.name.slice(0, 1))}</span><span><strong>${esc(actor.name)}</strong><small>${demo ? 'Sample workspace' : esc(actor.roles.join(' / '))}</small></span>${icon('logout')}</button></aside><div class="main-wrap"><header class="topbar"><button class="icon-button mobile-menu" data-action="menu" aria-controls="sidebar" aria-expanded="false" aria-label="Open navigation">${icon('menu')}</button><div class="breadcrumb">Workspace <span>/</span> ${navigation.find(n => n[0] === page)?.[1]}</div><div class="topbar-actions"><span class="session-state">${icon(demo ? 'quote' : 'lock')}${demo ? 'Sample data' : 'Work account'}</span><button class="icon-button" data-action="refresh" aria-label="Refresh workspace">↻</button><button class="icon-button" data-action="theme" aria-label="Switch colour theme">${icon('sun')}</button></div></header>${demo ? '<div class="demo-banner"><b>SAMPLE WORKSPACE</b><span>Fictional data. Changes stay in this session. Microsoft integrations are unavailable.</span><button data-action="reset-demo">Reset sample</button></div>' : ''}<main id="main" class="main-content">${views[page]()}</main><footer class="workspace-footer"><span>Die Ding Dokter / Sales workspace</span><span>Ownership. Confidence. Sustainable growth.</span></footer></div></div>`;
}
function modal(title: string, content: string) {
  document.querySelector('#modal')?.remove();
  const dialog = document.createElement('dialog'); dialog.id = 'modal'; dialog.className = 'modal';
  dialog.innerHTML = `<div class="modal-heading"><h2>${title}</h2><button class="icon-button" data-action="close-modal" aria-label="Close dialog">×</button></div>${content}`;
  document.body.append(dialog); dialog.showModal();
  dialog.addEventListener('close', () => dialog.remove());
  dialog.addEventListener('click', handleClick);
  dialog.addEventListener('submit', handleSubmit);
}
function fields(o?: Opportunity) {
  const l = o?.lines[0];
  return `<div class="form-grid"><label class="full">Opportunity name<input name="title" required maxlength="160" value="${esc(o?.title)}"/></label><label>Customer<input name="customer" required maxlength="160" value="${esc(o?.customer)}"/></label><label>Category<select name="category">${['Repairs', 'Hardware', 'Business services', 'Other'].map(s => `<option ${o?.category === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label><label>Customer email<input type="email" name="email" maxlength="254" value="${esc(o?.email)}"/></label><label>Phone<input name="phone" maxlength="40" value="${esc(o?.phone)}"/></label><label class="full">Quoted item or service<input name="description" required maxlength="200" value="${esc(l?.description)}"/></label><label>Quantity<input name="quantity" type="number" min="1" max="1000" step="1" required value="${l?.quantity ?? 1}"/></label><label>Unit selling price (ZAR, before tax)<input name="price" type="number" min="0" max="1000000" step="0.01" required value="${l ? l.priceCents / 100 : ''}"/></label><label>Unit direct cost (ZAR)<input name="cost" type="number" min="0" max="1000000" step="0.01" required value="${l ? l.costCents / 100 : ''}"/></label><label>Next action date<input name="dueDate" type="date" required value="${o?.dueDate ?? today()}"/></label><label class="full">Next action<input name="nextAction" required maxlength="300" value="${esc(o?.nextAction)}"/></label><label class="full">Scope, exclusions and dependencies<textarea name="notes" maxlength="2000" rows="3">${esc(o?.notes)}</textarea></label></div>`;
}
function opportunityForm(o?: Opportunity) { modal(o ? 'Edit opportunity' : 'New opportunity', `<form data-form="opportunity" data-id="${o?.id ?? ''}"><p class="hint">All amounts are in ZAR. Tax is added only after finance confirms the workspace tax configuration.</p>${fields(o)}<div class="form-actions"><button type="button" class="button secondary" data-action="close-modal">Cancel</button><button class="button" type="submit">Save opportunity ${icon('check')}</button></div></form>`); }
function detail(id: string) {
  const o = records.find(r => r.id === id); if (!o) return;
  const t = totals(o.lines), a = actor!;
  const seller = o.ownerId === a.oid || hasRole(a, 'Admin', 'Manager');
  const btn = (action: string, text: string) => `<button class="button secondary" data-action="${action}" data-id="${o.id}">${text}</button>`;
  let buttons = '';
  if (seller) buttons += btn('followup', 'Update next action');
  if (seller && o.quoteStatus === 'Draft' && o.stage === 'Qualified') buttons += btn('edit', 'Edit scope') + btn('submit', 'Submit for approval');
  if (seller && ['Qualified', 'Quoted'].includes(o.stage) && o.quoteStatus !== 'Draft') buttons += btn('revise', 'Prepare new revision');
  if (hasRole(a, 'Admin', 'Manager') && o.quoteStatus === 'Awaiting approval' && o.stage === 'Qualified') buttons += btn('approve', 'Approve quotation');
  if (seller && o.quoteStatus === 'Approved' && o.stage === 'Quoted') buttons += btn('accept', 'Record acceptance');
  if (seller && o.stage === 'Accepted') buttons += btn('deliver', 'Record completion');
  if (seller && ['Qualified', 'Quoted'].includes(o.stage)) buttons += btn('lose', 'Close as lost');
  if (hasRole(a, 'Finance', 'Admin') && ['Accepted', 'Delivered'].includes(o.stage)) buttons += o.invoice ? btn('receipt', 'Record net receipt') : btn('invoice', 'Record accounting invoice');
  if (['Approved', 'Accepted'].includes(o.quoteStatus)) buttons += btn('print', 'Print approved quote');
  modal(esc(o.title), `<p class="detail-customer">${esc(o.customer)} ${pill(o.stage)}</p><dl class="detail-grid"><div><dt>Net quote value</dt><dd>${money(t.netCents)}</dd></div><div><dt>Gross profit</dt><dd>${money(t.gpCents)} / ${(t.margin * 100).toFixed(1)}%</dd></div><div><dt>Quote state</dt><dd>R${o.revision} / ${esc(o.quoteStatus)}</dd></div><div><dt>Owner</dt><dd>${esc(o.ownerName)}</dd></div><div><dt>Next action</dt><dd>${esc(o.nextAction)}</dd></div><div><dt>Action date</dt><dd>${date(o.dueDate)}</dd></div></dl><h3>Scope</h3><p>${o.lines.map(l => `${esc(l.description)} / ${l.quantity} × ${money(l.priceCents)}`).join('<br/>')}</p><p class="pre-wrap">${esc(o.notes || 'No additional scope notes.')}</p>${o.acceptanceReference ? `<p><b>Acceptance:</b> ${esc(o.acceptanceReference)}</p>` : ''}${o.deliveryReference ? `<p><b>Completion:</b> ${esc(o.deliveryReference)}</p>` : ''}${o.invoice ? `<p><b>Accounting invoice:</b> ${esc(o.invoice.reference)}<br/>Net balance: ${money(o.invoice.netCents - o.invoice.paidCents)}</p>` : ''}<div class="button-row">${buttons}</div><hr/><div class="button-row">${btn('email', 'Create Outlook draft')}${btn('audit', 'View audit history')}</div><div id="audit-list" role="status"></div><p class="hint">Last updated ${date(o.updatedAt)} / Version ${o.version}. Saved changes are audited.</p>`);
}
function requestCommand(o: Opportunity, action: string) {
  if (action === 'followup') return modal('Update next action', `<form data-form="command" data-id="${o.id}" data-command="followup"><label>Next action<input name="nextAction" required maxlength="300" value="${esc(o.nextAction)}"/></label><label>Due date<input name="dueDate" type="date" required value="${o.dueDate}"/></label><button class="button">Save next action</button></form>`);
  if (action === 'receipt') return modal('Record a net receipt', `<form data-form="command" data-id="${o.id}" data-command="receipt"><p>Record the net portion allocated to this invoice after accounting reconciliation. Balance: ${money(o.invoice!.netCents - o.invoice!.paidCents)}.</p><label>Net amount (ZAR)<input name="amount" type="number" min="0.01" max="${(o.invoice!.netCents - o.invoice!.paidCents) / 100}" step="0.01" required/></label><label>Receipt reference<input name="reference" maxlength="100" required/></label><button class="button">Save receipt</button></form>`);
  if (action === 'invoice') return modal('Record an accounting invoice', `<form data-form="command" data-id="${o.id}" data-command="invoice"><p>Issue the official invoice in your accounting system first. This records its full net value of ${money(totals(o.lines).netCents)}. Partial invoices and credit notes are handled in accounting.</p><label>Accounting invoice reference<input name="reference" maxlength="100" required/></label><label>Payment due date<input name="dueDate" type="date" value="${today()}" required/></label><button class="button">Save accounting reference</button></form>`);
  const titles: Record<string, string> = { accept: 'Record written acceptance', deliver: 'Record completed delivery', lose: 'Close opportunity as lost', approve: 'Approve quotation', revise: 'Prepare a new quote revision', submit: 'Submit quotation for approval' };
  const needRef = ['accept', 'deliver', 'lose'].includes(action);
  modal(titles[action], `<form data-form="command" data-id="${o.id}" data-command="${action}"><p>${action === 'approve' ? `Approve revision ${o.revision} for ${esc(o.customer)} at ${money(totals(o.lines).netCents)} before tax. Confirm scope, availability and delivery capacity before approving.` : action === 'revise' ? 'This removes current approval and returns the quote to draft. Previously approved snapshots remain in the audit trail.' : 'Confirm the action for this opportunity. The record version and your access will be checked before saving.'}</p>${needRef ? `<label>${action === 'lose' ? 'Reason for loss' : 'Evidence reference or document location'}<textarea name="reference" rows="3" maxlength="300" required></textarea></label>` : ''}<div class="form-actions"><button class="button secondary" type="button" data-action="close-modal">Cancel</button><button class="button" type="submit">Confirm</button></div></form>`);
}
async function mutate(id: string, command: Command) {
  const o = records.find(r => r.id === id)!;
  const saved = demo ? applyCommand(o, actor!, command, settings) : await api(`/opportunities/${id}/commands`, 'POST', { version: o.version, command });
  records = records.map(r => r.id === id ? saved : r);
  document.querySelector<HTMLDialogElement>('#modal')?.close(); render(); notify('Opportunity updated.');
}
function exportCSV() {
  const rows: unknown[][] = [['Opportunity ID', 'Customer', 'Opportunity', 'Owner', 'Stage', 'Quote status', 'Net value ZAR', 'Direct cost ZAR', 'Gross profit ZAR', 'GP percent', 'Next action', 'Action date', 'Invoice reference', 'Net received ZAR', 'Updated UTC']];
  records.forEach(o => { const t = totals(o.lines); rows.push([o.id, o.customer, o.title, o.ownerName, o.stage, o.quoteStatus, t.netCents / 100, t.costCents / 100, t.gpCents / 100, (t.margin * 100).toFixed(2), o.nextAction, o.dueDate, o.invoice?.reference ?? '', (o.invoice?.paidCents ?? 0) / 100, o.updatedAt]); });
  const blob = new Blob(['\uFEFF' + rows.map(r => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `ddd-${demo ? 'sample-' : ''}opportunities-${today()}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); notify(`${records.length} authorised records exported.`);
}
function printQuote(o: Opportunity) {
  const q = o.quotes.at(-1); if (!q || !['Approved', 'Accepted'].includes(o.quoteStatus)) throw new Error('An approved quotation is required.');
  const tax = Math.round(q.netCents * q.taxRate);
  document.querySelector('#print-quote')?.remove();
  const section = document.createElement('section'); section.id = 'print-quote';
  section.innerHTML = `<div class="brand">${brand()}</div><p class="eyebrow">${demo ? 'FICTIONAL SAMPLE / ' : ''}SALES QUOTATION</p><h1>${esc(q.number)} / R${q.revision}</h1><p>Prepared for: <b>${esc(o.customer)}</b><br/>Scope: ${esc(o.title)}<br/>Approved: ${date(q.approvedAt)} by ${esc(q.approvedBy)}</p><table><thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Net amount</th></tr></thead><tbody>${q.lines.map(l => `<tr><td>${esc(l.description)}</td><td>${l.quantity}</td><td>${money(l.priceCents)}</td><td>${money(l.quantity * l.priceCents)}</td></tr>`).join('')}</tbody></table><p>Net: ${money(q.netCents)}<br/>Tax (${q.taxRate * 100}%): ${money(tax)}<br/><b>Total: ${money(q.netCents + tax)}</b></p><h3>Scope, exclusions and dependencies</h3><p class="pre-wrap">${esc(o.notes || 'Confirm the written scope and commercial terms with your representative.')}</p><p>Acceptance must reference this quotation and revision. Delivery timing and payment terms must be agreed in writing. This quotation is not a tax invoice.</p><p>Contact: sales@diedingdokter.co.za</p>`;
  document.body.append(section); window.print();
}
function reminderForm() { modal('Add a private Outlook reminder', `<form data-form="reminder"><p>This creates a reminder in your own calendar. No customer invitation will be sent.</p><label>Subject<input name="subject" maxlength="160" required/></label><label>Start (South Africa time)<input type="datetime-local" name="start" required/></label><label>Duration (minutes)<input name="duration" type="number" min="5" max="480" value="30" required/></label><button class="button">Create private reminder</button></form>`); }
async function loadLive() {
  const session = await api('/session');
  const all: Opportunity[] = [];
  let cursor: string | null = null;
  const seen = new Set<string>();
  do {
    const response = await api('/opportunities' + (cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''));
    all.push(...response.items);
    cursor = response.nextCursor;
    if (cursor && seen.has(cursor)) throw new Error('The record list could not be loaded completely. Refresh the workspace.');
    if (cursor) seen.add(cursor);
  } while (cursor);
  actor = session.actor; settings = session.settings; records = all;
}
async function handleSubmit(e: Event) {
  const f = e.target as HTMLFormElement; if (!f.dataset.form) return; e.preventDefault();
  await run(async () => {
    const fd = new FormData(f), val = (k: string) => String(fd.get(k) ?? '');
    if (f.dataset.form === 'opportunity') {
      const data: OpportunityInput = { title: val('title'), customer: val('customer'), email: val('email'), phone: val('phone'), category: val('category') as OpportunityInput['category'], dueDate: val('dueDate'), nextAction: val('nextAction'), notes: val('notes'), lines: [{ description: val('description'), quantity: Number(val('quantity')), priceCents: Math.round(Number(val('price')) * 100), costCents: Math.round(Number(val('cost')) * 100) }] };
      if (f.dataset.id) await mutate(f.dataset.id, { action: 'edit', data });
      else { const o = demo ? createOpportunity(data, actor!, crypto.randomUUID()) : await api('/opportunities', 'POST', data); records.unshift(o); document.querySelector<HTMLDialogElement>('#modal')?.close(); render(); notify('Opportunity created.'); }
    } else if (f.dataset.form === 'command') {
      const action = f.dataset.command!;
      let cmd: unknown = { action };
      if (['accept', 'deliver'].includes(action)) cmd = { action, reference: val('reference') };
      if (action === 'lose') cmd = { action, reason: val('reference') };
      if (action === 'invoice') cmd = { action, reference: val('reference'), dueDate: val('dueDate') };
      if (action === 'receipt') cmd = { action, reference: val('reference'), amountCents: Math.round(Number(val('amount')) * 100) };
      if (action === 'followup') cmd = { action, nextAction: val('nextAction'), dueDate: val('dueDate') };
      await mutate(f.dataset.id!, cmd as Command);
    } else if (f.dataset.form === 'mail') {
      if (demo) throw new Error('Microsoft services are unavailable in the sample workspace.');
      await graph('/me/messages', 'Mail.ReadWrite', 'POST', { subject: val('subject'), body: { contentType: 'Text', content: val('body') }, toRecipients: [{ emailAddress: { address: val('email') } }] });
      document.querySelector<HTMLDialogElement>('#modal')?.close(); notify('Draft created in your Outlook mailbox. Review it in Outlook before sending.');
    } else if (f.dataset.form === 'reminder') {
      if (demo) throw new Error('Microsoft services are unavailable in the sample workspace.');
      const start = new Date(val('start') + ':00+02:00'), end = new Date(start.getTime() + Number(val('duration')) * 60000);
      if (!Number.isFinite(start.getTime()) || start.getTime() < Date.now()) throw new Error('Choose a future reminder time.');
      await graph('/me/events', 'Calendars.ReadWrite', 'POST', { subject: val('subject'), start: { dateTime: start.toISOString(), timeZone: 'UTC' }, end: { dateTime: end.toISOString(), timeZone: 'UTC' }, isReminderOn: true, reminderMinutesBeforeStart: 15, transactionId: crypto.randomUUID() });
      document.querySelector<HTMLDialogElement>('#modal')?.close(); notify('Private reminder created in Outlook.');
    }
  });
}
async function handleClick(e: Event) {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-action],[data-page]'); if (!b) return;
  if (b.dataset.page) { page = b.dataset.page as Page; location.hash = page; render(); return; }
  const action = b.dataset.action!, o = records.find(r => r.id === b.dataset.id);
  await run(async () => {
    if (action === 'theme') { const dark = document.documentElement.dataset.theme !== 'dark'; document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('ddd-theme', dark ? 'dark' : 'light'); }
    else if (action === 'login') await login();
    else if (action === 'demo') { demo = true; actor = demoActor; settings = { marginFloor: .15, taxRate: 0 }; records = sampleData(); render(); }
    else if (action === 'signout') { if (demo) { demo = false; actor = undefined; records = []; page = 'dashboard'; loginPage(); } else await logout(); }
    else if (action === 'reset-demo') { records = sampleData(); render(); notify('Sample workspace reset.'); }
    else if (action === 'refresh') { if (!demo) await loadLive(); render(); notify('Workspace refreshed.'); }
    else if (action === 'menu') { const s = document.querySelector('#sidebar')!; s.classList.toggle('is-open'); b.setAttribute('aria-expanded', String(s.classList.contains('is-open'))); }
    else if (action === 'close-modal') document.querySelector<HTMLDialogElement>('#modal')?.close();
    else if (action === 'new') opportunityForm();
    else if (action === 'detail' && o) detail(o.id);
    else if (action === 'edit' && o) { if (o.lines.length > 1) throw new Error('This release edits single-line offers only. Multi-line records must be revised through the API.'); opportunityForm(o); }
    else if (['submit', 'approve', 'accept', 'deliver', 'lose', 'revise', 'invoice', 'receipt', 'followup'].includes(action) && o) requestCommand(o, action);
    else if (action === 'export') exportCSV();
    else if (action === 'print' && o) printQuote(o);
    else if (action === 'email' && o) modal('Prepare an Outlook draft', `<form data-form="mail"><p>Review the recipient and text before creating the draft. This does not send an email.</p><label>Recipient<input name="email" type="email" required value="${esc(o.email)}"/></label><label>Subject<input name="subject" maxlength="160" required value="${esc('Following up: ' + o.title)}"/></label><label>Message<textarea name="body" rows="7" required>${esc(`Hello,\n\nI’m following up on ${o.title}.\n\n${o.nextAction}\n\nKind regards,\n${actor?.name}\nDie Ding Dokter`)}</textarea></label><button class="button">Create draft in Outlook</button></form>`);
    else if (action === 'reminder') reminderForm();
    else if (action === 'calendar') {
      if (demo) throw new Error('Microsoft services are unavailable in the sample workspace.');
      const from = new Date().toISOString(), to = new Date(Date.now() + 7 * 86400000).toISOString();
      const d = await graph(`/me/calendarView?startDateTime=${encodeURIComponent(from)}&endDateTime=${encodeURIComponent(to)}&$select=subject,start,webLink&$orderby=start/dateTime&$top=10`, 'Calendars.Read');
      document.querySelector('#calendar-list')!.innerHTML = d.value.length ? `<ul>${d.value.map((v: { subject: string; start: { dateTime: string; timeZone: string } }) => `<li>${esc(v.subject)}<small>${esc(v.start.dateTime)} ${esc(v.start.timeZone)}</small></li>`).join('')}</ul>` : '<p>No appointments in the next seven days.</p>';
    } else if (action === 'teams') {
      if (demo) throw new Error('Microsoft services are unavailable in the sample workspace.');
      if (!config.teamsChannelUrl || !/^https:\/\/teams\.microsoft\.com\/l\/channel\//.test(config.teamsChannelUrl)) throw new Error('Your administrator must configure the approved Teams channel.');
      window.open(config.teamsChannelUrl, '_blank', 'noopener,noreferrer');
    } else if (action === 'audit' && o) {
      const el = document.querySelector('#audit-list')!;
      if (demo) { el.innerHTML = '<p>Sample mode demonstrates the workflow only. Production saves each change with its audit event in one database transaction.</p>'; return; }
      const d = await api(`/opportunities/${o.id}/audit`);
      el.innerHTML = `<ul>${d.items.map((v: { action: string; actorName: string; createdAt: string }) => `<li>${esc(v.action)} / ${esc(v.actorName)}<small>${date(v.createdAt)}</small></li>`).join('')}</ul>`;
    }
  });
}
app.addEventListener('click', handleClick);
app.addEventListener('submit', handleSubmit);
app.addEventListener('input', e => { const input = e.target as HTMLInputElement; if (input.id === 'record-search') { const q = input.value.toLowerCase(); app.querySelectorAll<HTMLTableRowElement>('tr[data-search]').forEach(row => { row.hidden = !row.dataset.search!.includes(q); }); } });
window.addEventListener('hashchange', () => { const p = location.hash.slice(1); if (['dashboard', 'pipeline', 'quotes', 'invoices', 'team', 'integrations', 'settings'].includes(p)) { page = p as Page; if (actor) render(); } });
document.documentElement.dataset.theme = localStorage.getItem('ddd-theme') ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
await run(async () => { try { await initAuth(); if (signedIn()) { await loadLive(); render(); } else loginPage(); } catch (e) { loginPage(e instanceof Error ? e.message : 'Sign-in is unavailable.'); } });
