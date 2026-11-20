# Testing Strategy & Verification Suite

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
