import { broadcastResponseToMainFrame } from '@azure/msal-browser/redirect-bridge';
// Dedicated MSAL v5 bridge: no routing, API calls or app bootstrap on this page.
void broadcastResponseToMainFrame().catch(() => {
  document.body.textContent = 'Microsoft sign-in could not finish. Close this window and return to your sales workspace.';
});
