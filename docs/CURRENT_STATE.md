# Current State Assessment

## Latest tenant billing and sandbox checkout update November 20 2026

- Built **Owner → Tenant Billing** and **Renter → My bills**. Owner confirms actual tenancy and invites the registered renter; renter accepts; owner publishes selected monthly rent/utility snapshots. Viewing approval does not grant billing access. Only the recipient sees their private statement, totals, prior manual payments and amount due.
- Statements lock included source records. Void/reissue supports corrections; confirmed full external receipt updates the included unpaid records manually. Ended tenancy does not transfer bills to another occupant. Migration 007 adds links, statements, test checkouts and event identities without changing prior rental records.
- PayMongo Hosted Checkout v2 is wired to a separately gated **sandbox-only** endpoint with session authorization, server-side amounts, idempotency, signed raw-body events and retrieve/expire reconciliation. Default checkout is disabled because provider access is absent. SandboxPaid never settles real bills or produces a commission/payout. No actual provider-account acceptance or real-money test occurred.
- All 50 backend cases pass. Isolated hidden Edge acceptance covers invitation/acceptance/publication, ₱8,500 total and ₱8,200 due, disabled gateway, reload, owner external settlement, desktop/mobile layouts and logout/public privacy. Explicit select labels resolved the first browser selector failure. [Current contract and setup](TENANT_BILLING.md).
- Live checkout, owner split routing, automatic commission deductions, short-stay booking checkout, holds/refunds and production acceptance remain unfinished. Free management and proposed 3% monthly / 5% short-stay / zero utility/external-payment policy are unchanged.

## Earlier commission-only pilot checkpoint November 20 2026

This section supersedes the older pricing and manual-settlement descriptions below. See [payment pilot contract](PAYMENT_PILOT.md).

- Owner listing and core management are free at every portfolio size. Proposed future in-app commissions are 3% monthly accommodation rent and 5% SilidSmart short stays of 1–29 nights. Cash/external payments and utilities have zero commission. No amount is charged by the prototype.
- Added a private Monthly Bill Board for recorded rent, Electricity, Water and Wi-Fi, with month filtering, manual payment labels and explicit Not recorded cells. Migration 006 preserves existing bills and allows Wi-Fi.
- Added owner-only hypothetical payment quotes and readiness status. A test-only server adapter is prepared against PayMongo Hosted Checkout v2; no checkout route is enabled, no account/provider end-to-end test was possible, and no automatic split, payout, hold or refund is claimed. User confirmed credentials/platform access are not yet available.
- Earlier manual commission snapshots are retained as legacy examples. The UI is read-only and default HTTP mutations return 409. Historical workflow regression tests explicitly opt in to legacy writes on isolated servers.
- All 36 backend cases, TypeScript, Oxlint and production build pass. Isolated migration preserves every prior row/count and supports persisted Wi-Fi. Hidden Edge acceptance passes pricing previews, manual Wi-Fi, board totals/reload, legacy read-only controls, mobile width and privacy. One exact-label selector was corrected before the complete browser rerun. No real money or live gateway was tested.
- Weekly check-ins/expiry, bedspaces, tenant combined bills, recurring generation, submeter calculations, contracts, refunds and paid featured listings remain proposed. Existing public occupancy/filter behavior is preserved. Canva changes have their own preview approval/save state; do not infer saved status from this code delivery.

## Overview
Tracks dated milestone status, prototype readiness, and verified acceptance gates for SilidSmart.

## Five-unit pitch profile — November 20, 2026

- Added opt-in `npm run seed:pitch`: a dedicated fictional owner/property, exactly five whole units, a PHP 99 proposed plan, private rent and Electricity/Water examples, four short-stay rows with source/cancellation exclusions, and a previous-month PHP 500 statement with a clearly labelled sample remittance Under review. Core product/payment scope is unchanged; the ordinary base seed is unchanged.
- Loaded the profile locally after a native SQLite backup. Every pre-existing row was compared with the backup and preserved. Live proxy login works; PITCH 01 is still Vacant, electricity still Due and the statement still Under review with PHP 500 outstanding. Browser rehearsal mutations were isolated in memory and did not consume the live starting state.
- Normal reruns preserve progress. Explicit `--restore` restores only the guarded pitch fixtures, with backup and protection for unexpected extra inventory. Global admin reset removes this opt-in profile; rerunning the seed safely rebuilds it and reattaches the preserved demo account.
- All 31 backend cases pass. Hidden Edge rehearsed the manual owner login, five-unit view, vacancy/occupied modes, rent/utility updates, fee exclusions and sample staff verification, plus public privacy/mobile width. One navigation selector was corrected to include its count badge; full rerun passed. Frontend source/build was unchanged, so existing compilation evidence is inherited rather than rerun. [Pitch walkthrough](PITCH_DEMO.md#five-seeded-pitch-examples) and a visually reviewed two-page external run card give five examples and five-member speaking handoffs. No Canva changes were required.

## Current monthly commission and meeting scope — November 20, 2026

- Added fixed monthly commission statements for completed checkout months, due next month's 10th. Only Completed + SilidSmart short-stay rent contributes 5%, summed after per-stay centavo rounding. Long-term rent/utilities have no commission, and subscription charges remain separate. Optional same-unit inquiry links support traceability; owner-declared completion/source/rent are not independently verified.
- Owners report exact external Bank transfer/GCash remittance. Staff returns an unmatched report or records actual receipt confirmation, date and note. Pending reports stay outstanding; verified reports clear the statement balance. No gateway, automatic deduction, collection destination, provider verification or live transfer is configured.
- Issued months prevent new stays/status changes. Admin void/reissue preserves unpaid correction versions; pending/verified remittances block voiding. Rejected attempts remain visible. Verified periods stay locked. Partial/combined payments, refunds and automatic statement dispatch remain outside scope.
- Backend checks pass 27/27; strict TypeScript, Vite and Oxlint checks pass. Isolated hidden Edge owner/admin workflow and desktop/mobile checks passed, with two harness selectors corrected. Disposable pre-existing DB migration/reopen preserves all prior columns/rows and new remittance records, applies 005 once and leaves the original DB unchanged. See [testing](TESTING.md) and the task evidence receipt for revision identity and final checks.
- Updated the five external meeting guides (Word and Markdown) to align fees, monthly collection, visibility, owner-only utilities and payment limits. They include official pricing/monthly-invoice evidence and the UHome/utility-system fact checks. Word outputs render as 1/2/4/4/3 pages and every page was visually reviewed. Canva changes have a separate preview/save approval state; consult the turn handoff rather than assuming a draft was saved.
- Additional stakeholder clarification: tenant access to combined rent-plus-utilities bills and owner payment QR would be new scope. Current Electricity/Water bills remain private to owners; Internet bills, tenant billing access and recurring rent generation are not implemented. Utility management is not a unique invention. Pay the owner or authorized manager according to the property's confirmed instructions.

## Current directory and utility scope — November 20, 2026

- Added owner Directory settings for publication and optional expected availability. Available now excludes occupied units; All published units retains published occupied specifications/status and owner estimates. Hidden units stay hidden. Occupancy changes preserve publication and clear the estimate when marked Vacant; dates never automatically change status. Occupied-unit viewing requests remain blocked.
- Added a private Utility Tracker for Electricity/Water bills by unit/month, centavo amounts, due dates, manual Paid/Due/Overdue status, conditional payment dates/references, bill corrections and month/status filters. Duplicate bill identity is prevented. Utilities never enter the 5% accommodation-rent commission base, and no payment/provider verification or collection is introduced.
- Migration 004 preserves existing records/publication. Backend integration checks pass 21/21, TypeScript/Vite/Oxlint pass, and an upgrade/reopen check on an isolated legacy database copy preserves prior records and short-stay fees. Browser checks passed directory settings, scope switching, blocked occupied requests, utility add/duplicate/edit/Paid/filter/reload, mobile width, sign-out privacy and hiding an occupied unit. Initial browser-selector mismatches were corrected; no real demo records were changed by tests.
- Canonical API, privacy, database, architecture and pitch-demo guidance reflect this behavior. Existing external Word/Canva materials were not edited in this system-only request; use Available now for the established vacancy-exclusion demonstration.

## Current pricing and short-stay scope — November 20, 2026

- Owner plans now calculate 1–4 units Free, 5–10 PHP 99/month, 11–25 PHP 199, 26–50 PHP 349, custom above 50. Zero units has no monthly charge. Registration, owner pricing, and admin subscription estimates use these boundaries; core tools are shared across tiers.
- Added a private owner ledger for completed short stays: dates, guest, rent subtotal and owner-reported source. The backend calculates 5% on completed SilidSmart-sourced entries on every tier; cancelled/other-source entries calculate zero. Versioned migration 003 preserves existing inventory.
- At the initial pricing checkpoint, commission statements and remittance review were deferred; the newer monthly commission section above supersedes that boundary. No gateway, date reservation, overlap checking or automatic occupancy change exists. Owner-reported calculations and sample reviewed transfers are not evidence of collected business revenue.
- Fresh backend integration checks pass 18/18 on isolated in-memory SQLite; strict frontend TypeScript, Vite build and Oxlint pass. The initial sandbox loopback EACCES was resolved by a permitted test rerun. An isolated hidden Edge check passes owner pricing, fee preview/save/cancellation, reload persistence, mobile overflow, sign-out privacy and admin proposed-plan labeling. Migration on a separate copy of the existing database preserves inventory/accounts and persists stays across service reopening; the original database was untouched. The five requested guides were rebuilt and all 13 rendered pages visually reviewed (1/2/4/4/2 pages). No production billing or live payment was tested or introduced.

## Current pitch scope — November 18, 2026

The user confirmed this is a prototype for the Saturday, November 21 pitch, not a complete production system. Scope is a clear demonstration of renter discovery, role-specific workspaces, and example UST/QC rental maps.

- Removed the notice/utility strip from the navigation. Prototype labeling stays beside the map and in the footer.
- Guests and renters see rental discovery; landlords see their own portfolio; administrators see moderation. The prototype keeps explicit example account shortcuts for presenting each role.
- Added interactive UST/Sampaloc and QC scopes with six and three sample vacant units respectively. Price markers open rental details and share filters/counts with listing cards.
- Added prototype cookie sessions and API access checks, account-owned inquiries, and a versioned map/account migration. These demonstrate access boundaries; they do not establish production readiness.
- Backend verification: `npm test`, 15/15 tests pass against isolated in-memory SQLite. Frontend strict build and lint pass. Browser interactions verify all three example roles, sign-out, reload restoration, QC scope switching, and marker-to-detail navigation. A full desktop/mobile visual sweep remains unverified because the embedded preview constrained its viewport.
- No deployment or new external service registration was requested. See [pitch walkthrough](PITCH_DEMO.md) for the local demo.

## Historical assessment — November 14, 2026

The following milestone record predates the user's prototype clarification and is not a claim of production readiness.

### Project Status
- **Current Milestone**: Full-Stack B2B2C Rental Management Platform (Booking.com Blue UI + Strict Role-Scoped SQLite API)
- **Quality Gates**: PASS (TypeScript strict build `0` errors, Oxlint `0` warnings/`0` errors, Backend API & Privacy Guardrail Tests `8/8` PASS, Live Proxy HTTP 200 & Validation 400 checks PASS)
- **Last Verified Date**: 2026-11-14

## Component Readiness
| Component | Status | Verification Basis |
|---|---|---|
| Anti-AI & Booking.com Blue Design System | Production-Grade | Codified in `.agents/rules/ux-ui-design-rules.md`; `Plus Jakarta Sans` + `JetBrains Mono` (`tabular-nums`), concentric `4px`/`6px` radii, unified hairline KPI ledger strips (`.ledger-kpi-strip`), un-boxed canvas headers, zero `<Sparkles />` or `backdrop-filter: blur` |
| Side-by-Side Unit Comparison Engine | Complete & Live | `CustomerView.tsx` floating comparison dock & 3-unit side-by-side matrix (rent, deposit, owner ID status, district, amenities, house rules, freshness) |
| BMC Outreach Channel Kit (QR Poster & FB Share) | Complete & Live | `OwnerView.tsx` printable Property Gate QR Poster + auto-synced Facebook & Community Group vacancy post generator + 1-click Inquiry-to-Move-In conversion |
| SQLite Relational Database & Migration Engine | Complete & Live | `backend/migrations/001_initial_b2b2c_schema.sql` (`node:sqlite` `DatabaseSync`), foreign key constraints, indexes, and canonical BMC seed data (`backend/src/seed.mjs`) |
| Backend REST API, Onboarding & Privacy Guardrails | Complete & Live | `backend/src/server.mjs` & `backend/src/service.mjs` on port `4000`, including `POST /api/owners/onboard`, zero tenant PII leakage on `/api/public/listings`, and atomic vacancy sync |
| Frontend-to-Backend Persistence | Complete & Live | `frontend/src/App.tsx` fetches strictly role-scoped endpoints (`/api/public/workspace`, `/api/owner/:ownerId/workspace`, `/api/bootstrap`) with explicit loading, error/retry, and action-error states (zero silent seed fallback) |
| Authentication & Live Owner Registration | Complete & Live | `AuthModal.tsx` with Sign In/Sign Up, 1-click test personas, live BMC tier calculator, and SQLite owner onboarding persistence |
| Automated Testing & Linting | Passing | `backend`: `npm test` (`8/8` integration, role-isolation, onboarding & privacy tests in `476ms`); `frontend`: `tsc -b && vite build` (`0` errors) + `oxlint` (`0` warnings / `0` errors) |
| BMC Disclaimers & Compliance | Verified | All 4 mandatory BMC disclaimers, counting rules (`1 room or 1 apartment = 1 count`), and native UTF-8 `₱` currency encoding verified |
