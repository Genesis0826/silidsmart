-- Migration: 001_initial_b2b2c_schema.sql
-- Purpose: Core relational schema for SilidSmart B2B2C Rental Management & Public Directory
-- Enforces referential integrity, domain CHECK constraints, and indexing for public search & owner operations.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS owners (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  contact_method TEXT NOT NULL,
  id_review_status TEXT NOT NULL CHECK (id_review_status IN ('Pending review', 'ID reviewed', 'Needs correction')),
  id_submission_date TEXT NOT NULL,
  id_document_name TEXT
);

CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Boarding house', 'Apartment', 'Dorm', 'Condo')),
  area TEXT NOT NULL,
  address TEXT NOT NULL,
  rules_json TEXT NOT NULL,
  amenities_json TEXT NOT NULL,
  contact_method TEXT NOT NULL,
  image_url TEXT,
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  unit_label TEXT NOT NULL,
  monthly_rent INTEGER NOT NULL CHECK (monthly_rent > 0),
  deposit INTEGER NOT NULL CHECK (deposit >= 0),
  status TEXT NOT NULL CHECK (status IN ('Vacant', 'Occupied')),
  published INTEGER NOT NULL CHECK (published IN (0, 1)),
  last_updated TEXT NOT NULL,
  description TEXT NOT NULL,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

-- Private B2B Table: Never joined or exposed on public B2C endpoints
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL,
  name TEXT NOT NULL,
  contact TEXT NOT NULL,
  move_in_date TEXT NOT NULL,
  notes TEXT,
  FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
);

-- Private B2B Table: Never joined or exposed on public B2C endpoints
CREATE TABLE IF NOT EXISTS rent_records (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL,
  tenant_name TEXT NOT NULL,
  month TEXT NOT NULL,
  amount_due INTEGER NOT NULL CHECK (amount_due >= 0),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('Paid', 'Due', 'Overdue')),
  recorded_date TEXT NOT NULL,
  FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  property_name TEXT NOT NULL,
  unit_label TEXT NOT NULL,
  renter_name TEXT NOT NULL,
  renter_contact TEXT NOT NULL,
  move_in_date TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Approved', 'Declined')),
  submitted_at TEXT NOT NULL,
  FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS listing_reports (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL,
  property_name TEXT NOT NULL,
  unit_label TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT NOT NULL,
  submitted_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Resolved')),
  FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS system_events (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('SYNC', 'INQUIRY', 'MODERATION', 'BILLING')),
  message TEXT NOT NULL
);

-- Performance Indexes for Public Search & Owner Portfolio Queries
CREATE INDEX IF NOT EXISTS idx_properties_owner_id ON properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_units_property_id ON units(property_id);
CREATE INDEX IF NOT EXISTS idx_units_public_directory ON units(published, status);
CREATE INDEX IF NOT EXISTS idx_tenants_unit_id ON tenants(unit_id);
CREATE INDEX IF NOT EXISTS idx_rent_records_unit_id ON rent_records(unit_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_property_id ON inquiries(property_id);
CREATE INDEX IF NOT EXISTS idx_listing_reports_status ON listing_reports(status);
