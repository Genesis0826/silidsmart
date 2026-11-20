# API Documentation & Contracts

## Overview
Defines the SilidSmart B2B2C REST API endpoints (`silidsmart/backend/src/server.mjs`), request/response formats, error codes, and the strict Public vs. Private data serialization boundary.

## Conventions
- **Base URL**: `/api` (proxied from Vite frontend dev server to `http://localhost:4000/api`)
- **Format**: JSON (`Content-Type: application/json; charset=utf-8`)
- **Error Responses**:
  ```json
  {
    "error": {
      "code": "STRING_IDENTIFIER",
      "message": "Human readable error description",
      "details": {}
    }
  }
  ```

---

## 1. Public B2C Endpoints (Renter Directory & Inquiries)

### `GET /api/public/listings`
Default `availability=available` returns published vacancies. Optional `?availability=all` also returns published occupied units, with `status` and optional `expectedAvailableFrom`. Hidden units are excluded from both scopes. Unknown availability values return `400 INVALID_AVAILABILITY_FILTER`.
- **Privacy Guardrail**: Never queries or returns `tenants` or `rent_records`.
- **Mandatory Disclaimers Included**:
  - `prototypeNotice`: `"Concept prototype - sample properties only"`
  - `listings[].freshnessNotice`: `"Availability last updated by owner: [date]"`
  - `listings[].owner.trustBadgeText`: `"Owner ID reviewed"`
  - `listings[].owner.safetyDisclaimer`: `"This does not certify property safety"`

### `GET /api/public/workspace`
Returns public owner fields, matching properties/units, and account-scoped inquiries (empty for guests). Uses the same `availability=available|all` scopes as public listings. The frontend loads `all` and defaults its visible filters to Available now.
- **Privacy Guardrail**: Neither scope queries or returns tenant, rent, utility or short-stay ledgers, private owner fields, or contract data. The optional expected date is explicitly supplied for publication by the owner.

### `POST /api/public/inquiries`
Submits a zero-commission viewing inquiry to the property owner.
- **Required Body**: `{ unitId, propertyId, propertyName, unitLabel, renterName, renterContact, moveInDate, message }`
- **Response**: `201 Created` with updated workspace state.

### `POST /api/public/reports`
Flags an outdated or inaccurate public listing for administrator moderation.
- **Required Body**: `{ unitId, propertyName, unitLabel, reason, details }`
- **Response**: `201 Created` with updated workspace state.

---

## 2. Private B2B Landlord Endpoints (Owner Operations)

### `GET /api/owner/:ownerId/workspace`
Returns the isolated workspace for `ownerId`: owner/profile, properties, units, tenants, rentRecords, inquiries, subscription, private shortStays, utilityRecords and commissionStatements. Requires an owner session; a different owner ID returns `403 PORTFOLIO_FORBIDDEN`.

### `GET /api/owner/:ownerId/subscription`
Calculates the owner's monthly BMC subscription tier from their total managed rooms/units (`1 room or 1 apartment = 1 count`).
- **Tiers**:
  - `1–4 units`: `₱0/mo` (`TIER_FREE`; zero units also has no charge)
  - `5–10 units`: `₱99/mo` (`TIER_1_STARTER`)
  - `11–25 units`: `₱199/mo` (`TIER_2_GROWTH`)
  - `26–50 units`: `₱349/mo` (`TIER_3_SCALE`)
  - `>50 units`: `Custom Quote` (`TIER_CUSTOM_ENTERPRISE`)
- **Mandatory Disclaimer**: `"The monthly fee depends on the total rooms or apartment units managed"`

### `PATCH /api/owner/units/:unitId/occupancy`
Atomically toggles unit occupancy while preserving the existing publication choice, registers incoming private tenant/rent rows when details are supplied, and emits a `SYNC` event. Vacant clears the expected availability estimate. Occupied units remain excluded from Available now but can remain in All if published.
- **Body**: `{ newStatus: 'Vacant' | 'Occupied', tenantName?, tenantContact?, moveInDate? }`

### `POST /api/owner/units`
Adds a new room or apartment unit to an owner's property and recalculates their subscription count.
- **Body**: `{ propertyId, unitLabel, monthlyRent, deposit, description }`

### `PATCH /api/owner/rent-records/:recordId`
Updates a manual rent payment ledger entry (`Paid`, `Due`, `Overdue`).

### `PATCH /api/owner/units/:unitId/directory`
Requires an owner session and portfolio membership. Body: `{ published: boolean, expectedAvailableFrom?: 'YYYY-MM-DD' | null }`. Replaces publication and the optional owner estimate (omitted/empty clears it). The date must be a real calendar date; a vacant unit stores no estimate. Does not alter occupancy or disclose private tenant/lease information. Returns the owner workspace.

### `POST /api/owner/utility-records`
Requires an owner session and a unit in that portfolio. Body: `{ unitId, utilityType: 'Electricity' | 'Water', billingMonth: 'YYYY-MM', amountPhp, dueDate: 'YYYY-MM-DD', paymentStatus: 'Paid' | 'Due' | 'Overdue', paymentDate?: 'YYYY-MM-DD' | null, reference?: string }`. Amount must be positive, at most PHP 10,000,000, with two decimal places at most. Paid requires a real payment date; unpaid records must omit/clear the payment date. References are limited to 120 characters and cleared for unpaid bills. Duplicate unit/type/month returns `400 DUPLICATE_UTILITY_BILL`; validation errors return 400. Returns `201` with the owner workspace and private `utilityRecords`.

### `PATCH /api/owner/utility-records/:recordId`
Requires the record's owner. Supports partial corrections to `amountPhp`, `dueDate`, `paymentStatus`, `paymentDate`, `reference`, with the same validation. Bill identity (`unitId`, `utilityType`, `billingMonth`) stays fixed and supplied replacements are ignored. When changing Paid to Due/Overdue, explicitly send `paymentDate: null`; the reference is cleared. Returns the owner workspace. Neither utility route processes payments, verifies receipts or changes short-stay commission. Other-portfolio requests fail 403; missing session 401; wrong role 403.

### `POST /api/owner/short-stays`
Records an owner-declared completed short stay. Requires owner/unit membership. Body: `{ unitId, guestName, checkInDate, checkOutDate, rentTotalPhp, source: 'SilidSmart' | 'Other', inquiryId?: string | null }`. Real ISO checkout must follow check-in and be no later than today in Manila. Rent must be positive, at most PHP 10,000,000, with at most two decimals. Optional inquiry must match the same unit and SilidSmart source. The server fixes 5% and ignores supplied fee/rate/status fields. Source remains an owner report. New entries in an issued checkout month fail `400 COMMISSION_PERIOD_LOCKED`.

Returns `201` with the owner workspace including `shortStays`. Each entry contains the submitted fields plus `id`, `status`, `commissionPercent`, `commissionPhp`, and `recordedAt`. Only completed SilidSmart-sourced entries calculate commission, rounded to centavos; other-source/cancelled entries calculate zero. This does not change occupancy, create a reservation, verify payment, or collect money.

### `PATCH /api/owner/short-stays/:recordId`
Body: `{ status: 'Completed' | 'Cancelled' }`. Requires ownership and an unlocked checkout month. Returns the owner workspace. Cancelling waives calculated commission; restoring recalculates it at the stored 5% rate. No refund or payment occurs.

Private short-stay entries are omitted from all public endpoints and cleared from client state when leaving the owner workspace.

### `POST /api/owner/commission-statements`
Owner session required. Body `{ billingMonth: 'YYYY-MM' }`, completed months from January 2000 onward. Uses the signed-in portfolio; client owner/amount fields cannot set access/totals. Issues a fixed snapshot with version, next month's 10th due date, eligible rent, per-stay rounded commission, monthly items and remittance history. Repeated issue returns the active snapshot unchanged. Returns `201` owner workspace with `commissionStatements`. Open/invalid months return `400 INVALID_COMMISSION_MONTH`; empty months have `No commission` status.

### `POST /api/owner/commission-statements/:id/remittances`
Owner/statement membership required. Body `{ amountPhp, method: 'Bank transfer' | 'GCash', reference, paymentDate: 'YYYY-MM-DD' }`. Exact positive commission amount only; real payment date no later than today in Manila; reference 1–120 characters without controls. One pending/verified report per statement. Method plus case/whitespace-normalized reference cannot repeat across pending/verified reports. Returns `201` owner workspace. Rejected reports remain in history and allow another attempt. Invalid amount/details, duplicates or unpayable/already reported statements return 400; another portfolio returns 403. Submission does not settle the balance.

### Commission statement representation
`{ id, ownerId, billingMonth, version, state: 'Issued' | 'Void', rentTotalPhp, commissionPhp, outstandingPhp, items, dueDate, issuedAt, voidReason, paymentStatus, remittances }`. Derived status priority: Void, No commission, Verified, Under review, Overdue, Due. Items contain unit/property labels, dates, rent/source/status, inquiry ID and commission, without guest name/contact. Remittances include amount/method/reference/payment date, Submitted/Rejected/Verified, timestamps, review note and receipt date. Subscriptions and utilities are excluded.

### `PATCH /api/owner/inquiries/:inquiryId`
Approves or declines a renter viewing request (`Approved`, `Declined`).

---

## 3. Platform Governance & System Endpoints (Admin)

- `GET /api/bootstrap` — Returns the full admin workspace; requires an administrator session.
- `PATCH /api/admin/commission-remittances/:id` — Body `{ decision: 'Verified' | 'Rejected', note, receivedDate?, fundsReceived? }`. Submitted reports only. Verification requires `fundsReceived: true`, receipt date between payment date and today, and a note of 1–500 characters. Rejection requires a note and clears receipt date. Stores admin ID/time; returns bootstrap with commissionStatements. No provider query or money movement occurs.
- `POST /api/admin/commission-statements/:id/void` — Body `{ reason }` (1–500 characters). Only issued statements without pending/verified reports. Preserves snapshot/history, unlocks month and allows the next version. Returns bootstrap. Review/void validation returns 400, wrong role 403, unknown admin record IDs 404.
- `PATCH /api/admin/owners/:ownerId/id-review` — Updates owner ID verification status (`Pending review`, `ID reviewed`, `Needs correction`).
- `PATCH /api/admin/reports/:reportId/resolve` — Marks a listing report as `Resolved`.
- `PATCH /api/admin/units/:unitId/publish` — Toggles listing publication (`published: boolean`).
- `POST /api/system/reset` — Resets all SQLite tables to the canonical BMC seed state.

Admin bootstrap includes commission snapshots/remittances for staff review, but still omits raw short-stay guest records and utilities. Public endpoints never include commission or remittance data. Owner/admin mutations retain no-store and same-origin/session checks.

## Prototype account/session contract — November 18, 2026

All private endpoints require the session cookie. Missing sessions return `401`; a wrong role or portfolio returns `403`. The UI's role buttons are not authorization. All JSON responses use `Cache-Control: no-store`.

| Endpoint | Behavior |
| --- | --- |
| `GET /api/auth/session` | Returns `{ user }`, or `{ user: null }` for guests. |
| `POST /api/auth/login` | Accepts `{ identifier, password }`; returns the server-selected user and sets an HttpOnly session cookie. |
| `POST /api/auth/register` | Accepts `{ name, email, phone?, password }`; creates a renter only and signs in. |
| `POST /api/auth/logout` | Revokes the session and expires the cookie. |
| `POST /api/owners/onboard` | Existing onboarding fields plus `email`, `phone?`, and `password`; returns `{ onboardedOwnerId, user }` and signs in to that new portfolio. No admin bootstrap is returned. |

Public inquiry/report submission requires a renter session. Inquiry submission returns that renter's public workspace; report submission returns `{ ok: true }`. Owner mutations return the owner's workspace rather than global bootstrap state.

Public workspace properties additionally expose nullable `latitude`, `longitude`, and `mapScope` (`ust` or `qc`). These seed coordinates are approximate examples. The UST and QC controls filter the same unit inventory used by markers, results, and property-type counts. New listings without coordinates stay in their assigned scope's results and are explicitly reported as unlocated by the map.
