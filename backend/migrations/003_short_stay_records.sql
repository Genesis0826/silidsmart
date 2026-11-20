-- Private owner-declared completed stays. No reservation or payment processing.
-- Rollback: DROP TABLE short_stay_records; remove this migration's tracking row.
CREATE TABLE short_stay_records (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  check_in_date TEXT NOT NULL,
  check_out_date TEXT NOT NULL CHECK (check_out_date > check_in_date),
  rent_total_centavos INTEGER NOT NULL CHECK (rent_total_centavos > 0),
  source TEXT NOT NULL CHECK (source IN ('SilidSmart', 'Other')),
  status TEXT NOT NULL CHECK (status IN ('Completed', 'Cancelled')),
  commission_percent INTEGER NOT NULL CHECK (commission_percent = 5),
  recorded_at TEXT NOT NULL
);
CREATE INDEX idx_short_stay_records_unit_id ON short_stay_records(unit_id);
