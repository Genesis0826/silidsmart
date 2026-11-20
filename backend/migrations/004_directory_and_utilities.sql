-- Publication and occupancy are separate. Existing hidden units stay hidden.
ALTER TABLE units ADD COLUMN expected_available_from TEXT;

-- One private bill per unit, utility type and billing month, in centavos.
CREATE TABLE utility_records (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  utility_type TEXT NOT NULL CHECK (utility_type IN ('Electricity', 'Water')),
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
-- The unique index also supports portfolio joins by unit_id.
-- Rollback after reverting consumers: DROP TABLE utility_records;
-- ALTER TABLE units DROP COLUMN expected_available_from; remove migration row.
