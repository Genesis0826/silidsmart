-- Preserve all existing bill identities, amounts, statuses and references.
CREATE TABLE utility_records_v2 (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  utility_type TEXT NOT NULL CHECK (utility_type IN ('Electricity', 'Water', 'Wi-Fi')),
  billing_month TEXT NOT NULL,
  amount_centavos INTEGER NOT NULL CHECK (amount_centavos > 0),
  due_date TEXT NOT NULL,
  payment_status TEXT NOT NULL CHECK (payment_status IN ('Paid', 'Due', 'Overdue')),
  payment_date TEXT,
  reference TEXT NOT NULL DEFAULT '',
  recorded_at TEXT NOT NULL,
  CHECK ((payment_status = 'Paid' AND payment_date IS NOT NULL) OR (payment_status != 'Paid' AND payment_date IS NULL)),
  UNIQUE (unit_id, utility_type, billing_month)
);
INSERT INTO utility_records_v2 SELECT * FROM utility_records;
DROP TABLE utility_records;
ALTER TABLE utility_records_v2 RENAME TO utility_records;
-- Rollback: refuse while Wi-Fi rows exist; recreate the migration-004 table and
-- copy unchanged Electricity/Water records before removing this migration row.
