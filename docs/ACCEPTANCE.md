# Acceptance before customer data

## Automated local/CI checks

`npm run check` executes domain/authentication tests and builds both applications. `npm run test:ui` tests the production frontend in Chromium.

Coverage includes foreign-tenant/owner isolation, role restrictions, signed token validation, wrong audience, expiry, unassigned users, margin/tax guards, scope locks after acceptance, immutable quotation history, receipt bounds/duplicate references, validation and spreadsheet-formula injection. Browser tests cover login gating, a sample quote-to-receipt journey, and 320/768/1440px light/dark layouts.

## Live synthetic identities

Use assigned synthetic accounts; enter no customer data until these pass. These checks require the actual tenant applications and Azure API and cannot be established by the sample preview.

| Check | Expected result |
| --- | --- |
| No token / ID token / Graph token | API returns 401 or 403, no sales data |
| Foreign tenant or other SPA | Denied |
| Correct tenant, no API app role | 403 |
| Representative A reads representative B's ID | 404 |
| SalesRep approves or records finance | 403 |
| Finance approves without Manager/Admin role | 403 |
| Manager approves below floor or before tax confirmation | 409 |
| Accepted quote is edited or revised | Rejected |
| Two clients update the same record version | One commits; one receives conflict |
| Cosmos write failure | No opportunity change without its audit event |
| Same accounting reference on another opportunity | Transaction rejected |
| Duplicate receipt reference / overpayment | Rejected |
| Paginated query with more than 100 opportunities | UI loads all authorised pages |
| More than 100 audit events, including an empty intermediate page | Complete retained history remains accessible |
| Production redirect bridge | Work-account sign-in completes on the exact domain |
| Outlook permission withheld | Feature shows failure; sales records stay intact |
| Outlook draft created after review | Draft in the current user's mailbox; no send |
| Private calendar reminder | Correct South Africa time; no attendees |
| Teams button | Opens only configured HTTPS Teams channel; posts nothing |
| Quote print | Current approved revision and correct tax/net/total; no costs |
| CSV | Only authorised records; quoted fields and neutralised formulas |

Record the tester, date, environment, result and issue reference for each check. Do not describe live authentication or database recovery as verified until this evidence exists.
