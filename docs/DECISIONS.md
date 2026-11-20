# Architecture Decision Records (ADRs)

## Overview
This document records key technical decisions, architectural patterns, and rationale for SilidSmart.

## Decisions

### ADR-001: Modular Architecture and Separation of Concerns
- **Status**: Accepted
- **Decision**: Enforce strict separation between presentation (`frontend/`), application services (`backend/src/service.mjs`, `server.mjs`), and relational persistence (`node:sqlite` + SQL migrations).

### ADR-002: Zero-Dependency Backend with Built-in `node:sqlite`
- **Status**: Accepted
- **Context**: Needed portable, relational SQLite persistence without native C++ build tool friction across Windows/Linux environments.
- **Decision**: Use Node.js `v22+` built-in `node:sqlite` (`DatabaseSync`) and `node:http` with versioned SQL migrations and `node --test` integration tests against `:memory:` databases.
- **Consequences**: Zero external backend npm dependencies, deterministic ACID transactions for occupancy sync (`toggleUnitOccupancy`), and instant single-command startup.

### ADR-003: Strict Role-Scoped Workspaces & No Silent Mock Fallbacks
- **Status**: Accepted
- **Context**: Bootstrapping every role from a single `/api/bootstrap` payload leaked private tenant/rent rows into client state during `renter` browsing, and swallowing fetch errors silently hid backend outages behind stale sample data.
- **Decision**: Expose `/api/public/workspace` (vacant published units + stripped owner metadata only) and `/api/owner/:ownerId/workspace` (single-landlord isolation), reserve `/api/bootstrap` for `admin`, clear private state arrays on `renter` views, start React state empty, and surface explicit loading, unavailable/retry, and mutation error banners.
- **Consequences**: Verifiable network-level B2B/B2C privacy separation and honest, defensible error handling during outages or invalid requests.

### ADR-004: Proptech Blue & Editorial Stone Anti-AI Design System
- **Status**: Accepted
- **Decision**: Standardize UI on `#002B66` brand navy, `#0057D9` action blue, `#F5A623` search framing, `Newsreader` + `Plus Jakarta Sans` + `JetBrains Mono` typography, hairline `gap: 1px` `.ledger-kpi-strip` summaries, `1px` borders, and native UTF-8 `₱` currency formatting without glassmorphism blur or decorative edge stripes.

### ADR-005: Pitch prototype map scopes and role previews
- **Status**: Accepted for the November 21, 2026 pitch, following the user's November 18 scope clarification.
- **Decision**: Preserve the existing React/Node/SQLite stack, demonstrate UST and QC rental discovery with explicitly approximate sample locations, and load Leaflet only when the directory map is needed. The header exposes public discovery plus the signed-in account's own workspace; example persona selection remains in the sign-in dialog.
- **Access boundary**: Server-issued cookie sessions enforce role and landlord ownership, and inquiries are scoped by account ID. The prototype's openly selectable example accounts intentionally demonstrate each role and are not production identity assurance.
- **Consequences**: Add a versioned map/account migration and integration checks without introducing a hosted auth provider, new deployment target, or production-completion claim. Prototype labeling moves out of the navigation strip and remains with the map/footer.

### ADR-006: Free owner tier and manually recorded short-stay commission
- **Status**: Accepted by user direction November 20, 2026; user explicitly selected 5%.
- **Decision**: Free monthly access for 1–4 units; PHP 99 for 5–10, PHP 199 for 11–25, PHP 349 for 26–50, custom above 50. An empty portfolio has no charge. Core tools are shared; unit capacity sets the subscription tier. On every tier, completed owner-reported SilidSmart-sourced short stays calculate a separate 5% of accommodation rent, excluding refundable deposits/taxes/other charges. Cancelled and other-source stays calculate zero.
- **Boundary**: Implement a private completed-stay ledger and versioned migration, with server-side rate/calculation and portfolio checks. Retain renter viewing inquiries and manual occupancy. No online checkout, calendar reservation, automatic occupancy updates, payment processing, deduction, commission collection, or verified revenue is introduced. Real billing/reconciliation and reliable source/completion verification remain future work.

### ADR-007: Separate publication from availability and add manual utility tracking
- **Status**: Accepted by the user's November 20 request to implement both reviewed features.
- **Decision**: Preserve explicit publication across occupancy changes. Available now uses published vacancies; All published units additionally exposes published occupied specifications/status and an owner-supplied expected date. Hidden units stay hidden, estimates do not change occupancy, and tenant/contract information remains private. Inquiry submission still requires a vacant published unit.
- **Utility boundary**: Add private Electricity/Water bills per unit/type/month, integer centavos, due dates and manual Paid/Due/Overdue fields with conditional payment date/reference. Enforce duplicate prevention and owner isolation; support amount/due/payment corrections. No provider integration, payment processing or change to subscriptions/5% commission. Utilities remain excluded from accommodation rent.
- **Consequences**: Versioned migration 004, explicit public scope parameter, owner directory editor and utility tab, privacy-safe state clearing, and regression coverage for both visible/hidden units and private finance. Existing hidden inventory and all prior operational records are preserved.
