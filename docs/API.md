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
Returns the role-scoped public Renter workspace state from SQLite (`owners` public directory fields only without `contactMethod` or `idDocumentName`, `properties`, `Vacant` & `published` `units`, and `inquiries`).
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
Returns the isolated workspace for `ownerId` (`owner`, sanitized `owners` directory list for switching, owner's `properties`, `units`, `tenants`, `rentRecords`, `inquiries`, and `subscription`). Throws `404 OWNER_NOT_FOUND` if the owner does not exist.

### `GET /api/owner/:ownerId/subscription`
Calculates the owner's monthly BMC subscription tier from their total managed rooms/units (`1 room or 1 apartment = 1 count`).
- **Tiers**:
  - `1–10 units`: `₱99/mo` (`TIER_1_STARTER`)
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

### `PATCH /api/owner/inquiries/:inquiryId`
Approves or declines a renter viewing request (`Approved`, `Declined`).

---

## 3. Platform Governance & System Endpoints (Admin)

- `GET /api/bootstrap` — Returns full multi-role state for the interactive simulation console.
- `PATCH /api/admin/owners/:ownerId/id-review` — Updates owner ID verification status (`Pending review`, `ID reviewed`, `Needs correction`).
- `PATCH /api/admin/reports/:reportId/resolve` — Marks a listing report as `Resolved`.
- `PATCH /api/admin/units/:unitId/publish` — Toggles listing publication (`published: boolean`).
- `POST /api/system/reset` — Resets all SQLite tables to the canonical BMC seed state.
