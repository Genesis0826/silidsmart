-- Manual platform-fee statements and external remittance review, not a gateway.
-- Rollback (backup first): drop remittances then statements, drop inquiry_id from
-- short_stay_records, and remove this migration's schema_migrations row.
ALTER TABLE short_stay_records ADD COLUMN inquiry_id TEXT REFERENCES inquiries(id) ON DELETE SET NULL;
CREATE TABLE commission_statements (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  billing_month TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  state TEXT NOT NULL CHECK (state IN ('Issued', 'Void')),
  rent_total_centavos INTEGER NOT NULL CHECK (rent_total_centavos >= 0),
  commission_centavos INTEGER NOT NULL CHECK (commission_centavos >= 0),
  items_json TEXT NOT NULL,
  due_date TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  void_reason TEXT,
  voided_at TEXT,
  UNIQUE (owner_id, billing_month, version)
);
CREATE UNIQUE INDEX idx_active_commission_month ON commission_statements(owner_id, billing_month) WHERE state = 'Issued';
CREATE TABLE commission_remittances (
  id TEXT PRIMARY KEY,
  statement_id TEXT NOT NULL REFERENCES commission_statements(id) ON DELETE CASCADE,
  amount_centavos INTEGER NOT NULL CHECK (amount_centavos > 0),
  method TEXT NOT NULL CHECK (method IN ('Bank transfer', 'GCash')),
  reference TEXT NOT NULL,
  reference_key TEXT NOT NULL,
  payment_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Submitted', 'Rejected', 'Verified')),
  submitted_at TEXT NOT NULL,
  review_note TEXT,
  reviewed_at TEXT,
  reviewed_by TEXT,
  received_date TEXT
);
CREATE UNIQUE INDEX idx_commission_transfer_reference ON commission_remittances(method, reference_key) WHERE status IN ('Submitted', 'Verified');
CREATE UNIQUE INDEX idx_commission_open_remittance ON commission_remittances(statement_id) WHERE status IN ('Submitted', 'Verified');
CREATE INDEX idx_commission_remittance_statement ON commission_remittances(statement_id);
