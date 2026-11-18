# Security & Privacy Policy

## Overview
Defines the B2B2C privacy isolation boundaries, role-scoped serialization contracts, input validation rules, and trust badge disclaimers for SilidSmart.

## Core Security & Privacy Controls

1. **Strict B2B vs. B2C Data Isolation (Zero Tenant PII Leakage)**
   - **Public Endpoints (`GET /api/public/listings`, `GET /api/public/workspace`)**: Query only `Vacant` and `published = 1` units and return only public property/unit details alongside stripped owner trust metadata (`id`, `displayName`, `idReviewStatus`, `idSubmissionDate`).
   - Private tables (`tenants`, `rent_records`, `listing_reports`, `system_events`), private owner account attributes (`contactMethod`, `idDocumentName`), and `Occupied` units are **never** queried or serialized in public endpoints.
   - **Client Memory Scrubbing (`frontend/src/App.tsx`)**: Switching back to `renter` perspective explicitly clears `tenants`, `rentRecords`, `listingReports`, and `systemEvents` in React state and re-fetches `/api/public/workspace`.

2. **Landlord Portfolio Isolation (`GET /api/owner/:ownerId/workspace`)**
   - Scopes `properties`, `units`, `tenants`, `rentRecords`, `inquiries`, and `subscription` strictly to `WHERE owner_id = ?`.
   - Returns only sanitized directory fields (`id`, `displayName`, `idReviewStatus`, `idSubmissionDate`) for other owners in the switcher list—omitting their `contactMethod` and `idDocumentName`.
   - Unknown owner IDs fail explicitly with `404 OWNER_NOT_FOUND`.

3. **Explicit Failure States (No Silent Fabricated Fallbacks)**
   - Neither backend failures nor missing records fall back to bundled client mock data; unavailable backends render an explicit error panel with retry controls, and mutation errors block modal closure while displaying server validation messages.

4. **Boundary Input Validation**
   - All write endpoints in [backend/src/service.mjs](../backend/src/service.mjs) validate required strings, enum values (`Vacant` / `Occupied`, `Paid` / `Due` / `Overdue`, `Pending review` / `ID reviewed` / `Needs correction`, `Approved` / `Declined`), numeric bounds (`monthlyRent > 0`), and `1 MB` maximum JSON body size (`server.mjs`) before executing SQL writes.

5. **Parameterized SQLite Queries**
   - All SQL queries execute via `db.prepare(...)` with bound `?` placeholders inside `node:sqlite`, with multi-step occupancy/onboarding writes wrapped in explicit `BEGIN TRANSACTION` / `COMMIT` / `ROLLBACK` blocks.

6. **Honest Identity Verification Disclaimers**
   - Government ID checks verify landlord identity submission only. Every public `"Owner ID reviewed"` badge is accompanied by `"This does not certify property safety"`.
