# Project Memory Architecture

## Overview
Defines conventions for turn logging, progress tracking, and persistent context management.

## Guidelines
- Summarize turns concisely before ending each user turn.
- Track active workstreams: Frontend, Backend, Data, and Documentation.
- Keep secrets, private user data, and raw voluminous transcripts out of shared memory.

---

## Turn Records

### 2026-11-14: Clean Motion System, Operational Toolbars & Portfolio/Marketplace Analytics
- **Accountable Role**: Frontend Engineer / Systems Architect
- **Skills Applied**: `frontend-standards.md`, `rules/ux-ui-design-rules.md`, `architecture-patterns.md`
- **Workstreams**: Tactile Enterprise Motion, Landlord Yield & Operations, Marketplace & Governance Analytics
- **Outcome**:
  1. Added restraint-aligned CSS motion and visual feedback in `frontend/src/index.css`: smooth panel reveals (`.anim-view-enter`), staggered property card entrances (`.anim-stagger-item`), crisp modal transitions (`.modal-overlay` / `.modal-content`), card hover lift & thumbnail zoom, button press micro-feedback, animated horizontal analytics bars (`.bar-track` / `.bar-fill`), and full `prefers-reduced-motion` degradation.
  2. Added Active Filter Chips with 1-click removal in `CustomerView.tsx` so filtering stays transparent and simple.
  3. Built Landlord **Analytics & Yield** (`OwnerView.tsx`) plus operational filters and CSV exports (`frontend/src/utils/exportCsv.ts`): Gross Monthly Potential, Collection Rate & Segmented Bar, Vacant Opportunity Gap, Property-by-Property Yield & Occupancy table, Viewing Inquiry Funnel, unit status/keyword filters, tenant search + Roster CSV export, and rent status filters + Ledger CSV export.
  4. Built Platform Governance **Market & Ops Analytics** (`AdminView.tsx`) plus audit/telemetry controls: Area Corridor Supply & Pricing matrix, Inventory Mix by Property Type (`Boarding house`, `Dorm`, `Apartment`, `Condo`), Landlord ID Trust & SaaS MRR Roll, Privacy Audit status filter + Audit CSV export, and Telemetry Event category/search filter.
- **Verification Receipts**:
  - `cd backend && npm test`: **PASS** (`8/8` tests passed in `446ms`).
  - `cd frontend && npm run build && npx oxlint`: **PASS** (`tsc -b && vite build` in `1.14s`, `0` errors; `oxlint` `0` warnings / `0` errors across `11` files).
  - Live Browser Check (`http://localhost:5173/` at `1280×800`, `60706d1b-e804-447c-a7fe-a2be7bf0c3ae`): **PASS** across Renter Directory filter chips, Landlord Workspace (`Units & Vacancy Sync`, `Analytics & Yield`, `Rent Payment Ledger` CSV export), and Platform Governance (`Est. SaaS MRR` `₱297`, `Market & Ops Analytics`, `Sync Telemetry & Map` filters) with `0` console errors and `0` failed HTTP requests.
- **Next Action / Owner**: Ready on `http://localhost:5173/` for interactive review.

### 2026-11-14: UST Sampaloc Dormitory & Condominium Sample Data Integration & Responsive Verification
- **Accountable Role**: Backend Engineer / Frontend Engineer / Database Administrator
- **Skills Applied**: `backend-standards.md`, `database-standards.md`, `frontend-standards.md`, `testing-standards.md`, `rules/ux-ui-design-rules.md`
- **Workstreams**: Domain Seed Data (UST Sampaloc, Manila), Schema Evolution (`Condo` PropertyType), Filter Range Calibration, Responsive UI Verification
- **Outcome**:
  1. Expanded schema (`backend/migrations/001_initial_b2b2c_schema.sql`), backend validation (`backend/src/service.mjs`), and frontend types/filters (`frontend/src/types.ts`, `frontend/src/components/CustomerView.tsx`, `frontend/src/components/RoleSwitcher.tsx`) to support **`Condo`** alongside `'Boarding house'`, `'Dorm'`, and `'Apartment'`.
  2. Populated `backend/src/seed.mjs` with realistic **University of Santo Tomas (UST) / Sampaloc, Manila** rental sample properties and units across **P. Noval St.**, **España Blvd.**, **A.H. Lacson Ave.**, and **Dapitan St. / Dos Castillas St.** (₱4,200/mo student bedspaces to ₱21,000/mo furnished España condo studios/1-BR), preserving strict `"Concept prototype - sample properties only"` disclaimers, `'Owner ID reviewed'` safety notices, and private tenant/rent isolation.
  3. Calibrated the renter budget slider (`₱3,000`–`₱30,000`, default ceiling `₱30,000`) and search budget dropdown in `CustomerView.tsx` so both student bedspaces/dorms and UST condo studios appear on initial load, and aligned amenity strings (`Wi-Fi`, `Sub-meter`, `Study`, `Kitchen`) with Popular Room Feature facet matching.
  4. Recreated `backend/data/silidsmart.sqlite` cleanly against the updated schema and updated `backend/tests/api.test.mjs` (`6` vacant seed units out of `13` total, including `'Condo'` onboarding verification).
- **Verification Receipts**:
  - `cd backend && npm test`: **PASS** (`8/8` tests passed).
  - `cd frontend && npm run build && npx oxlint`: **PASS** (`tsc -b && vite build` in `2.54s`, `0` warnings / `0` errors).
  - Live proxy check (`http://localhost:5173/api/public/workspace`): **PASS** (`6` vacant published units across `5` UST Sampaloc properties).
- **Next Action / Owner**: Live browser visual inspection of UST listings and `390x844` mobile layout before final handoff.

### 2026-11-14: Comprehensive Project & Canonical Documentation Update
- **Accountable Role**: Technical Writer / Systems Architect
- **Skills Applied**: `documentation-standards.md`, `architecture-patterns.md`, `security-standards.md`, `testing-standards.md`
- **Workstreams**: Root `README.md`, Canonical `docs/` Alignment (`ARCHITECTURE.md`, `SECURITY.md`, `TESTING.md`, `SETUP.md`, `IMPLEMENTATION.md`, `DECISIONS.md`)
- **Outcome**:
  1. Created top-level [README.md](file:///c:/Users/Adrian/projects/silidsmart/README.md) with project overview, B2B2C workflow summary, tech stack (`React 19.3`, `Vite 8.3`, `Node.js v22+`, `node:sqlite`), Quick Start, demo personas, verification commands, and canonical `docs/` index.
  2. Updated [docs/ARCHITECTURE.md](file:///c:/Users/Adrian/projects/silidsmart/docs/ARCHITECTURE.md), [docs/SECURITY.md](file:///c:/Users/Adrian/projects/silidsmart/docs/SECURITY.md), [docs/TESTING.md](file:///c:/Users/Adrian/projects/silidsmart/docs/TESTING.md), [docs/SETUP.md](file:///c:/Users/Adrian/projects/silidsmart/docs/SETUP.md), [docs/IMPLEMENTATION.md](file:///c:/Users/Adrian/projects/silidsmart/docs/IMPLEMENTATION.md), and [docs/DECISIONS.md](file:///c:/Users/Adrian/projects/silidsmart/docs/DECISIONS.md) (added ADR-002, ADR-003, ADR-004) to match the verified role-scoped full-stack implementation with zero stale stubs.
- **Verification Receipts**: All documented endpoints, file paths, versions, and test commands cross-checked directly against `backend/package.json`, `frontend/package.json`, `frontend/src/index.css`, and prior verified test runs (`backend npm test` `8/8`, `frontend npm run build && npx oxlint` `0` errors/`0` warnings).
- **Next Action / Owner**: Documentation suite ready for capstone/engineering review and contributor onboarding.

### 2026-11-14: Role-Scoped Backend Integration, Defensible Error States & UI Consistency Polish
- **Accountable Role**: Frontend Engineer / Backend Engineer / Systems Architect
- **Skills Applied**: `frontend-standards.md`, `backend-standards.md`, `security-standards.md`, `testing-standards.md`, `documentation-standards.md`, `rules/ux-ui-design-rules.md`
- **Workstreams**: B2B2C Role Data Isolation, Strict Frontend-Backend Error & Loading Contracts, UI Polish & Dynamic Dates
- **Outcome**:
  1. **Role-Scoped B2B2C Endpoints (`backend/src/service.mjs`, `backend/src/server.mjs`)**:
     - Added `GET /api/public/workspace` returning only sanitized owner display directory fields, properties, `Vacant` + `published` units, and inquiries — zero `tenants`, `rentRecords`, `listingReports`, `systemEvents`, or `Occupied` units.
     - Added `GET /api/owner/:ownerId/workspace` enforcing strict landlord isolation across `properties`, `units`, `tenants`, `rentRecords`, `inquiries`, and `subscription` (`404 OWNER_NOT_FOUND` for unknown owners).
     - Replaced hardcoded `'2026-11-07'` / `'November 2026'` / `'2026-11-15'` write timestamps with runtime date helpers (`todayIso`, `defaultMoveInIso`, `currentMonthLabel`, `nowTimestamp`).
  2. **Defensible Frontend-Backend Integration (`frontend/src/App.tsx`)**:
     - Removed silent mock fallback initialization (`initialOwners`, `initialUnits`, `initialTenants`, etc.) and silent `.catch(() => {})` swallowing.
     - Scoped client fetches strictly to the active role (`renter` → `/api/public/workspace`, `owner` → `/api/owner/:ownerId/workspace`, `admin` → `/api/bootstrap`) and explicitly cleared private role arrays on public views.
     - Implemented derived loading state, explicit **Backend Service Unavailable** panel with **Retry Connection** button on connectivity failure, and dismissible **Action Error** alert banners (`4xx`/`5xx`/network errors) surfaced before closing modals or showing confirmation banners (`CustomerView.tsx`, `OwnerView.tsx`, `AuthModal.tsx`).
  3. **UI & Functional Bug Fixes (`OwnerView.tsx`, `CustomerView.tsx`, `AdminView.tsx`, `index.css`)**:
     - Fixed `OwnerView` Add Unit property pre-selection using derived `effectivePropertyId` scoped to `ownerProperties`.
     - Fixed wrapped `.ledger-kpi-strip` dividers (`gap: 1px` hairline layout with `#FFFFFF` cells), added image `onError` SVG fallbacks in `CustomerView.tsx`, unified Compact Grid cards with `.editorial-heading` + `.mono-num`, and removed thick colored `borderLeft` edges in `AdminView.tsx`.
- **Verification Receipts**:
  - `cd backend && npm test`: **PASS** (`8/8` integration, onboarding, privacy guardrail, and role-scoped workspace isolation tests passed in `475.55ms`).
  - `cd frontend && npm run build && npx oxlint`: **PASS** (`tsc -b && vite build` in `1.62s`, `0` errors; `oxlint` `0` warnings / `0` errors across `10` files).
  - Live Proxy Smoke Checks (`http://localhost:5173/api/*` proxied to `http://localhost:4000`): **PASS** (`health: 200`, `public/workspace: 200` with zero tenant/rent fields, `owner-1/workspace: 200`, `PATCH occupancy -> Occupied` delisted `unit-2` immediately, invalid state returned `400 INVALID_OCCUPANCY_STATUS`, `POST /api/system/reset` restored `5` public vacant units).
- **Next Action / Owner**: Backend (`http://localhost:4000`) and Frontend (`http://localhost:5173`) daemons are running live for user verification.

### 2026-11-07: Internet Extraction of Anti-AI UI Design Principles & Full Frontend De-Slop Audit
- **Accountable Role**: Frontend Engineer / Systems Architect
- **Skills Applied**: `rules/ux-ui-design-rules.md`, `frontend-standards.md`, `architecture-patterns.md`
- **Workstreams**: Web Research (Anti-AI / Anti-Vibe-Coded UI Design), Design System Rules, Frontend De-Slop Refactoring
- **Outcome**:
  1. Extracted the **7 Telltale Signs of AI-Generated / Vibe-Coded UI** from web design research (`developersdigest.tech`, `muz.li`, `saasui.design`, `creativebloq.com`) and codified them into [.agents/rules/ux-ui-design-rules.md](file:///c:/Users/Adrian/projects/silidsmart/.agents/rules/ux-ui-design-rules.md).
  2. Audited and refactored `silidsmart/frontend/` against every extracted Anti-AI rule:
     - **Typography (`index.html` & `index.css`)**: Replaced default system sans-serif and `<title>frontend</title>` with **Plus Jakarta Sans** + **JetBrains Mono** (`.mono-num` with `font-variant-numeric: tabular-nums` for `₱` prices, counts, and timestamps).
     - **Killed Card-Grid Monotony & Colored-Edge Border Trick (`OwnerView.tsx` & `AdminView.tsx`)**: Removed the 4-card and 6-card floating KPI grids and `borderTop: '4px solid'` header boxes; replaced them with un-boxed editorial canvas headers and a **Unified Architectural Ledger Strip (`.ledger-kpi-strip` & `.ledger-kpi-cell`)** separated by `1px` vertical hairlines.
     - **Removed Sparkle Icons, Badge Stacking & Glassmorphism (`AuthModal.tsx`, `OwnerView.tsx`, `AdminView.tsx`, `index.css`)**: Replaced `<Sparkles />` with `<KeyRound />`, stripped redundant decorative badges above headings, and removed `backdrop-filter: blur(2px)` from `.modal-overlay`.
     - **Concentric Border Radii (`RoleSwitcher.tsx` & `index.css`)**: Replaced bubbly `9999px` pill buttons in the top navigation bar with a crisp `4px`/`6px` concentric segmented control bar.
- **Verification Receipts**:
  - `cd frontend && npm run build && npx oxlint`: **PASS** (`tsc -b && vite build` in `1.57s`, `0` errors; `oxlint` `0` warnings / `0` errors across `10` files; bundle reduced to `377.46 kB` after stripping decorative icon soup and redundant wrappers).
  - `cd backend && npm test`: **PASS** (`6/6` integration tests passed in `395ms`).
  - Editorial & Utilitarian Typography (`Newsreader` + `Plus Jakarta Sans` + `JetBrains Mono`) applied across masthead, hero, property cards, and workspace headers.
- **Next Action / Owner**: Anti-AI refactored UI is live at `http://localhost:5173/`.

### 2026-11-07: Side-by-Side Unit Comparison, BMC Outreach Channel Kit (QR Poster + FB Share), Inquiry-to-Move-In Conversion & Live Owner Onboarding
- **Accountable Role**: Frontend Engineer / Backend Engineer / Systems Architect
- **Skills Applied**: `frontend-standards.md`, `backend-standards.md`, `database-standards.md`, `security-standards.md`, `testing-standards.md`, `documentation-standards.md`
- **Workstreams**: Renter Comparison Engine, Landlord BMC Channels (QR Poster & Community Groups), Backend Owner Onboarding (`POST /api/owners/onboard`), Canonical Documentation
- **Outcome**:
  1. Built the **Side-by-Side Room & Apartment Comparison Engine** in `CustomerView.tsx` (fulfilling BMC Value Proposition #2: *"Renters compare price, rules, amenities, location, and owner identity check status"*):
     - Added `+ Compare Unit` toggle buttons to both horizontal list and compact grid property cards.
     - Built a floating Prussian Blue comparison dock (`Compare Units (n/3)`) and a full side-by-side comparison matrix modal comparing monthly rent, deposit, owner ID verification status, district/address, amenities, house rules, and freshness timestamps.
  2. Upgraded `OwnerView.tsx` with **1-Click Inquiry-to-Move-In Conversion** and the **BMC Outreach Channels Kit (`QR Poster & FB Share` tab)**:
     - Added `Move In & Mark Occupied` on viewing inquiries so owners can convert a prospective renter's inquiry into an occupied room, private tenant record, and rent ledger row in one click.
     - Built the printable **Property Gate QR Poster** preview card and **Facebook & Community Group Vacancy Post Generator** with 1-click clipboard copy (fulfilling BMC Channels: *"Facebook and community groups"* & *"Owner referrals and property QR posters"*).
  3. Added `POST /api/owners/onboard` to `backend/src/service.mjs` and `backend/src/server.mjs` and wired `AuthModal.tsx` + `App.tsx` so registering a new landlord persists their Owner profile (`Pending review`), Property, and starter Vacant Units directly to SQLite.
  4. Completed canonical documentation in `docs/REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/TESTING.md`, and `docs/CURRENT_STATE.md`.
- **Verification Receipts**:
  - `cd backend && npm test`: **PASS** (`6/6` integration, privacy guardrail, vacancy sync, and owner onboarding tests passed in `385ms`).
  - `cd frontend && npm run build && npx oxlint`: **PASS** (`tsc -b && vite build` in `1.59s`, `0` errors; `oxlint` `0` warnings / `0` errors across `10` files).
  - Live Backend Restart (`task-840`) & Proxy Health Check: `http://localhost:4000/api/health` (`ok`) and `http://localhost:5173/api/health` (`ok`).
- **Next Action / Owner**: Full-stack application is live on `http://localhost:5173/` and `http://localhost:4000/` for interactive user exploration.

### 2026-11-07: Full-Stack Backend API Gateway, SQLite Relational Database & End-to-End Persistence
- **Accountable Role**: Backend Engineer / Systems Architect (with Database Administrator & Security Engineer supporting skills)
- **Skills Applied**: `backend-standards.md`, `database-standards.md`, `security-standards.md`, `testing-standards.md`, `frontend-standards.md`, `architecture-patterns.md`
- **Workstreams**: Backend API, Relational Database & Migrations, Privacy Guardrails, Full-Stack Integration, Automated Testing, Documentation
- **Outcome**:
  1. Built the relational SQLite persistence engine in `backend/` using Node.js built-in `node:sqlite` (`DatabaseSync`) with versioned SQL migrations (`backend/migrations/001_initial_b2b2c_schema.sql`) and canonical seed data (`backend/src/seed.mjs`) covering `owners`, `properties`, `units`, `tenants`, `rent_records`, `inquiries`, `listing_reports`, and `system_events`.
  2. Implemented the domain service layer (`backend/src/service.mjs`) and HTTP REST API (`backend/src/server.mjs` on `http://localhost:4000`):
     - Enforced strict B2B2C privacy guardrails on `GET /api/public/listings`: strips all private tenant PII (`tenantName`, `contactNumber`, `moveInDate`, `rentStatus`) and filters out unpublished units.
     - Implemented atomic 1-click vacancy sync (`PATCH /api/owner/units/:id/occupancy`): updating a unit's occupancy atomically updates public availability, manages private tenant/rent records, and logs a `SYNC_EVENT` audit entry.
     - Implemented server-side BMC subscription tier calculation (`GET /api/owner/:ownerId/subscription`) enforcing `1 room or 1 apartment = 1 count` (`1–10: ₱99/mo`, `11–25: ₱199/mo`, `26–50: ₱349/mo`, `>50: Custom Quote`).
     - Added full CRUD/mutation endpoints for unit creation, rent payment status, renter inquiries, discrepancy reports, Admin ID reviews, report resolution, and database reset (`/api/system/reset`).
  3. Connected the React frontend (`frontend/src/App.tsx`, `frontend/src/components/OwnerView.tsx`, `frontend/vite.config.ts`) to the live SQLite API via `/api` proxy, displaying a live `"SQLite Connected"` status badge and Reset Database control in the top navigation bar.
  4. Wrote and executed automated integration & privacy guardrail tests (`backend/tests/api.test.mjs`) and updated canonical documentation (`docs/API.md`, `docs/DATABASE.md`, `docs/CURRENT_STATE.md`).
- **Verification Receipts**:
  - `cd backend && npm test`: **PASS** (5/5 integration, privacy guardrail, 1-click sync, BMC tier escalation, and admin moderation tests passed in 640ms).
  - `cd frontend && npm run build && npx oxlint`: **PASS** (`tsc -b && vite build` in 1.58s with 0 errors; `oxlint` 0 warnings, 0 errors across 10 files).
  - `check_skill_routing.py`: **PASS** (16/16 roles, 0 errors).
  - Live Server & Proxy Health Check: `http://localhost:4000/api/health` (`ok`) and `http://localhost:5173/api/health` (`ok`).
- **Next Action / Owner**: Both frontend (`http://localhost:5173/`) and SQLite backend (`http://localhost:4000/`) are running live for interactive user testing.

### 2026-11-07: Booking.com & Zillow Rental Manager Blue Design System Overhaul
- **Accountable Role**: Frontend Engineer / Systems Architect
- **Skills Applied**: `frontend-standards.md`, `architecture-patterns.md`, `rules/ux-ui-design-rules.md`, `technology-stack.md`
- **Workstreams**: UI/UX Design Research, Frontend Architecture, Compliance
- **Outcome**:
  1. Conducted web research on established booking & rental management platforms (Booking.com, Zillow Rental Manager, Buildium, and Philippine rental SaaS workflows).
  2. Re-engineered `index.css` around the **Booking.com Blue Design System**:
     - Brand Prussian Navy (`#003580`), Interactive Action Blue (`#006CE4`), Selective Yellow search framing (`#FFB700`), Light Neutral Canvas (`#F2F6FA`), and Semantic Green (`#008009`).
  3. Redesigned `CustomerView.tsx` into Booking.com's signature **Asymmetric 2-Column Discovery Layout**:
     - Overlapping 4-segment Selective Yellow search bar (`.booking-search-box`).
     - Sticky left-hand faceted filter sidebar (`280px` width: monthly budget slider, owner ID verification filter, property type counts, popular features).
     - Horizontal 3-column property cards (`.booking-property-card`: left thumbnail, middle blue-bordered unit highlight box `.booking-unit-highlight`, right-hand `.booking-trust-score` badge + pricing + `See availability` CTA), plus list/grid view toggle and sort selector.
  4. Redesigned `OwnerView.tsx` and `AdminView.tsx` into **Zillow Rental Manager / Buildium 2-Column SaaS Workspaces** (`.saas-workspace-layout`):
     - Persistent left sidebar navigation (`.saas-sidebar-nav`), KPI summary strips, table row density toggle (`Comfortable` vs `Compact`), 1-click vacancy sync, private tenant isolation, and BMC tier breakdown.
  5. Updated `RoleSwitcher.tsx` and `AuthModal.tsx` to match the Prussian Blue header and pill navigation.
  6. Verified build (`tsc -b && vite build`), linting (`oxlint`), and launched dev server (`task-699`) on `http://localhost:5173/`.
- **Verification Receipts**:
  - `npm run build` (`tsc -b && vite build`): **PASS** (1.54s, 0 errors).
  - `npx oxlint`: **PASS** (0 warnings, 0 errors across 10 files in 142ms).
  - Unicode & BMC Disclaimers Check: **PASS** (0 unicode escapes; all 4 mandatory BMC disclaimers and tier rules intact).
- **Next Action / Owner**: Live user review at `http://localhost:5173/`.

### 2026-11-07: Design Refinement & Complete Authentication System
- **Accountable Role**: Frontend Engineer / Systems Architect
- **Skills Applied**: `frontend-standards.md`, `architecture-patterns.md`, `rules/ux-ui-design-rules.md`, `technology-stack.md`
- **Workstreams**: Frontend, UX/UI Design, Authentication & Session
- **Outcome**:
  1. Overhauled visual system in `index.css`: replaced generic/vibe-coded styles with a bespoke Philippine proptech identity (Deep Malachite `#0B3B39`, warm linen canvas `#F6F8F9`, crisp `#E2E8F0` borders, purposeful depth, zero neon/fuzzy decorations).
  2. Implemented strict spacing scale (`--space-1` to `--space-12`), comfortable padding rhythm, and responsive cards with dual-layer shadows.
  3. Built complete authentication module (`AuthModal.tsx`):
     - Tabs for Sign In and Account Creation.
     - 1-click test persona shortcuts for instant reviewer testing (Maria Santos - Landlord, Juan Dela Cruz - Renter, Platform Admin).
     - Live BMC subscription tier calculator during landlord signup (1–10: ₱99, 11–25: ₱199, 26–50: ₱349, >50: Quote) with room count input and ID type selector.
  4. Upgraded `RoleSwitcher.tsx` into a modern sticky application header with user avatar, name, role indicator, dropdown menu, sign out, and guest mode actions.
  5. Connected session state in `CustomerView.tsx` with automatic pre-fill of renter contact details and guest inquiry helpers.
  6. Launched Vite dev server on `http://localhost:5173/` (task `task-662`, verified 200 OK).
- **Verification Receipts**:
  - `npm run build` (`tsc -b && vite build`): **PASS** (1.11s, 0 errors).
  - `npx oxlint`: **PASS** (0 warnings, 0 errors across 10 files with 116 rules in 56ms).
  - `check_skill_routing.py`: **PASS** (16/16 roles, 0 errors).
  - HTTP Server Check: `Invoke-WebRequest -Uri "http://localhost:5173"` -> `200 OK`.
- **Next Action / Owner**: Prototype is live on `http://localhost:5173/` for user review and demonstration.
