# System Architecture

## Overview
Defines the system boundaries, Airbnb/Booking.com-to-SilidSmart B2B2C architectural translation, role-scoped data fetching, and runtime data flows.

## Airbnb / Booking.com System Design -> SilidSmart B2B2C Translation

| Airbnb / Booking.com Component | SilidSmart B2B2C Component | Architectural Role |
|---|---|---|
| `UI / APP for Hotel Manager` + `Hotel Service` + `Hotels DB` | **Owner SaaS Operations Portal (`OwnerView`)** + `owners`, `properties`, `units`, `tenants`, `rent_records` tables | Private B2B landlord workspace for room inventory, 1-click vacancy sync, private tenant roster, rent ledger, and QR poster/Facebook group outreach |
| `Kafka Event Stream` + `Search Consumer` | **Real-Time Vacancy Sync Transaction (`toggleUnitOccupancy`)** + `system_events` telemetry | Atomic SQLite transaction updating unit status, public visibility (`published`), freshness timestamp (`last_updated`), and private tenant/rent rows |
| `UI / APP for Customers` + `Search Service` + `ElasticSearch` | **Public Renter Directory (`CustomerView`)** + `GET /api/public/workspace` & `GET /api/public/listings` | Faceted search by district, property type, budget, and verified owner ID, plus side-by-side unit comparison (`up to 3 units`) with zero tenant PII exposure |
| `Booking Service` + `UI / APP to View Bookings` | **Viewing Inquiry & Reservation Tracker** (`inquiries` table) | Renter viewing schedule requests (`Pending` -> `Approved` / `Declined`) and 1-click landlord move-in conversion (`Move In & Mark Occupied`) |
| `Payment Service` | **Flat-Rate SaaS Tier Engine (`calculateBmcSubscriptionTier`)** | Replaces per-booking commissions (`₱0` renter fee) with flat landlord monthly plans (`₱99`, `₱199`, `₱349`, `Custom Quote`) |
| `Trust & Governance Layer` | **Admin Governance Console (`AdminView`)** | Manual government ID verification (`ID reviewed`), renter discrepancy report moderation, and B2B/B2C privacy guardrail audit |

## Runtime Layers & Role-Scoped Boundaries

- **Frontend (`frontend/`)**: React `19.3` + TypeScript + Vite `8.3` (`http://localhost:5173`), proxying `/api/*` to `http://localhost:4000`. Styled with the Proptech Blue & Editorial Stone design system (`#002B66` brand navy, `#0057D9` action blue, `#F5A623` search accent, `#F4F5F7` canvas, `Newsreader` + `Plus Jakarta Sans` + `JetBrains Mono`, unified hairline `.ledger-kpi-strip` KPI bars).
- **Strict Role-Scoped Fetching (`frontend/src/App.tsx`)**:
  - **`renter` role**: Fetches `GET /api/public/workspace` and explicitly clears private arrays (`tenants`, `rentRecords`, `listingReports`, `systemEvents`). Never reads or holds occupant PII in browser state.
  - **`owner` role**: Fetches `GET /api/owner/:ownerId/workspace` so one landlord receives only their own `properties`, `units`, `tenants`, `rentRecords`, `inquiries`, and `subscription` summary.
  - **`admin` role**: Fetches `GET /api/bootstrap` for governance queues, privacy verification, and system event logs.
- **No Silent Mock Fallback Contract**:
  - Frontend domain arrays start empty (`[]`).
  - Failed workspace fetches show an explicit **Backend Service Unavailable** card with a **Retry Connection** action instead of substituting seed data.
  - Failed mutations surface server `error.message` values in a dismissible `.api-error-banner` and keep open modals intact until a `2xx` confirmation arrives.
- **Backend API (`backend/`)**: Zero-dependency Node.js HTTP REST gateway (`src/server.mjs`) and domain service layer (`src/service.mjs`) on port `4000`.
- **Persistence (`backend/data/silidsmart.sqlite`)**: Built-in `node:sqlite` (`DatabaseSync`) relational database initialized via `migrations/001_initial_b2b2c_schema.sql`.
