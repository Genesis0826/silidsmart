-- Example map locations are illustrative, not verified property addresses.
ALTER TABLE properties ADD COLUMN latitude REAL CHECK (latitude BETWEEN -90 AND 90);
ALTER TABLE properties ADD COLUMN longitude REAL CHECK (longitude BETWEEN -180 AND 180);
ALTER TABLE properties ADD COLUMN map_scope TEXT CHECK (map_scope IN ('ust', 'qc'));
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('renter', 'owner', 'admin')),
  owner_id TEXT REFERENCES owners(id) ON DELETE SET NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL
);
ALTER TABLE inquiries ADD COLUMN renter_id TEXT REFERENCES accounts(id) ON DELETE SET NULL;
CREATE INDEX idx_inquiries_renter ON inquiries(renter_id);
