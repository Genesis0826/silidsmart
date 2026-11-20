# Testing Strategy & Verification Suite

## Commission pilot acceptance November 20 2026

The 36-case suite includes new free-management boundaries, 3%/5%/zero hypothetical fees, currency and night-count validation, disabled payment readiness, secret redaction, test-only v2 adapter responses, reconciled monthly board values, private persisted Wi-Fi, unchanged ledgers after quoting and default HTTP legacy-write rejection. Historical commission tests explicitly opt into the archived contract on isolated servers. TypeScript, Oxlint and production Vite build pass.

Hidden Edge checks use isolated fixtures, not the live database: free owner header, fee/channel previews, unavailable checkout, Wi-Fi creation/reload, combined totals, legacy read-only controls, mobile overflow and sign-out/public privacy. A consistent live-data backup was migrated on a copy and all previous rows/counts compared before Wi-Fi persistence testing. Provider sandbox/live acceptance has not been run; injected adapter responses do not establish a working PayMongo account.

## Overview
Documents the automated test suite, frontend static checks, and live proxy smoke checks for SilidSmart.

## Automated Checks

1. **Backend Integration, Role-Isolation & Privacy Guardrail Suite (`backend/tests/api.test.mjs`)**
   Uses Node.js built-in test runner against an isolated `:memory:` SQLite database (`createSilidSmartService(':memory:')`) so dev database state is untouched:
   ```bash
   cd backend && npm test
   ```
   - **Test 1**: Subscription boundaries at 0, 1, 4, 5, 10, 11, 25, 26, 50, and 51 units (`1–4: Free`, `5–10: ₱99`, `11–25: ₱199`, `26–50: ₱349`, `>50: Custom Quote`) and `1 room or 1 apartment = 1 count`.
   - **Test 2**: Public Directory API (`GET /api/public/listings`) returns only `Vacant` published units, leaks zero tenant PII (`tenants` / `rent_records`), and includes all mandatory disclaimers.
   - **Test 3**: Atomic 1-Click Vacancy Sync (`PATCH /api/owner/units/:id/occupancy`) marks `unit-2` `Occupied`, creates private tenant + rent ledger rows, and immediately removes `unit-2` from public search.
   - **Test 4**: Input validation rejects invalid enum payloads with `400 INVALID_OCCUPANCY_STATUS`.
   - **Test 5**: End-to-end viewing inquiry submission (`POST /api/public/inquiries`), Admin ID review (`PATCH /api/admin/owners/:ownerId/id-review`), and seed reset (`POST /api/system/reset`).
   - **Test 6**: Assisted Owner Onboarding (`POST /api/owners/onboard`) creates a new owner (`Pending review`), property, and starter vacant units visible in public search.
   - **Test 7**: Public Workspace (`GET /api/public/workspace`) omits `tenants`, `rentRecords`, `listingReports`, `systemEvents`, `Occupied` units, and owner `contactMethod`/`idDocumentName`.
   - **Test 8**: Owner-Scoped Workspace (`GET /api/owner/:ownerId/workspace`) isolates each landlord's properties/units/tenants/rent records/inquiries and returns `403 PORTFOLIO_FORBIDDEN` for another portfolio.

2. **Frontend TypeScript Strict Build & Linting (`frontend/`)**
   ```bash
   cd frontend && npm run build && npx oxlint
   ```
   - Verifies strict `tsc -b` compilation, Vite production bundling, and `oxlint` rules (including `react(set-state-in-effect)` and `react(purity)`).

3. **Live Vite Proxy Smoke Verification (with backend `:4000` & frontend `:5173` running)**
   - Verify `GET /api/health`, `GET /api/public/workspace`, `GET /api/owner/owner-1/workspace`, and `GET /api/bootstrap` through `http://localhost:5173/api/*`.
   - Confirm invalid enum mutation returns `400`, occupancy toggle hides vacant unit from `/api/public/workspace`, and `POST /api/system/reset` restores canonical seed state.

## November 18 pitch prototype verification

`cd backend && npm test` now executes 15 integration tests against isolated SQLite memory state. Added checks cover guest denials, wrong-role denials, cross-portfolio mutations, restricted mutation responses, account-owned inquiries despite shared contact information or forged IDs, password validation, logout invalidation, UST/QC map data, and transactional onboarding rollback.

The existing tests now authenticate through the session API and expect nine seed vacancies (six UST, three QC), and owner-directory responses containing only the active landlord. Direct requests to unrelated owner IDs return 403.

Manual local browser checks cover guest navigation, all three example role logins, landlord portfolio visibility, renter-only navigation, session restoration on reload, sign-out, QC scope switching, price marker popups, and opening rental details from a popup. Desktop viewport emulation was unavailable in the constrained embedded preview; do not count a full desktop/mobile layout sweep as verified. Map street tiles and external photos require network access; the interface keeps listing details and displays an explicit map error if tiles fail.

## November 20 pricing and short-stay checks

The pricing/short-stay checkpoint had 18 tests. Tests 16–18 verify a PHP 1,500 stay yields PHP 75 at a server-enforced 5%, centavo rounding, source and cancellation/restoration rules, persisted workspace reloads, invalid dates/rent/source/status, no occupancy/monthly-ledger side effects, public privacy, guest/renter denial, cross-owner isolation, and the same fee for a three-unit Free owner. These are manual record/calculation checks, not payment collection or production billing evidence.

## November 20 directory and utility checks

The current suite has 21 tests. Tests 19–21 cover Available now versus All published units, owner publication/expected dates, no automatic vacancy or republishing of hidden units, occupied-unit inquiry denial, invalid filters/dates/publication, utility centavos and duplicate identity, payment field validation/correction, reload persistence, no rent/short-stay side effects, public privacy, cross-owner/role/guest denial and reset cleanup. The schema upgrade is additionally checked on a disposable copy of the pre-existing database; it must retain old rows/publication and legacy short-stay fees, apply once, and retain utility/directory updates across reopening.

## Five-unit pitch fixture checks — November 20

`npm test` discovers three files and 31 cases. The four opt-in fixture cases verify exactly five whole units, a PHP 99 plan, private rent/utility rows, PHP 10,000 eligible rent and PHP 500 pending commission, unchanged existing portfolios, retry preservation, scoped restore, protection of unexpected inventory, rebuild/account reattachment after global reset, HTTP login/portfolio isolation, public privacy and native SQLite backup through an isolated CLI database. The ordinary seed remains unchanged; no frontend feature/build change is introduced by these fixtures. Runtime demo data and generated manifest/backups are ignored by Git.

## November 20 monthly commission verification

`cd backend && npm test` now discovers both test files: 27 checks total (21 existing + 6 monthly commission cases). The new suite uses independent in-memory databases and authenticated HTTP sessions. It reconciles PHP 10,000 rent to PHP 500, two PHP 0.10 lines to PHP 0.02 in fees (line rounding), source/cancellation exclusions, checkout cohort/year rollover, zero months, invalid/current/future periods and future completed stays. It checks retry-safe issue, period locks, exact transfer precision/amount, normalized duplicate references, pending balances, staff-only receipt confirmation, rejected/resubmitted attempt history, versioned unpaid void/reissue, settled locks, same-unit inquiry links, wrong-role/cross-owner/public privacy and reset ordering.

Hidden Edge checks cover UI stay creation, issue/due date, external report, reload persistence, staff return, owner resubmission, staff verification/zero outstanding, locked actions, sign-out privacy, mobile page width and page errors. Exact-label/text selector mismatches were corrected in the harness; subsequent checks passed. Schema upgrade/reopen on a disposable existing-database copy preserves prior rows/columns and verified remittance records, applies once and leaves the original hash unchanged. Tests neither transfer funds nor validate a live bank/provider integration. Task-local evidence: `../document_work/monthly_commissions/` relative to the repository parent (`D:/Techno/document_work/monthly_commissions` in this workspace).
