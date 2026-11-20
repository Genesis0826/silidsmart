CREATE TABLE tenant_billing_links (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE SET NULL,
  unit_id TEXT REFERENCES units(id) ON DELETE SET NULL,
  renter_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  tenant_name TEXT NOT NULL,
  property_name TEXT NOT NULL,
  unit_label TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('Invited','Active','Declined','Revoked')),
  created_at TEXT NOT NULL,
  accepted_at TEXT
);
CREATE UNIQUE INDEX idx_active_billing_tenant ON tenant_billing_links(tenant_id) WHERE state IN ('Invited','Active');
CREATE INDEX idx_billing_links_renter ON tenant_billing_links(renter_id,state);
CREATE TABLE tenant_bills (
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL REFERENCES tenant_billing_links(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  renter_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  billing_month TEXT NOT NULL,
  due_date TEXT NOT NULL,
  items_json TEXT NOT NULL,
  total_centavos INTEGER NOT NULL CHECK (total_centavos > 0),
  due_centavos INTEGER NOT NULL CHECK (due_centavos >= 0 AND due_centavos <= total_centavos),
  state TEXT NOT NULL CHECK (state IN ('Issued','Void','PaidExternal')),
  created_at TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  payment_date TEXT,
  reference TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX idx_current_tenant_month ON tenant_bills(link_id,billing_month) WHERE state != 'Void';
CREATE INDEX idx_tenant_bills_recipient ON tenant_bills(renter_id,created_at);
CREATE TABLE tenant_bill_checkouts (
  id TEXT PRIMARY KEY,
  bill_id TEXT NOT NULL UNIQUE REFERENCES tenant_bills(id) ON DELETE CASCADE,
  reference_number TEXT NOT NULL UNIQUE,
  amount_centavos INTEGER NOT NULL CHECK(amount_centavos > 0),
  session_id TEXT UNIQUE,
  checkout_url TEXT,
  state TEXT NOT NULL CHECK(state IN ('Creating','Pending','Unknown','Expired','SandboxPaid')),
  payment_id TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE tenant_billing_events (
  id TEXT PRIMARY KEY,
  payload_hash TEXT NOT NULL,
  checkout_id TEXT NOT NULL REFERENCES tenant_bill_checkouts(id) ON DELETE CASCADE,
  received_at TEXT NOT NULL
);
-- Rollback: archive billing/payment snapshots first; never silently drop issued
-- statements or receipts. Remove children before links, then migration tracking.
