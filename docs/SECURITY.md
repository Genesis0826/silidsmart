# Security & Privacy Policy

## Tenant billing and sandbox boundary November 20 2026

No live gateway is enabled. Tenant statements require owner-confirmed actual tenancy, an invitation to an existing renter account, acceptance and explicit publication. The prototype does not verify email ownership/real identity; owners must check the recipient. A viewing approval never exposes billing. Renter IDs and owner IDs in request bodies grant no access. Own-account statement routes use session authorization and no-store responses; logout clears private UI state.

Sandbox checkout derives exact unpaid amounts from the stored statement, rejects live keys/events, uses a fixed provider endpoint, safe hosted URL, timeout and a persisted idempotency key. Old uncertain attempts cannot be retried beyond the provider key window. Open checkouts prevent conflicting void/manual-settlement/revocation actions. Raw-byte test signatures use timestamped HMAC, timing-safe comparison and freshness checks; unique event/payment identities, exact currency/amount/reference/session matching and server-side reconciliation protect the test audit. A browser return never proves payment. SandboxPaid does not alter real balances, revenue or payouts. See [Tenant Billing](TENANT_BILLING.md) for contracts and remaining provider acceptance gates. Owner quote/readiness routes remain hypothetical and never expose keys.

Earlier commission mutations are blocked by the normal server and archived examples do not verify provider receipt. No property-safety or 48-hour refund guarantee is established. See [payment pilot gates](PAYMENT_PILOT.md).

## Overview
Defines the B2B2C privacy isolation boundaries, role-scoped serialization contracts, input validation rules, and trust badge disclaimers for SilidSmart.

## Local pitch fixture boundary
Pitch fixture preparation is a local CLI operation, with no new HTTP seed/reset endpoint or browser privilege. It creates a clearly fictional owner account using the prototype's public sample password convention; use its documented sign-in only for the demo. Restore is scoped to identified fixture keys and refuses unexpected inventory or identity collisions. Native database backups and the generated manifest stay outside source control. This does not change production-hardening limitations or introduce real payment credentials.

## Core Security & Privacy Controls

1. **Strict B2B vs. B2C Data Isolation (Zero Tenant PII Leakage)**
   - **Public Endpoints (`GET /api/public/listings`, `GET /api/public/workspace`)**: Default to published vacancies. Explicit `availability=all` also exposes published occupied unit specifications/status and an optional owner-provided expected date. Hidden units remain excluded; public owner metadata stays stripped.
   - Private tenant, rent, utility, short-stay and moderation/event tables, private owner fields, and tenant/contract information are never queried or serialized in either public scope. Occupied unit status is public only when the unit is published, without occupant information.
   - **Client Memory Scrubbing (`frontend/src/App.tsx`)**: Signing out or changing accounts clears `tenants`, `rentRecords`, `listingReports`, and `systemEvents` in React state and re-fetches `/api/public/workspace`.

2. **Landlord Portfolio Isolation (`GET /api/owner/:ownerId/workspace`)**
   - Scopes `properties`, `units`, `tenants`, `rentRecords`, `inquiries`, and `subscription` strictly to `WHERE owner_id = ?`.
   - Returns only the signed-in owner's account in the owner list. The cross-landlord account switcher has been removed.
   - Requests for an owner ID outside the signed-in portfolio fail with `403 PORTFOLIO_FORBIDDEN`.

3. **Explicit Failure States (No Silent Fabricated Fallbacks)**
   - Neither backend failures nor missing records fall back to bundled client mock data; unavailable backends render an explicit error panel with retry controls, and mutation errors block modal closure while displaying server validation messages.

4. **Boundary Input Validation**
   - All write endpoints in [backend/src/service.mjs](../backend/src/service.mjs) validate required strings, enum values (`Vacant` / `Occupied`, `Paid` / `Due` / `Overdue`, `Pending review` / `ID reviewed` / `Needs correction`, `Approved` / `Declined`), numeric bounds (`monthlyRent > 0`), and `1 MB` maximum JSON body size (`server.mjs`) before executing SQL writes.

5. **Parameterized SQLite Queries**
   - All SQL queries execute via `db.prepare(...)` with bound `?` placeholders inside `node:sqlite`, with multi-step occupancy/onboarding writes wrapped in explicit `BEGIN TRANSACTION` / `COMMIT` / `ROLLBACK` blocks.

6. **Honest Identity Verification Disclaimers**
   - Government ID checks verify landlord identity submission only. Every public `"Owner ID reviewed"` badge is accompanied by `"This does not certify property safety"`.

## Pitch prototype access controls — November 18, 2026

- This remains a local pitch prototype. The sign-in dialog deliberately exposes three example accounts for demonstrating roles; it is not a production identity-provider integration.
- Account passwords are salted and hashed with Node scrypt in SQLite. Server-issued random sessions use an HttpOnly, SameSite=Strict cookie, expire after eight hours, and are revoked on sign-out. Sessions are held in memory and end when the backend restarts.
- Private requests require the matching server-side account role. Owner reads and writes check portfolio membership. Owner mutation responses return only that portfolio. Admin bootstrap, moderation, and data reset require the admin role.
- Public workspaces return no inquiries to guests. Signed-in renters receive requests linked to their account ID, not matching names or contact numbers. The server assigns the requester ID on submission; supplied renter IDs and roles grant no access.
- Owner registration creates its account and portfolio in one transaction. Public account registration can only create renters; administrator registration is not exposed.
- Cross-origin writes are rejected; the Vite proxy preserves the browser host. Production deployment, abuse controls, recovery flows, and verified real-world rental inventory are outside this pitch scope.

## Short-stay ledger boundary — November 20, 2026

Short-stay guest and commission records are private. Reads join unit/property ownership; writes require an owner session and membership. Guests/renters and other owners cannot access them. Public endpoints never query these entries, and React clears them on role/account changes. The server validates dates (including no future checkout), money precision/bounds, guest, source/status, optional same-unit inquiry, and fixes 5%. Source/completion/rent remain owner-reported. The separate commission review below records staff receipt assertions, without independently verifying stays or integrating with a provider.

## Directory and utility boundaries — November 20, 2026

The owner directory endpoint validates publication/date and portfolio ownership. Changing occupancy preserves publication; hidden inventory is not republished automatically. Expected availability is a separate owner-provided public field, never inferred from a tenant's move-in date, lease or notes. Past/future estimates do not change status or permit an occupied-unit inquiry.

Utility reads join unit/property ownership, while writes check owner role and membership. Bill identity cannot be reassigned during corrections. Server validation covers utility/month, money bounds/precision, real due/payment dates, status consistency, reference length and duplicate identity. Owner responses include only that portfolio's bills. Public responses and admin bootstrap omit them; React clears utility state on sign-out/role changes. Manual reports are not independently verified payments.

## Monthly commission records — November 20, 2026

Commission statements/remittances require an owner session and exact portfolio membership; client-supplied owner, fee or status cannot set identity/totals/verification. Admin sessions alone can review reports or void eligible statements. Admin bootstrap intentionally exposes statement line snapshots without guest names/contacts and remittance references for reconciliation; raw short-stay and utility tables remain omitted. Public endpoints return none, and browser state is cleared on sign-out/role changes.

Immutable issued snapshots and period locks prevent silent changes; void/reissue and rejected reports retain history. Pending reports remain outstanding. Exact amount, date/reference validation, unique active references and one open report per statement guard common mistakes. Staff verification requires an explicit actual-funds confirmation, real received date and review note, and stores reviewer/time. The system does not inspect bank statements, verify receipt images, collect funds or establish fraud-resistant attribution. An administrator can still assert receipt incorrectly; production audit/control requirements remain unvalidated. Do not record real banking details or use sample verification as proof of revenue.
