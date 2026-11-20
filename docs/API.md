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
Returns only published and vacant units (`published = 1 AND status = 'Vacant'`) joined with property metadata and owner identity verification status.
- **Privacy Guardrail**: Never queries or returns `tenants` or `rent_records`.
- **Mandatory Disclaimers Included**:
  - `prototypeNotice`: `"Concept prototype - sample properties only"`
  - `listings[].freshnessNotice`: `"Availability last updated by owner: [date]"`
  - `listings[].owner.trustBadgeText`: `"Owner ID reviewed"`
  - `listings[].owner.safetyDisclaimer`: `"This does not certify property safety"`

### `GET /api/public/workspace`
Returns the role-scoped public Renter workspace state from SQLite (`owners` public directory fields only without `contactMethod` or `idDocumentName`, `properties`, `Vacant` & `published` `units`, and account-scoped `inquiries`; guests receive an empty inquiry list).
- **Privacy Guardrail**: Never queries or returns `tenants`, `rentRecords`, `listingReports`, `systemEvents`, or `Occupied` units.

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
Returns the isolated workspace for `ownerId` (`owner`, `owners` containing only the signed-in owner's record, owner's `properties`, `units`, `tenants`, `rentRecords`, `inquiries`, and `subscription`). Requires an owner session; requests for a different owner ID return `403 PORTFOLIO_FORBIDDEN`.

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
Atomically toggles unit occupancy (`Vacant` or `Occupied`), updates `published` state (`1` when Vacant, `0` when Occupied), registers incoming private tenant & rent ledger rows when marking `Occupied`, and emits a `SYNC` telemetry event.
- **Body**: `{ newStatus: 'Vacant' | 'Occupied', tenantName?, tenantContact?, moveInDate? }`

### `POST /api/owner/units`
Adds a new room or apartment unit to an owner's property and recalculates their subscription count.
- **Body**: `{ propertyId, unitLabel, monthlyRent, deposit, description }`

### `PATCH /api/owner/rent-records/:recordId`
Updates a manual rent payment ledger entry (`Paid`, `Due`, `Overdue`).

### `POST /api/owner/short-stays`
Records an owner-declared completed short stay. Requires the owner role and a unit in that owner's portfolio. Body: `{ unitId, guestName, checkInDate, checkOutDate, rentTotalPhp, source: 'SilidSmart' | 'Other' }`. Dates must be real ISO dates with checkout after check-in; rent must be positive, at most PHP 10,000,000, with at most two decimal places. The server fixes the rate at 5% and ignores supplied fee/rate/status fields. Source is an owner report, not independently verified attribution.

Returns `201` with the owner workspace including `shortStays`. Each entry contains the submitted fields plus `id`, `status`, `commissionPercent`, `commissionPhp`, and `recordedAt`. Only completed SilidSmart-sourced entries calculate commission, rounded to centavos; other-source/cancelled entries calculate zero. This does not change occupancy, create a reservation, verify payment, or collect money.

### `PATCH /api/owner/short-stays/:recordId`
Body: `{ status: 'Completed' | 'Cancelled' }`. Requires ownership of the record. Returns the owner workspace. Cancelling waives calculated commission; restoring completion recalculates it at the stored 5% rate. No refund or payment occurs.

Private short-stay entries are omitted from all public endpoints and cleared from client state when leaving the owner workspace.

### `PATCH /api/owner/inquiries/:inquiryId`
Approves or declines a renter viewing request (`Approved`, `Declined`).

---

## 3. Platform Governance & System Endpoints (Admin)

- `GET /api/bootstrap` — Returns the full admin workspace; requires an administrator session.
- `PATCH /api/admin/owners/:ownerId/id-review` — Updates owner ID verification status (`Pending review`, `ID reviewed`, `Needs correction`).
- `PATCH /api/admin/reports/:reportId/resolve` — Marks a listing report as `Resolved`.
- `PATCH /api/admin/units/:unitId/publish` — Toggles listing publication (`published: boolean`).
- `POST /api/system/reset` — Resets all SQLite tables to the canonical BMC seed state.

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
