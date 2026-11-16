# Microsoft Entra activation

Target directory: Die Ding Dokter, `fa446f15-b4e8-4968-b1c7-00296029852e`.

The connected ChatGPT Outlook/Teams account is not an app registration and does not grant this repository access to the Die Ding Dokter directory. Complete these steps as an authorised administrator of that directory.

## 1. Register the API

Create an application named **Die Ding Dokter Sales API** with supported account type **Accounts in this organisational directory only**. No redirect URI or client secret is needed for the API.

- Set `api.requestedAccessTokenVersion` to `2`.
- Set the Application ID URI to `api://<API_CLIENT_ID>`.
- Expose delegated scope `access_as_user`, with admin consent required. Suggested consent text: “Access the Die Ding Dokter sales workspace as the signed-in user.”
- Create app roles with allowed member type **Users/Groups**, enabled, using these exact values: `SalesRep`, `Manager`, `Finance`, `Admin`.
- Require user assignment on the **API enterprise application** and assign appropriate users/groups to those roles. Tenant membership alone does not grant access.

Keep API role assignment and the app registration owner list separate. An application owner is not automatically a portal administrator.

## 2. Register the browser application

Create **Die Ding Dokter Sales Portal**, single tenant.

Add the **Single-page application** platform with these exact redirect URIs:

- Production: `https://sales.diedingdokter.co.za/redirect.html`
- Optional development: `http://localhost:5173/redirect.html`

The dedicated bridge is required by MSAL Browser v5. Serve it without Cross-Origin-Opener-Policy headers. Do not move the MSAL bootstrap or portal router into the bridge page.

The portal sends users to `https://sales.diedingdokter.co.za/` after sign-out. Do not enable implicit token grants or create a browser client secret.

Add delegated permission to **Sales API > access_as_user** and grant administrator consent. If tenant policy requires assignment, also require user assignment on the SPA enterprise application and assign the approved staff group.

## 3. Microsoft Graph permissions

The portal requests permissions incrementally when a user chooses an integration. Add only the delegated permissions approved by the tenant administrator:

| Feature | Delegated permission | Behaviour |
| --- | --- | --- |
| Read next seven days of calendar | `Calendars.Read` | Current user's calendar only |
| Add a private follow-up reminder | `Calendars.ReadWrite` | Current user, no attendees |
| Create an Outlook draft | `Mail.ReadWrite` | Draft only, no `Mail.Send` permission |
| Open Teams channel | None | Approved HTTPS channel link |

Microsoft does not provide a drafts-only Graph permission. `Mail.ReadWrite` is broader than creating drafts, so the administrator must approve this tradeoff. The application implements no mailbox scanning or automatic sending. Do not substitute application-wide permissions.

## 4. Configure the API and frontend

Backend settings:

| Setting | Value |
| --- | --- |
| `ENTRA_TENANT_ID` | The exact tenant UUID above |
| `ENTRA_API_CLIENT_ID` | API application's client ID; v2 access token audience |
| `ENTRA_SPA_CLIENT_ID` | SPA application's client ID; required `azp` |
| `MARGIN_FLOOR` | Management-approved decimal, e.g. `0.20` only if approved |
| `SALES_TAX_RATE` | Finance-confirmed decimal; leave blank to block approval |

GitHub repository variables, safe to expose in the browser:

| Variable | Value |
| --- | --- |
| `PORTAL_CLIENT_ID` | SPA client ID |
| `PORTAL_API_SCOPE` | `api://<API_CLIENT_ID>/access_as_user` |
| `PORTAL_API_URL` | `https://<FUNCTION_APP>.azurewebsites.net/api` |
| `PORTAL_TEAMS_CHANNEL_URL` | Optional `https://teams.microsoft.com/l/channel/...` |

The build places these public identifiers in `dist/config.json`. Never place client secrets, Graph tokens or database credentials in this file.

## 5. Access policy

- Assign the smallest role needed. Sales representatives can access only opportunities they own. Managers and finance can view team records. Finance cannot approve quotations unless separately assigned Manager/Admin.
- Conditional Access should enforce the organisation's MFA, sign-in risk and device policies as appropriate to its licensing.
- Include approved guest users only through explicit API role assignment in the target tenant. An email suffix is not an authorisation rule.
- Review role and group membership when staff change and on a regular access-review cadence.

## Official references

- [MSAL Browser overview](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/about-msal-browser)
- [MSAL v5 redirect bridge](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/redirect-bridge)
- [Access-token validation](https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens)
- [Claims validation and authorisation](https://learn.microsoft.com/en-us/entra/identity-platform/claims-validation)
- [Create an Outlook draft](https://learn.microsoft.com/en-us/graph/api/user-post-messages?view=graph-rest-1.0)
- [Create a calendar event](https://learn.microsoft.com/en-us/graph/api/calendar-post-events?view=graph-rest-1.0)
