# SilidSmart.ph — B2B2C Rental Management & Public Room Directory

SilidSmart is a mobile-first B2B2C SaaS rental operations platform and public room/apartment discovery portal tailored for small landlords (boarding houses, dormitories, and small apartments) and free-browsing renters in the Philippines.

This is a **pitch prototype for Saturday, November 21, 2026**. Accounts, properties, prices, and map pins are examples for demonstrating the concept. See [the short pitch walkthrough](docs/PITCH_DEMO.md).

---

## Core B2B2C Ecosystem

1. **Public Renter Directory (`CustomerView`) — ₱0 Renter Fee**
   - Interactive UST/Sampaloc and Quezon City map scopes with rent markers linked to rental details.
   - Faceted search and sorting across vacant, published units by district, property type, monthly rent ceiling, amenities, and owner identity check status.
   - Side-by-side comparison engine (up to `3` units) comparing rent, deposit, rules, amenities, freshness stamps, and owner ID review badges.
   - Zero-commission viewing inquiry submission, status tracker, and listing discrepancy flagging.
2. **Private Owner Operations (`OwnerView`) — Single-Entry Vacancy Sync**
   - Manage room/unit inventory (`1 room or 1 apartment = 1 count`), toggle occupancy (`Vacant` / `Occupied`), and record move-in tenants and rent payment statuses (`Paid`, `Due`, `Overdue`).
   - Marking a unit `Occupied` atomically hides it from public search and creates private tenant + rent ledger rows; marking `Vacant` republishes it immediately.
   - Generate printable property gate QR posters and auto-synced Facebook & community group vacancy posts (`QR Poster & FB Share` tab).
   - Proposed monthly subscriptions (`1–4: Free`, `5–10: ₱99/mo`, `11–25: ₱199/mo`, `26–50: ₱349/mo`, `>50: Custom Quote`). All tiers share core management tools; an empty portfolio has no monthly charge.
   - Private **Short Stays & Commission** ledger: owners record completed stays and accommodation rent; SilidSmart-sourced stays calculate a separate **5% owner-paid commission** on every plan. Other-source/cancelled stays have no commission. Entries do not reserve dates or change occupancy.
   - **No payment processing:** rent, subscriptions, and commissions are not collected, deducted, remitted, or verified by the prototype. Ledger amounts are owner-reported calculations, not collected revenue.
3. **Platform Governance & Privacy Audit (`AdminView`)**
   - Manual review of landlord government ID submissions (`Pending review`, `ID reviewed`, `Needs correction`).
   - Listing discrepancy moderation, force publish/delist controls, live system telemetry log, and public/private payload isolation inspection.

---

## Tech Stack & Repository Layout

- **Frontend (`frontend/`)**: React `19.3`, TypeScript, Vite `8.3` (`http://localhost:5173`) with `/api` proxy to `http://localhost:4000`, `lucide-react`, and Oxlint (`1.90`).
- **Backend (`backend/`)**: Zero-dependency Node.js (`v22+`) HTTP REST API (`src/server.mjs`) + domain service (`src/service.mjs`) + built-in `node:sqlite` relational storage (`data/silidsmart.sqlite`) initialized from [001_initial_b2b2c_schema.sql](backend/migrations/001_initial_b2b2c_schema.sql).
- **Canonical Docs (`docs/`)**: Requirements, architecture, API, database, security, testing, setup, and project memory.

---

## Quick Start

### Prerequisites
- Node.js `v22+` (provides built-in `node:sqlite` `DatabaseSync` and `node --test`)

### 1. Start the Backend SQLite API (`:4000`)
```bash
cd backend
npm start
```

### 2. Start the Frontend Dev Server (`:5173`)
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173/` in a browser. The UI loads session-authorized workspaces directly from the SQLite backend (`GET /api/public/workspace` for Renters, `GET /api/owner/:ownerId/workspace` for Owners, `GET /api/bootstrap` for Admin) and shows explicit error/retry states if the API is stopped—no silent mock fallbacks are substituted.

### Demo Sign-In Personas (`AuthModal`)
Use **Sign in → Example accounts**. Only the selected account's workspace appears in navigation; sign out to preview another role. The notice strip has been removed from navigation; sample-data labeling remains beside the map and in the footer.

| Role | Name | Notes |
|---|---|---|
| Renter (Free) | Juan Dela Cruz | Public directory browsing & viewing requests |
| Landlord (Owner) | Maria Santos | Manages `owner-1` portfolio (sample Tier 1 units) |
| Platform Admin | Platform Review Lead | ID verification queue & moderation console |

---

## Verification Commands

```bash
# Backend integration, role-isolation & privacy guardrail suite (18 tests)
cd backend && npm test

# Frontend TypeScript check, production build & Oxlint
cd frontend && npm run build && npx oxlint
```

---

## Documentation Index

| Document | Purpose |
|---|---|
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | Business Model Canvas (BMC) alignment, pricing tiers, and mandatory disclaimers |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Airbnb/Booking.com-to-SilidSmart translation, runtime boundaries, and role-scoped sync |
| [docs/WORKFLOW_TRANSLATION.md](docs/WORKFLOW_TRANSLATION.md) | Detailed workflow mapping from two-sided marketplace mechanics to B2B2C |
| [docs/API.md](docs/API.md) | REST endpoints, error envelope, and public/private serialization rules |
| [docs/DATABASE.md](docs/DATABASE.md) | SQLite schema, foreign keys, indexes, and transactional sync flow |
| [docs/SECURITY.md](docs/SECURITY.md) | Role data isolation, PII stripping, input validation, and trust badge rules |
| [docs/SETUP.md](docs/SETUP.md) | Local development prerequisites, ports, proxy, and troubleshooting |
| [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) | Frontend and backend module breakdown |
| [docs/TESTING.md](docs/TESTING.md) | Automated tests, lint/build checks, and live proxy smoke commands |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Architecture Decision Records (ADRs) |
| [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md) | Latest milestone readiness and verified quality gates |
| [docs/PROJECT_MEMORY.md](docs/PROJECT_MEMORY.md) | Chronological engineering turn records |
