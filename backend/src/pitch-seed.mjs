import { manilaToday } from './commissions.mjs';

export const PITCH_OWNER_ID = 'pitch-demo-owner';
export const PITCH_PROPERTY_ID = 'pitch-demo-property';
export const PITCH_ACCOUNT_ID = 'pitch-demo-account';
export const PITCH_EMAIL = 'pitch.owner@example.test';
const ownerName = 'Pitch Demo Owner (Example)';
export const PITCH_UNITS = [
  { id: 'pitch-demo-unit-1', label: 'PITCH 01 - Vacancy Demo', rent: 6000, status: 'Vacant', purpose: 'Find, mark occupied, reload Available now' },
  { id: 'pitch-demo-unit-2', label: 'PITCH 02 - Occupied Demo', rent: 6500, status: 'Occupied', purpose: 'All published units and expected availability' },
  { id: 'pitch-demo-unit-3', label: 'PITCH 03 - Rent and Utilities', rent: 7000, status: 'Occupied', purpose: 'Private monthly rent and Electricity/Water records' },
  { id: 'pitch-demo-unit-4', label: 'PITCH 04 - Short Stay Demo', rent: 9000, status: 'Vacant', purpose: 'Completed SilidSmart stay and source exclusions' },
  { id: 'pitch-demo-unit-5', label: 'PITCH 05 - Commission Demo', rent: 10000, status: 'Vacant', purpose: 'Monthly statement and staff remittance review' },
];

// Opt-in fictional fixtures only. Normal startup and global seeds do not call this.
export function preparePitchFixtures(db, auth, commissions, { restore = false } = {}) {
  const today = manilaToday();
  const [year, monthNumber] = today.split('-').map(Number);
  const billingMonth = new Date(Date.UTC(year, monthNumber - 2, 1)).toISOString().slice(0, 7);
  const currentMonth = today.slice(0, 7);
  const firstOfCurrentMonth = `${currentMonth}-01`;
  const expectedDate = new Date(Date.UTC(year, monthNumber, 5)).toISOString().slice(0, 10);
  const utilityDue = new Date(Date.parse(`${today}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
  const rentMonth = new Date(`${firstOfCurrentMonth}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const existingOwner = db.prepare('SELECT * FROM owners WHERE id = ?').get(PITCH_OWNER_ID);
  const accountById = db.prepare('SELECT * FROM accounts WHERE id = ?').get(PITCH_ACCOUNT_ID);
  const accountByEmail = db.prepare('SELECT id FROM accounts WHERE email = ? COLLATE NOCASE').get(PITCH_EMAIL);
  const conflict = () => { throw new Error('Pitch fixture identity conflicts with existing records. No pitch data was changed.'); };
  if (existingOwner && existingOwner.display_name !== ownerName) conflict();
  if (accountByEmail && accountByEmail.id !== PITCH_ACCOUNT_ID) conflict();
  if (accountById && (accountById.email !== PITCH_EMAIL || accountById.role !== 'owner'
      || (accountById.owner_id !== null && accountById.owner_id !== PITCH_OWNER_ID))) conflict();
  if (existingOwner && !accountById) conflict();
  const properties = db.prepare('SELECT id FROM properties WHERE owner_id = ?').all(PITCH_OWNER_ID);
  if (properties.some(p => p.id !== PITCH_PROPERTY_ID)) throw new Error('The pitch owner has additional properties. Scoped restore is blocked to protect them.');
  const foreignProperty = db.prepare('SELECT owner_id FROM properties WHERE id = ?').get(PITCH_PROPERTY_ID);
  if (foreignProperty && foreignProperty.owner_id !== PITCH_OWNER_ID) conflict();
  const existingUnits = db.prepare('SELECT id FROM units WHERE property_id = ?').all(PITCH_PROPERTY_ID);
  if (existingUnits.some(u => !PITCH_UNITS.some(p => p.id === u.id))) throw new Error('The pitch property has additional units. Scoped restore is blocked to protect them.');
  if (existingOwner && !restore) {
    if (existingUnits.length !== 5) throw new Error('The pitch portfolio is incomplete. Run seed:pitch -- --restore to rebuild only the dedicated pitch fixtures.');
    const storedMonth = db.prepare('SELECT billing_month FROM commission_statements WHERE owner_id = ? ORDER BY issued_at DESC LIMIT 1').get(PITCH_OWNER_ID)?.billing_month;
    return { mode: 'kept', ownerId: PITCH_OWNER_ID, propertyId: PITCH_PROPERTY_ID, billingMonth: storedMonth || billingMonth };
  }
  const propertyName = 'SilidSmart Pitch House (Example)';
  const now = new Date().toISOString();
  db.exec('BEGIN;');
  try {
    if (restore && existingOwner) {
      db.prepare('DELETE FROM commission_statements WHERE owner_id = ?').run(PITCH_OWNER_ID);
      db.prepare('DELETE FROM units WHERE property_id = ?').run(PITCH_PROPERTY_ID);
      db.prepare('DELETE FROM properties WHERE id = ?').run(PITCH_PROPERTY_ID);
    }
    db.prepare(`INSERT OR IGNORE INTO owners (id, display_name, contact_method, id_review_status, id_submission_date, id_document_name)
      VALUES (?, ?, 'Fictional pitch account; no real contact', 'Pending review', ?, 'Sample only - no real ID submitted')`).run(PITCH_OWNER_ID, ownerName, today);
    db.prepare(`INSERT INTO properties (id, owner_id, name, type, area, address, rules_json, amenities_json, contact_method, image_url, latitude, longitude, map_scope)
      VALUES (?, ?, ?, 'Apartment', 'Sampaloc (UST) - example pitch area', 'Fictional pitch location only; not a verified address', ?, ?, 'Fictional pitch listing; use sample inquiries only', ?, 14.6094, 120.9885, 'ust')`)
      .run(PITCH_PROPERTY_ID, PITCH_OWNER_ID, propertyName, JSON.stringify(['Sample rule: no smoking', 'Short stays by direct owner agreement only; no in-app reservation']),
        JSON.stringify(['Example Wi-Fi', 'Study desk', 'Example kitchenette']), 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80');
    for (const u of PITCH_UNITS) {
      db.prepare(`INSERT INTO units (id, property_id, unit_label, monthly_rent, deposit, status, published, last_updated, description, expected_available_from)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`)
        .run(u.id, PITCH_PROPERTY_ID, u.label, u.rent, u.rent, u.status, today,
          `Fictional pitch fixture: ${u.purpose}. Listing price is monthly rent; the private stay ledger uses total stay accommodation rent. No real booking or funds.`, u.id === 'pitch-demo-unit-2' ? expectedDate : null);
    }
    if (accountById) db.prepare('UPDATE accounts SET owner_id = ? WHERE id = ?').run(PITCH_OWNER_ID, PITCH_ACCOUNT_ID);
    else auth.register({ id: PITCH_ACCOUNT_ID, name: ownerName, email: PITCH_EMAIL, phone: '', password: 'password123' }, 'owner', PITCH_OWNER_ID);
    for (const [number, name, amount, status] of [[2, 'DEMO TENANT B - fictional', 6500, 'Paid'], [3, 'DEMO TENANT C - fictional', 7000, 'Due']]) {
      db.prepare('INSERT INTO tenants (id, unit_id, name, contact, move_in_date, notes) VALUES (?, ?, ?, ?, ?, ?)')
        .run(`pitch-demo-tenant-${number}`, `pitch-demo-unit-${number}`, name, 'Demo only - no real phone', `${billingMonth}-01`, 'Sample tenant record; private owner workspace only.');
      db.prepare('INSERT INTO rent_records (id, unit_id, tenant_name, month, amount_due, payment_status, recorded_date) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(`pitch-demo-rent-${number}`, `pitch-demo-unit-${number}`, name, rentMonth, amount, status, firstOfCurrentMonth);
    }
    for (const [type, amount, status] of [['Electricity', 120000, 'Due'], ['Water', 30000, 'Paid']]) {
      db.prepare(`INSERT INTO utility_records (id, unit_id, utility_type, billing_month, amount_centavos, due_date, payment_status, payment_date, reference, recorded_at)
        VALUES (?, 'pitch-demo-unit-3', ?, ?, ?, ?, ?, ?, ?, ?)`).run(`pitch-demo-utility-${type.toLowerCase()}`, type, currentMonth, amount, utilityDue, status,
          status === 'Paid' ? today : null, status === 'Paid' ? 'DEMO-NO-FUNDS-WATER' : '', now);
    }
    const renter = db.prepare("SELECT id FROM accounts WHERE id = 'user-renter-1'").get();
    for (const [number, name, status, moveIn] of [[1, 'Juan Dela Cruz', 'Pending', utilityDue], [4, 'DEMO SHORT-STAY GUEST - fictional', 'Approved', `${billingMonth}-05`]]) {
      db.prepare(`INSERT INTO inquiries (id, unit_id, property_id, property_name, unit_label, renter_name, renter_contact, move_in_date, message, status, submitted_at, renter_id)
        VALUES (?, ?, ?, ?, ?, ?, 'Demo only - no real contact', ?, 'Fictional pitch inquiry. Approval does not reserve the unit.', ?, ?, ?)`)
        .run(`pitch-demo-inquiry-${number}`, `pitch-demo-unit-${number}`, PITCH_PROPERTY_ID, propertyName, PITCH_UNITS[number - 1].label, name, moveIn, status, now, number === 1 ? renter?.id || null : null);
    }
    const stays = [
      ['eligible-4', 4, 5, 7, 400000, 'SilidSmart', 'Completed'],
      ['eligible-5', 5, 15, 18, 600000, 'SilidSmart', 'Completed'],
      ['other', 4, 20, 22, 200000, 'Other', 'Completed'],
      ['cancelled', 5, 23, 24, 100000, 'SilidSmart', 'Cancelled'],
    ];
    for (const [key, unit, dayIn, dayOut, rent, source, status] of stays) {
      db.prepare(`INSERT INTO short_stay_records (id, unit_id, guest_name, check_in_date, check_out_date, rent_total_centavos, source, status, commission_percent, recorded_at, inquiry_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 5, ?, ?)`).run(`pitch-demo-stay-${key}`, `pitch-demo-unit-${unit}`, `DEMO ${key} GUEST - fictional`,
          `${billingMonth}-${String(dayIn).padStart(2, '0')}`, `${billingMonth}-${String(dayOut).padStart(2, '0')}`, rent, source, status, now, key === 'eligible-4' ? 'pitch-demo-inquiry-4' : null);
    }
    const statementId = commissions.issue(PITCH_OWNER_ID, billingMonth);
    commissions.submit(statementId, { amountPhp: 500, method: 'Bank transfer', reference: `DEMO-NO-FUNDS-${billingMonth}`, paymentDate: firstOfCurrentMonth });
    db.exec('COMMIT;');
    return { mode: existingOwner ? 'restored' : 'created', ownerId: PITCH_OWNER_ID, propertyId: PITCH_PROPERTY_ID, billingMonth };
  } catch (error) { db.exec('ROLLBACK;'); throw error; }
}
