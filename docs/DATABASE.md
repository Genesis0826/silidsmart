# Database & Data Model Standards

## Overview
Defines the SilidSmart B2B2C relational database schema (`silidsmart/backend/migrations/001_initial_b2b2c_schema.sql`), entity relationships, and strict B2B/B2C privacy boundaries.

## Tenant billing migration 007

`007_tenant_billing.sql` adds `tenant_billing_links` (owner-confirmed, renter-accepted recipient), `tenant_bills` (itemized immutable snapshots and manual settlement), `tenant_bill_checkouts` (one persisted sandbox attempt per bill, unique reference/session/payment), and `tenant_billing_events` (event identity/hash replay audit). Tenant/unit deletion sets link references null without assigning historical bills to a new occupant. Foreign keys cascade explicit example resets through billing children. Partial unique indexes limit active tenant links and current link/month bills. Source snapshots retain centavos; no provider test marks real ledgers paid. See [persistence and rollback contract](TENANT_BILLING.md#api-and-persistence). Back up before applying; export billing audit history before any schema reversal.

## Optional pitch fixtures
The opt-in `seed:pitch` CLI adds namespaced fictional data through the existing schema; it is not a migration or a normal-startup reset. It uses a consistent native SQLite backup before writes. A single transaction creates/restores the dedicated pitch owner/property/units and linked ledgers; other portfolios are preserved. Default reruns keep progress; explicit restore rejects unexpected extra inventory. Fixture account identity is checked and can be safely rebound after a global sample-data reset without overwriting an existing password. Database files/backups and generated local manifest are ignored by Git. See [pitch preparation](PITCH_DEMO.md#five-seeded-pitch-examples).

## Data Store Responsibilities
- **System of Record**: SQLite (`node:sqlite` `DatabaseSync` at `backend/data/silidsmart.sqlite`) stores operational application state across all three personas.
- **Migrations**: Managed via versioned SQL files in `backend/migrations/` tracked in the `schema_migrations` table.
- **Referential Integrity**: Enforced via `PRAGMA foreign_keys = ON` and `ON DELETE CASCADE` foreign keys.

---

## Entity-Relationship Schema (`001_initial_b2b2c_schema.sql`)

| Table | Scope | Primary Key | Foreign Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `owners` | Public Trust + B2B | `id` | — | Landlord profile, contact method, and government ID review status (`Pending review`, `ID reviewed`, `Needs correction`). |
| `properties` | Public + B2B | `id` | `owner_id -> owners(id)` | Boarding houses, apartments, and dorms with house rules and amenities JSON arrays. |
| `units` | Public (when Vacant) + B2B | `id` | `property_id -> properties(id)` | Individual rooms/units (`1 room or 1 apartment = 1 count`), stated rent (`₱`), deposit, occupancy status, and `last_updated`. |
| `tenants` | **Private B2B Only** | `id` | `unit_id -> units(id)` | Tenant legal names, private contacts, move-in dates, and internal notes. **Never exposed on public endpoints.** |
| `rent_records` | **Private B2B Only** | `id` | `unit_id -> units(id)` | Monthly rent payment ledger (`Paid`, `Due`, `Overdue`). **Never exposed on public endpoints.** |
| `inquiries` | Renter ↔ Owner | `id` | `unit_id -> units(id)`, `property_id -> properties(id)` | Zero-commission viewing schedule requests (`Pending`, `Approved`, `Declined`). |
| `listing_reports` | Renter → Admin | `id` | `unit_id -> units(id)` | Renter discrepancy flags for admin moderation (`Pending`, `Resolved`). |
| `system_events` | Admin Telemetry | `id` | — | Real-time event log (`SYNC`, `INQUIRY`, `MODERATION`, `BILLING`). |

## Indexes
- `idx_units_public_directory ON units(published, status)` — Optimizes public renter search for vacant published units.
- `idx_properties_owner_id ON properties(owner_id)` — Optimizes owner portfolio and BMC subscription unit counting.
- `idx_units_property_id ON units(property_id)`
- `idx_tenants_unit_id ON tenants(unit_id)`
- `idx_rent_records_unit_id ON rent_records(unit_id)`

## Migration 002 — pitch maps and account scoping

`002_maps_and_accounts.sql` adds nullable checked `latitude`, `longitude`, and `map_scope` property fields, a persistent `accounts` table with salted password hashes and roles, and indexed `inquiries.renter_id` ownership. Account-to-owner and inquiry-to-account foreign keys use `ON DELETE SET NULL`. Legacy requests remain visible to their property owner and admin, without being assigned to an unrelated renter.

The migration runs once and is recorded in `schema_migrations`. Startup inserts missing example QC properties/units and fills missing known seed coordinates without resetting existing inventory. Reset restores all sample inventory, including QC examples. No real property locations are asserted.

## Migration 003 — private short-stay records

`003_short_stay_records.sql` adds `short_stay_records`, one row per owner-reported completed stay, joined to a unit by a cascading foreign key and indexed by unit. Stores private guest name, ISO check-in/out dates, rent in integer centavos, source (`SilidSmart` or `Other`), status (`Completed` or `Cancelled`), fixed 5% policy snapshot, and creation timestamp. Commission is derived on read and rounded in centavos, with zero for other-source or cancelled entries. It is not a payment receipt or a calendar reservation. Only that unit's owner workspace queries these rows; public responses and admin bootstrap omit them. Startup applies the versioned migration once without resetting existing records; explicit demo reset removes entries. Rollback requires dropping this table and removing its migration tracking row after reverting the dependent code.

## Migration 004 — directory estimate and private utility bills

`004_directory_and_utilities.sql` adds nullable `units.expected_available_from` as an owner-provided public estimate, distinct from private tenant/contract dates. Existing `published` choices and occupancy are preserved. Public query scope separates available published vacancies from all published units.

`utility_records` stores one bill per `(unit_id, utility_type, billing_month)`, enforced by a unique index which also supports unit-scoped joins. Unit foreign keys cascade. Stores Electricity/Water, month, integer centavos, due date, manual status, conditional payment date/reference, and timestamp. A CHECK enforces payment date presence only for Paid. Both public scopes and admin bootstrap omit these private records. Startup applies once and keeps existing data; demo reset removes bills. Rollback after reverting dependent code drops the table, drops the new units column, and removes the migration tracking row.

## Migration 005 — monthly commission statements and external remittances

`005_monthly_commissions.sql` adds nullable `short_stay_records.inquiry_id` (inquiry FK, SET NULL), `commission_statements` and `commission_remittances`. Existing rows/amounts/publication stay unchanged. Startup applies once; reset deletes remittances/statements before stays/inquiries/owners.

- **Statement grain**: one version per owner/checkout month. Unique `(owner_id, billing_month, version)` and a partial unique index allow one Issued version per owner/month. Void versions remain. Eligible rent and fee are integer centavos; `items_json` is an immutable issued snapshot of all monthly entries, including ineligible rows for reconciliation. It excludes guest names/contacts. Dates are ISO date-only with Philippine period semantics; timestamps are UTC. Due date is the next month's 10th. All additions/status changes in an issued month are service-locked.
- **Remittance grain**: one reported transfer attempt per statement, with amount in centavos, Bank transfer/GCash, display/normalized reference, reported payment date, Submitted/Rejected/Verified, submission/review timestamps, reviewer account ID, note and staff receipt date. A statement FK cascades. A partial unique statement index permits one Submitted/Verified report; rejected attempts remain. Another partial unique index prevents reuse of `(method, reference_key)` among Submitted/Verified reports.
- **Access**: owner workspace joins the signed-in owner ID; admin bootstrap includes statement snapshots and remittance history for staff reconciliation. Raw guest stay/utility ledgers remain omitted from admin bootstrap. Public responses query none of these tables. No bank credentials, destination account, receipt files, provider transactions or payment tokens are stored.
- **Correction/rollback**: an admin can void only an issued statement without pending/verified reports, with a reason. Reissue creates the next version. Verified settlement has no edit/refund path in this prototype. Backup before reverting dependent code, then drop remittances before statements, drop the added inquiry column and remove the migration tracking row. This discards the billing audit history; prefer restoring the pre-upgrade backup when rollback is necessary.

## Migration 006 Wi-Fi utility records

`006_wifi_utility_records.sql` rebuilds only utility_records, preserving every existing ID, unit link, centavo amount, date, reference and status while allowing Wi-Fi alongside Electricity and Water. Unique unit/type/month and paid-date checks remain. Rollback requires resolving Wi-Fi rows before restoring the earlier constraint; no automatic data-dropping rollback is provided. No tenant payment or gateway ledger is introduced. Isolated backup-copy upgrade and reopen checks preserve all earlier rows and counts. Legacy commission snapshots remain unchanged.
