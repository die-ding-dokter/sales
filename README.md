# Die Ding Dokter sales workspace

Sales portal for **https://sales.diedingdokter.co.za**, using the Skunkworks design system and Die Ding Dokter's approved logo.

## Implemented

- Microsoft Entra single-tenant login using MSAL Browser v5 and a dedicated redirect bridge.
- Pipeline with customer details, costing, net sales value, margin and dated follow-ups.
- Quotation submission, manager approval, retained approved snapshots and customer acceptance evidence.
- Margin-floor and tax-configuration gates before quote approval.
- Accepted scope locks, completion evidence and an external accounting invoice register.
- Finance-only net receipt allocation, duplicate receipt protection and invoice-reference uniqueness.
- Server-validated roles, owner-scoped representative access and transactional audit records in Cosmos DB.
- Operational dashboard and team totals with order value, delivery and receipts separated.
- On-demand delegated Microsoft Graph integration: Outlook drafts, calendar reading and private reminders.
- Approved Teams channel link and Excel-compatible CSV export with formula-injection protection.
- Light/dark themes, keyboard navigation, responsive layouts and an isolated sample workspace.
- GitHub Actions validation/Pages deployment, Azure deployment workflow and infrastructure template.

## Current activation status

The public login and **sample workspace are usable without an Entra application registration**. The sample uses fictional in-memory records and cannot call the production API or Microsoft Graph. Reloading discards changes.

Production sign-in intentionally stays disabled while `clientId`, `apiScope` or `apiBaseUrl` are missing. This repository contains no client secret, customer dataset or connection string.

The tenant associated with the public domain was resolved from its Microsoft OpenID metadata on 16 November 2026:

`fa446f15-b4e8-4968-b1c7-00296029852e`

Confirm this directory with the business owner before registering the applications. The implementation enforces this exact tenant; do not replace it with `common` or `organizations`.

## Run and verify

Requires Node.js 22 or newer.

```bash
npm ci
npm run dev -- --host 127.0.0.1
npm run check
npx playwright install chromium
npm run test:ui
```

The browser suite uses a production build. Run `npm run build` first. For an existing system Chromium, set `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium`.

## Activate the live workspace

1. Follow [Entra setup](docs/ENTRA_SETUP.md) to register separate SPA and API applications, expose the delegated scope and assign API roles.
2. Follow [Azure deployment](docs/DEPLOYMENT.md) to provision Azure Functions and Cosmos DB with managed identity. Approve the margin floor and confirm tax treatment.
3. Set the GitHub repository variables for the public SPA client ID, API scope and API URL. Deploy the API before enabling live sign-in.
4. Configure repository **Settings > Pages > Source: GitHub Actions**. The workflow preserves the existing custom domain.
5. Validate the authenticated [acceptance checklist](docs/ACCEPTANCE.md) with synthetic identities before entering customer records.

## Commercial boundaries

- The invoice register records invoices already issued in accounting. It does not issue tax invoices or synchronise Sage/Shopify.
- Amounts in the invoice register and receipt form are **net of tax**. Finance allocates tax and credit notes in accounting. This release supports one full net invoice per accepted opportunity.
- Quotes are portal-generated sales quotations. The representative must capture the commercial scope and terms in the notes. Management confirms availability and delivery capacity before approval.
- The team screen shows all-time operational totals. It does not claim finance-recognised revenue, calculate monthly incentives or invent quotas.
- The launch margin floor must be supplied during infrastructure deployment. The 15% floor and 0% tax in sample mode are examples only.
- Outlook drafts are not sent. Calendar reminders have no attendees and send no customer invitation. Teams opens an approved channel and posts no messages.
- OpenTable is not part of the sales process implemented here; no restaurant booking is made.

## Architecture

GitHub Pages serves the public application shell. Entra issues a dedicated API access token. Azure Functions verifies signature, issuer, audience, expiry, tenant, authorised SPA, delegated scope and API app role. Cosmos uses a tenant partition and managed identity. Each update and its audit snapshot commit in one partition transaction with an ETag precondition.

See [security and operations](docs/SECURITY_OPERATIONS.md) for access, monitoring, recovery and rollout requirements. No production tenant registration, Azure deployment, live-user authentication or DNS administration is implied by a successful frontend build.
