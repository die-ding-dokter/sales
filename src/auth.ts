import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';
import { TENANT_ID } from '../shared/model';
export type Config = { tenantId: string; clientId: string; apiScope: string; apiBaseUrl: string; teamsChannelUrl: string; taxRate: number | null };
export let config: Config;
let msal: PublicClientApplication | undefined;
export function configured() { return Boolean(msal); }
export async function initAuth() {
  const r = await fetch('/config.json', { cache: 'no-store' });
  if (!r.ok) throw new Error('Workspace configuration could not be loaded.');
  config = await r.json();
  if (config.tenantId !== TENANT_ID) throw new Error('This workspace is restricted to the Die Ding Dokter tenant.');
  if (!config.clientId || !config.apiScope || !config.apiBaseUrl) return;
  if (!/^[0-9a-f-]{36}$/i.test(config.clientId) || !config.apiScope.startsWith('api://') || !/^https:\/\/[^/]+\.azurewebsites\.net\/api\/?$/.test(config.apiBaseUrl)) throw new Error('The workspace configuration is invalid.');
  msal = new PublicClientApplication({ auth: { clientId: config.clientId, authority: `https://login.microsoftonline.com/${TENANT_ID}`, redirectUri: location.origin + '/redirect.html', postLogoutRedirectUri: location.origin + '/' }, cache: { cacheLocation: 'sessionStorage' } });
  await msal.initialize();
  const redirect = await msal.handleRedirectPromise();
  const account = redirect?.account ?? msal.getAllAccounts().find(a => a.tenantId === TENANT_ID);
  if (account?.tenantId === TENANT_ID) msal.setActiveAccount(account);
}
export const signedIn = () => Boolean(msal?.getActiveAccount());
export async function login() { if (!msal) throw new Error('Work account sign-in is awaiting activation.'); await msal.loginRedirect({ scopes: [config.apiScope], prompt: 'select_account' }); }
export async function logout() { await msal?.logoutRedirect(); }
async function token(scopes: string[]) {
  const account = msal?.getActiveAccount();
  if (!msal || !account || account.tenantId !== TENANT_ID) throw new Error('Sign in with your Die Ding Dokter work account.');
  try { return (await msal.acquireTokenSilent({ account, scopes })).accessToken; }
  catch (e) { if (e instanceof InteractionRequiredAuthError) { await msal.acquireTokenRedirect({ account, scopes }); throw new Error('Continuing Microsoft authorisation.'); } throw e; }
}
export async function api(path: string, method = 'GET', body?: unknown) {
  const accessToken = await token([config.apiScope]);
  const r = await fetch(config.apiBaseUrl.replace(/\/$/, '') + path, { method, headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(result.error ?? `The request failed (${r.status}).`);
  return result;
}
export async function graph(path: string, scope: string, method = 'GET', body?: unknown) {
  const accessToken = await token([`https://graph.microsoft.com/${scope}`]);
  const r = await fetch('https://graph.microsoft.com/v1.0' + path, { method, headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Microsoft could not complete this action (${r.status}). Check your permissions or try again.`);
  return result;
}
