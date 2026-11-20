# Security & Privacy Policy

## Overview
Defines the B2B2C privacy isolation boundaries, role-scoped serialization contracts, input validation rules, and trust badge disclaimers for SilidSmart.

## Core Security & Privacy Controls

1. **Strict B2B vs. B2C Data Isolation (Zero Tenant PII Leakage)**
   - **Public Endpoints (`GET /api/public/listings`, `GET /api/public/workspace`)**: Query only `Vacant` and `published = 1` units and return only public property/unit details alongside stripped owner trust metadata (`id`, `displayName`, `idReviewStatus`, `idSubmissionDate`).
   - Private tables (`tenants`, `rent_records`, `listing_reports`, `system_events`), private owner account attributes (`contactMethod`, `idDocumentName`), and `Occupied` units are **never** queried or serialized in public endpoints.
   - **Client Memory Scrubbing (`frontend/src/App.tsx`)**: Signing out or changing accounts clears `tenants`, `rentRecords`, `listingReports`, and `systemEvents` in React state and re-fetches `/api/public/workspace`.

2. **Landlord Portfolio Isolation (`GET /api/owner/:ownerId/workspace`)**
   - Scopes `properties`, `units`, `tenants`, `rentRecords`, `inquiries`, and `subscription` strictly to `WHERE owner_id = ?`.
   - Returns only the signed-in owner's account in the owner list. The cross-landlord account switcher has been removed.
   - Requests for an owner ID outside the signed-in portfolio fail with `403 PORTFOLIO_FORBIDDEN`.

3. **Explicit Failure States (No Silent Fabricated Fallbacks)**
   - Neither backend failures nor missing records fall back to bundled client mock data; unavailable backends render an explicit error panel with retry controls, and mutation errors block modal closure while displaying server validation messages.

4. **Boundary Input Validation**
   - All write endpoints in [backend/src/service.mjs](../backend/src/service.mjs) validate required strings, enum values (`Vacant` / `Occupied`, `Paid` / `Due` / `Overdue`, `Pending review` / `ID reviewed` / `Needs correction`, `Approved` / `Declined`), numeric bounds (`monthlyRent > 0`), and `1 MB` maximum JSON body size (`server.mjs`) before executing SQL writes.

5. **Parameterized SQLite Queries**
   - All SQL queries execute via `db.prepare(...)` with bound `?` placeholders inside `node:sqlite`, with multi-step occupancy/onboarding writes wrapped in explicit `BEGIN TRANSACTION` / `COMMIT` / `ROLLBACK` blocks.

6. **Honest Identity Verification Disclaimers**
   - Government ID checks verify landlord identity submission only. Every public `"Owner ID reviewed"` badge is accompanied by `"This does not certify property safety"`.

## Pitch prototype access controls — November 18, 2026

- This remains a local pitch prototype. The sign-in dialog deliberately exposes three example accounts for demonstrating roles; it is not a production identity-provider integration.
- Account passwords are salted and hashed with Node scrypt in SQLite. Server-issued random sessions use an HttpOnly, SameSite=Strict cookie, expire after eight hours, and are revoked on sign-out. Sessions are held in memory and end when the backend restarts.
- Private requests require the matching server-side account role. Owner reads and writes check portfolio membership. Owner mutation responses return only that portfolio. Admin bootstrap, moderation, and data reset require the admin role.
- Public workspaces return no inquiries to guests. Signed-in renters receive requests linked to their account ID, not matching names or contact numbers. The server assigns the requester ID on submission; supplied renter IDs and roles grant no access.
- Owner registration creates its account and portfolio in one transaction. Public account registration can only create renters; administrator registration is not exposed.
- Cross-origin writes are rejected; the Vite proxy preserves the browser host. Production deployment, abuse controls, recovery flows, and verified real-world rental inventory are outside this pitch scope.

## Short-stay ledger boundary — November 20, 2026

Short-stay guest and commission records are private. Reads join unit/property ownership; writes require an owner session and portfolio membership. Guests/renters cannot use the new routes; another owner cannot read or change a stay. Public endpoints never query these entries, and React clears them on role/account changes. The server validates dates, rent bounds/precision, guest name, source and status, and sets 5% itself. Source, completion and payment remain owner-reported, so this is not payment verification, an enforceable billing system or fraud-resistant revenue evidence.
