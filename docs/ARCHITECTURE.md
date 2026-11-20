# System Architecture

## Current commission pilot boundary

Free owner management supersedes unit-based subscriptions. MonthlyBillBoard derives a private per-unit/month overview from rent and Electricity/Water/Wi-Fi records. Missing records remain explicit; no provider status is inferred. BusinessModel calls owner-only quote/readiness APIs; all quotes are hypothetical with zero charged.

The server-only PayMongo v2 adapter is not wired into application checkout. Owner routing, tenant-bill authorization, verified provider events, idempotency and reconciliation remain prerequisites. Legacy manual snapshots are preserved, with HTTP mutation disabled by default and a read-only UI. The older payment row below describes historical behavior; [PAYMENT_PILOT.md](PAYMENT_PILOT.md) is the current contract.

## Overview
Defines the system boundaries, Airbnb/Booking.com-to-SilidSmart B2B2C architectural translation, role-scoped data fetching, and runtime data flows.

## Airbnb / Booking.com System Design -> SilidSmart B2B2C Translation

| Airbnb / Booking.com Component | SilidSmart B2B2C Component | Architectural Role |
|---|---|---|
| `UI / APP for Hotel Manager` + `Hotel Service` + `Hotels DB` | **Owner SaaS Operations Portal (`OwnerView`)** + `owners`, `properties`, `units`, `tenants`, `rent_records` tables | Private B2B landlord workspace for room inventory, 1-click vacancy sync, private tenant roster, rent ledger, and QR poster/Facebook group outreach |
| `Kafka Event Stream` + `Search Consumer` | **Vacancy Sync Transaction (`toggleUnitOccupancy`)** + `system_events` telemetry | Atomically updates status, freshness and private tenant/rent rows while preserving owner publication. Available now excludes occupied units; All published units retains published occupied specifications and owner estimates. |
| `UI / APP for Customers` + `Search Service` + `ElasticSearch` | **Public Renter Directory (`CustomerView`)** + `GET /api/public/workspace` & `GET /api/public/listings` | Faceted search by district, property type, budget, and verified owner ID, plus side-by-side unit comparison (`up to 3 units`) with zero tenant PII exposure |
| `Booking Service` + `UI / APP to View Bookings` | **Viewing Inquiry Tracker** (`inquiries` table) | Requests (`Pending` -> `Approved` / `Declined`) and owner move-in conversion. Viewing approval is not a reservation; requests require a vacant published unit. |
| `Payment Service` | **Subscription calculator, short-stay ledger and monthly commission records** | Free for 1–4 units; ₱99 for 5–10, ₱199 for 11–25, ₱349 for 26–50, custom above 50. Only completed owner-reported SilidSmart short stays calculate 5%. Owners report separate external remittance; staff review it. No gateway or automatic money movement. |
| `Trust & Governance Layer` | **Admin Governance Console (`AdminView`)** | Manual government ID verification (`ID reviewed`), renter discrepancy report moderation, and B2B/B2C privacy guardrail audit |

## Runtime Layers & Role-Scoped Boundaries

- **Frontend (`frontend/`)**: React `19.3` + TypeScript + Vite `8.3` (`http://localhost:5173`), proxying `/api/*` to `http://localhost:4000`. Styled with the Proptech Blue & Editorial Stone design system (`#002B66` brand navy, `#0057D9` action blue, `#F5A623` search accent, `#F4F5F7` canvas, `Newsreader` + `Plus Jakarta Sans` + `JetBrains Mono`, unified hairline `.ledger-kpi-strip` KPI bars).
- **Strict Role-Scoped Fetching (`frontend/src/App.tsx`)**:
  - **`renter` role**: Fetches `GET /api/public/workspace?availability=all` for public unit fields and defaults its UI to Available now. Clears tenants, rent, short-stay, utility, moderation and event arrays. Never holds occupant or private financial records in browser state.
  - **`owner` role**: Fetches `GET /api/owner/:ownerId/workspace` so one landlord receives only their own properties, units, tenants, rentRecords, inquiries, shortStays, utilityRecords, commissionStatements and subscription summary.
  - **`admin` role**: Fetches `GET /api/bootstrap` for governance queues, privacy verification, and system event logs.
- **No Silent Mock Fallback Contract**:
  - Frontend domain arrays start empty (`[]`).
  - Failed workspace fetches show an explicit **Backend Service Unavailable** card with a **Retry Connection** action instead of substituting seed data.
  - Failed mutations surface server `error.message` values in a dismissible `.api-error-banner` and keep open modals intact until a `2xx` confirmation arrives.
- **Backend API (`backend/`)**: Zero-dependency Node.js HTTP REST gateway (`src/server.mjs`) and domain service layer (`src/service.mjs`) on port `4000`.
- **Persistence (`backend/data/silidsmart.sqlite`)**: Built-in `node:sqlite` (`DatabaseSync`) relational database initialized via `migrations/001_initial_b2b2c_schema.sql`.

## Directory scopes and utility tracking — November 20, 2026

The public API defaults to `availability=available`; `all` permits published occupied specifications/status and owner-supplied expected availability only. The renter UI loads public `all` data and defaults its visible results/maps to Available now. Publication settings are owner-scoped and independent of occupancy; no estimate automatically changes status. Viewing inquiries still require a vacant published unit at submission.

`UtilityTracker` is a private owner component backed by `utility_records`, separate from monthly rent and short-stay ledgers. It records bills and manual payment fields, with owner-scoped create/correction routes. These records are absent from public/admin bootstrap payloads and cleared from client memory when leaving the owner workspace. No provider, payment processor or new dependency is introduced.

## Monthly commission flow — November 20, 2026

`CommissionStatements` serves owner issue/report screens and admin review/correction screens. Typed callbacks in App own requests and refresh the role workspace. `server.mjs` enforces role/portfolio; `service.mjs` composes the SQLite-backed `commissions.mjs` store. Versioned migration 005 stores fixed monthly snapshots and remittance attempts. One issued owner/month and one active remittance per statement are database constraints, with service validation for money/dates/allowed transitions.

Owners issue closed checkout months, due on next month's 10th. Current month is a preview; no scheduler or automatic messaging is added. Issued periods freeze stay additions/status changes. Unpaid correction requires admin void plus reissue, retaining versions. Submitted external reports remain outstanding until staff verifies actual receipt. Admin bootstrap adds statement snapshots/remittances without guest identity; public scopes omit them and App clears financial state when leaving a role. Rent, subscriptions and utilities stay external/manual; no provider dependency, checkout, payout or automatic deduction exists.
