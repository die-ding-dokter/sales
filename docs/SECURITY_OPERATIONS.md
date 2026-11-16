# Security and operating responsibilities

## Boundary

GitHub Pages hosts public assets and a deliberately isolated sample. All real records remain in Cosmos DB and require a signed API access token. Browser UI visibility is not the authorisation boundary.

The API validates RS256 signature against tenant-specific Microsoft keys, exact issuer, audience, expiry/not-before, v2 token version, tenant UUID, immutable user object ID, approved SPA client, delegated scope and an assigned API role. ID tokens and Graph tokens do not satisfy the API audience/scope check.

SalesRep queries are owner-filtered by the API. Cross-tenant and other-owner item reads return no record. Every mutation uses a current version plus a Cosmos ETag. The changed opportunity, unique accounting-reference guard where needed, and audit snapshot commit together. Conflict responses require a refresh. No public endpoint can disable authentication, assign roles or edit audit history.

## First-release limitations

- Entra registration, Azure provisioning and authenticated persistence require tenant/subscription administration. They are not completed by a GitHub commit.
- No external accounting, stock, Shopify or bank reconciliation connector is implemented. Manual invoice/receipt records must be reconciled by finance.
- One invoice per opportunity is supported. Accounting retains credit notes, partial invoicing, tax allocation and official document numbering.
- Quote scope and commercial terms are captured in notes. Before operational use, finance/management must adopt the written terms and catalogue approval process.
- One offer line is available in the UI. The API supports up to 30 lines; the UI refuses to overwrite a multi-line record with a single-line editor.
- The team screen uses all-time operational totals. Monthly targets, finance revenue recognition, approved incentive calculations and customer consent tracking require a later release.
- Cosmos continuous backup helps recovery; the deployment is single region and does not promise zero downtime or a contractual recovery time.
- The audit display follows continuation cursors to show the complete retained history. Retention and compliance exports require a separately governed records policy.
- The Functions host provides bounded concurrency and dynamic throttling. An application gateway/rate policy should be sized from real traffic before a wider rollout.

## Daily operations

Sales lead reviews due actions, quote ageing and blockers. Operations validates capacity and delivery commitments before a manager approves a quotation. Finance reconciles original invoice references and net receipts. The administrator owns Entra role assignment and removes access when staff leave.

Deploy with customer-data and audit-record retention periods agreed by the business. Restrict Cosmos administration, ensure lawful customer-data handling and avoid copying customer records into GitHub issues or test fixtures. Application logs record correlation IDs only, not bearer tokens or sales payloads.

## Monitoring and recovery

Before entering customer records, configure Azure Monitor/Application Insights and action groups for API error rate, availability, authentication failures, Cosmos throttling and cost budgets. Check storage and database role failures during deployment. The current template does not create alert destinations or promise an on-call service.

Assign named operations and backup owners. Set recovery objectives after a restore exercise. Test restoring a synthetic dataset into an isolated Cosmos account, verify row counts, quote snapshots, receipt allocations and audit continuity, and record elapsed recovery time. Restrict backup/package access and review the results at least quarterly or after material infrastructure changes.

## Browser protections

The main page uses a restrictive CSP meta policy, output escaping and no third-party analytics. It cannot set all response headers from GitHub Pages: a meta policy does not implement `frame-ancestors` or HSTS. For header-level protections, place an approved Azure edge/proxy in front of the custom domain and test authentication after changes. The MSAL redirect bridge must remain free of COOP headers.

CSV fields are quoted and dangerous formula prefixes are neutralised. Microsoft tokens stay in the MSAL session cache. Customer records and tokens are not stored in application localStorage; only the colour-theme preference is saved there.
