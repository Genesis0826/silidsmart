# Database & Data Model Standards

## Overview
Defines the SilidSmart B2B2C relational database schema (`silidsmart/backend/migrations/001_initial_b2b2c_schema.sql`), entity relationships, and strict B2B/B2C privacy boundaries.

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
