# Implementation Details

## Overview
Module structure, data flow conventions, and UI/API contracts across `frontend/` and `backend/`.

## Module Structure

### Backend (`backend/`)
- `migrations/001_initial_b2b2c_schema.sql`: SQLite DDL for `owners`, `properties`, `units`, `tenants`, `rent_records`, `inquiries`, `listing_reports`, and `system_events` with foreign keys and query indexes.
- `src/seed.mjs`: Canonical Philippine B2B2C sample dataset (boarding houses, apartments, dorms, sample owners, tenants, inquiries, and moderation flags).
- `src/service.mjs`: Domain service layer (`createSilidSmartService`), input validators (`ValidationError`, `NotFoundError`), dynamic ISO/timestamp date helpers (`todayIso`, `defaultMoveInIso`, `currentMonthLabel`, `nowTimestamp`), `calculateBmcSubscriptionTier`, and role-scoped workspace builders (`getPublicWorkspace`, `getOwnerWorkspace`, `getBootstrapState`).
- `src/server.mjs`: Native HTTP server with JSON body parsing (`1 MB` limit), REST routes, CORS headers, and structured `{ error: { code, message, details } }` responses.
- `tests/api.test.mjs`: `21`-test integration suite using isolated `:memory:` SQLite, covering roles/privacy, pricing, short stays, directory scopes/settings and private utility bills.
- `migrations/002_maps_and_accounts.sql`, `003_short_stay_records.sql`, `004_directory_and_utilities.sql`: versioned account/maps, private stay ledger, and directory estimate/private utility schema extensions, tracked once without resetting existing data.

### Frontend (`frontend/src/`)
- `types.ts`: Shared TypeScript contracts for roles, owners, properties, units, tenants, rent ledger rows, inquiries, reports, and telemetry events.
- `seedData.ts`: Exports `initialUsers` (`Juan Dela Cruz`, `Maria Santos`, `Platform Review Lead`) used strictly as 1-click sign-in persona presets in `AuthModal` (never used to silently mask backend downtime).
- `index.css`: Editorial Stone & Proptech Blue design tokens (`#002B66`, `#0057D9`, `#F5A623`), `Newsreader` + `Plus Jakarta Sans` + `JetBrains Mono` typography classes, hairline `.ledger-kpi-strip` grid styling, and `.api-error-banner` / `.api-state-panel` styles.
- `App.tsx`: Root orchestrator deriving `workspaceKey` (`renter` | `owner:<id>` | `admin`), fetching strictly role-scoped endpoints, clearing private arrays when returning to `renter`, executing checked API mutations (`executeMutation`), and rendering loading / unavailable / error banners.
- `components/UnitDirectorySettings.tsx`: owner publication and optional expected availability editor. Occupancy and publication are independent; estimates never automatically create vacancy.
- `components/UtilityTracker.tsx`: owner-scoped bill entry/correction, payment fields, filters and manual totals, backed by the utility API. Shared `PrivateLedger.css` supplies horizontally scrollable table styling alongside the short-stay ledger.
- `components/RoleSwitcher.tsx`: Navigation filtered to the signed-in role, account controls, and an administrator-only example-data reset action.
- `components/CustomerView.tsx`: Public directory search, faceted sidebar filters, list/grid card toggle (with SVG `onError` image fallback), side-by-side comparison dock/modal (`up to 3` units), viewing inquiry submission + tracker, and discrepancy reporting.
- `components/OwnerView.tsx`: Landlord workspace with property-scoped unit creation (`effectivePropertyId`), 1-click occupancy toggle + move-in modal, private tenant roster, rent ledger, inquiry approval/move-in conversion, printable gate QR poster + Facebook vacancy post generator, and BMC tier breakdown.
- `components/AdminView.tsx`: Platform governance console for owner government ID review, discrepancy moderation, unit force publish/delist controls, Airbnb-to-SilidSmart translation cards, privacy guardrail audit, and live telemetry stream.
- `components/AuthModal.tsx`: Sign In / Create Account modal with live BMC tier calculator and backend owner onboarding (`POST /api/owners/onboard`).

- `components/RentalMap.tsx`: Lazy-loaded Leaflet map with grouped property price markers, unit detail actions, scope-centered views, resizing cleanup, and explicit missing-location/tile-failure states.
- `backend/src/auth.mjs`: Prototype account validation, salted scrypt password hashes, and expiring server-held cookie sessions. Example persona buttons obtain server sessions instead of inventing client roles.
