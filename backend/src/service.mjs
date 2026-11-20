import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAuthStore } from './auth.mjs';
import { randomUUID } from 'node:crypto';
import { createCommissionStore, manilaToday } from './commissions.mjs';
import { preparePitchFixtures, PITCH_OWNER_ID } from './pitch-seed.mjs';
import { PAYMENT_POLICY } from './payments.mjs';
import {
  seedOwners,
  seedProperties,
  seedUnits,
  seedTenants,
  seedRentRecords,
  seedInquiries,
  seedListingReports,
  seedSystemEvents,
} from './seed.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ValidationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.status = 400;
    this.details = details;
  }
}

export class NotFoundError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NotFoundError';
    this.code = code;
    this.status = 404;
    this.details = details;
  }
}

const isIsoDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

function publicAvailabilityFilter(availability) {
  if (!['available', 'all'].includes(availability)) {
    throw new ValidationError('INVALID_AVAILABILITY_FILTER', 'Availability must be available or all.');
  }
  return availability === 'all' ? 'u.published = 1' : "u.published = 1 AND u.status = 'Vacant'";
}

function validateUtility(input) {
  const { unitId, utilityType, billingMonth, amountPhp, dueDate, paymentStatus, paymentDate, reference = '' } = input;
  if (typeof unitId !== 'string' || !unitId || !['Electricity', 'Water', 'Wi-Fi'].includes(utilityType)
      || typeof billingMonth !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(billingMonth)) {
    throw new ValidationError('INVALID_UTILITY_BILL', 'Choose a unit, Electricity, Water or Wi-Fi, and a valid billing month.');
  }
  const centavos = Math.round(amountPhp * 100);
  if (typeof amountPhp !== 'number' || !Number.isFinite(amountPhp) || amountPhp <= 0 || amountPhp > 10_000_000
      || Math.abs(centavos - amountPhp * 100) > 0.000001) {
    throw new ValidationError('INVALID_UTILITY_AMOUNT', 'Bill amount must be positive, at most ₱10,000,000, with up to two decimal places.');
  }
  if (!isIsoDate(dueDate) || !['Paid', 'Due', 'Overdue'].includes(paymentStatus)
      || (paymentStatus === 'Paid' ? !isIsoDate(paymentDate) : paymentDate != null && paymentDate !== '')) {
    throw new ValidationError('INVALID_UTILITY_PAYMENT', 'Use a valid due date and manual status; Paid requires a payment date, and unpaid bills must have no payment date.');
  }
  if (typeof reference !== 'string' || reference.trim().length > 120) {
    throw new ValidationError('INVALID_UTILITY_REFERENCE', 'Payment reference must be at most 120 characters.');
  }
  return { ...input, centavos, reference: paymentStatus === 'Paid' ? reference.trim() : '', paymentDate: paymentStatus === 'Paid' ? paymentDate : null };
}

// Retain the legacy response name for existing clients; capacity no longer sets a fee.
export function calculateBmcSubscriptionTier(unitCount) {
  return { managedUnits: Number(unitCount) || 0, tierCode: 'FREE_MANAGEMENT',
    tierLabel: 'Free owner management • ₱0/mo', monthlyFeePhp: 0, customQuote: false,
    countingRule: '1 room or 1 apartment = 1 count',
    disclaimer: 'Listing and core owner management are free. Proposed online fees are 3% monthly rent and 5% short stays; checkout is not available.',
    paymentPolicy: PAYMENT_POLICY,
  };
}

export function createSilidSmartService(dbPath = path.join(__dirname, '..', 'data', 'silidsmart.sqlite')) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');

  // Run versioned SQL migration
  const migrationPath = path.join(__dirname, '..', 'migrations', '001_initial_b2b2c_schema.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  db.exec(migrationSql);

  const insertMigration = db.prepare(
    'INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)'
  );
  insertMigration.run('001_initial_b2b2c_schema.sql', new Date().toISOString());

  const mapMigration = '002_maps_and_accounts.sql';
  if (!db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(mapMigration)) {
    db.exec('BEGIN;');
    try {
      db.exec(fs.readFileSync(path.join(__dirname, '..', 'migrations', mapMigration), 'utf8'));
      insertMigration.run(mapMigration, new Date().toISOString());
      db.exec('COMMIT;');
    } catch (error) { db.exec('ROLLBACK;'); throw error; }
  }

  const shortStayMigration = '003_short_stay_records.sql';
  if (!db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(shortStayMigration)) {
    db.exec('BEGIN;');
    try {
      db.exec(fs.readFileSync(path.join(__dirname, '..', 'migrations', shortStayMigration), 'utf8'));
      insertMigration.run(shortStayMigration, new Date().toISOString());
      db.exec('COMMIT;');
    } catch (error) { db.exec('ROLLBACK;'); throw error; }
  }

  const directoryMigration = '004_directory_and_utilities.sql';
  if (!db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(directoryMigration)) {
    db.exec('BEGIN;');
    try {
      db.exec(fs.readFileSync(path.join(__dirname, '..', 'migrations', directoryMigration), 'utf8'));
      insertMigration.run(directoryMigration, new Date().toISOString());
      db.exec('COMMIT;');
    } catch (error) { db.exec('ROLLBACK;'); throw error; }
  }

  const commissionMigration = '005_monthly_commissions.sql';
  if (!db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(commissionMigration)) {
    db.exec('BEGIN;');
    try {
      db.exec(fs.readFileSync(path.join(__dirname, '..', 'migrations', commissionMigration), 'utf8'));
      insertMigration.run(commissionMigration, new Date().toISOString());
      db.exec('COMMIT;');
    } catch (error) { db.exec('ROLLBACK;'); throw error; }
  }
  const wifiMigration = '006_wifi_utility_records.sql';
  if (!db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(wifiMigration)) {
    db.exec('BEGIN;');
    try {
      db.exec(fs.readFileSync(path.join(__dirname, '..', 'migrations', wifiMigration), 'utf8'));
      insertMigration.run(wifiMigration, new Date().toISOString());
      db.exec('COMMIT;');
    } catch (error) { db.exec('ROLLBACK;'); throw error; }
  }
  const commissions = createCommissionStore(db, { ValidationError, NotFoundError, isIsoDate });

  function populateSeedData() {
    db.exec('BEGIN TRANSACTION;');
    try {
      db.exec(`
        DELETE FROM system_events;
        DELETE FROM listing_reports;
        DELETE FROM commission_remittances;
        DELETE FROM commission_statements;
        DELETE FROM short_stay_records;
        DELETE FROM inquiries;
        DELETE FROM utility_records;
        DELETE FROM rent_records;
        DELETE FROM tenants;
        DELETE FROM units;
        DELETE FROM properties;
        DELETE FROM owners;
      `);

      const insOwner = db.prepare(`
        INSERT INTO owners (id, display_name, contact_method, id_review_status, id_submission_date, id_document_name)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const o of seedOwners) {
        insOwner.run(o.id, o.displayName, o.contactMethod, o.idReviewStatus, o.idSubmissionDate, o.idDocumentName || null);
      }

      const insProp = db.prepare(`
        INSERT INTO properties (id, owner_id, name, type, area, address, rules_json, amenities_json, contact_method, image_url, latitude, longitude, map_scope)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const p of seedProperties) {
        insProp.run(
          p.id,
          p.ownerId,
          p.name,
          p.type,
          p.area,
          p.address,
          JSON.stringify(p.rules),
          JSON.stringify(p.amenities),
          p.contactMethod,
          p.imageUrl || null, p.latitude ?? null, p.longitude ?? null, p.mapScope ?? null
        );
      }

      const insUnit = db.prepare(`
        INSERT INTO units (id, property_id, unit_label, monthly_rent, deposit, status, published, last_updated, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const u of seedUnits) {
        insUnit.run(
          u.id,
          u.propertyId,
          u.unitLabel,
          u.monthlyRent,
          u.deposit,
          u.status,
          u.published ? 1 : 0,
          u.lastUpdated,
          u.description
        );
      }

      const insTenant = db.prepare(`
        INSERT INTO tenants (id, unit_id, name, contact, move_in_date, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const t of seedTenants) {
        insTenant.run(t.id, t.unitId, t.name, t.contact, t.moveInDate, t.notes || null);
      }

      const insRent = db.prepare(`
        INSERT INTO rent_records (id, unit_id, tenant_name, month, amount_due, payment_status, recorded_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const r of seedRentRecords) {
        insRent.run(r.id, r.unitId, r.tenantName, r.month, r.amountDue, r.paymentStatus, r.recordedDate);
      }

      const insInq = db.prepare(`
        INSERT INTO inquiries (id, unit_id, property_id, property_name, unit_label, renter_name, renter_contact, move_in_date, message, status, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const i of seedInquiries) {
        insInq.run(
          i.id,
          i.unitId,
          i.propertyId,
          i.propertyName,
          i.unitLabel,
          i.renterName,
          i.renterContact,
          i.moveInDate,
          i.message,
          i.status,
          i.submittedAt
        );
      }

      const insRep = db.prepare(`
        INSERT INTO listing_reports (id, unit_id, property_name, unit_label, reason, details, submitted_date, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const rep of seedListingReports) {
        insRep.run(
          rep.id,
          rep.unitId,
          rep.propertyName,
          rep.unitLabel,
          rep.reason,
          rep.details,
          rep.submittedDate,
          rep.status
        );
      }

      const insEvt = db.prepare(`
        INSERT INTO system_events (id, timestamp, category, message)
        VALUES (?, ?, ?, ?)
      `);
      for (const evt of seedSystemEvents) {
        insEvt.run(evt.id, evt.timestamp, evt.category, evt.message);
      }

      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }

  // Seed if empty
  const ownerCountRow = db.prepare('SELECT COUNT(*) AS count FROM owners').get();
  if (!ownerCountRow || ownerCountRow.count === 0) {
    populateSeedData();
  }

  function recordEvent(category, message) {
    const id = `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    db.prepare('INSERT INTO system_events (id, timestamp, category, message) VALUES (?, ?, ?, ?)').run(
      id,
      timestamp,
      category,
      message
    );
    return { id, timestamp, category, message };
  }

  const todayIso = () => new Date().toISOString().slice(0, 10);
  const defaultMoveInIso = () => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const currentMonthLabel = () =>
    new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const nowTimestamp = () => {
    const now = new Date();
    return `${now.toISOString().slice(0, 10)} ${now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  };

  // Add new example listings to existing demo databases without resetting user data.
  for (const p of seedProperties) {
    db.prepare(`INSERT OR IGNORE INTO properties (id, owner_id, name, type, area, address, rules_json, amenities_json, contact_method, image_url, latitude, longitude, map_scope)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(p.id, p.ownerId, p.name, p.type, p.area, p.address, JSON.stringify(p.rules), JSON.stringify(p.amenities), p.contactMethod, p.imageUrl || null, p.latitude ?? null, p.longitude ?? null, p.mapScope ?? null);
    db.prepare('UPDATE properties SET latitude = ?, longitude = ?, map_scope = ? WHERE id = ? AND latitude IS NULL AND longitude IS NULL AND address = ?')
      .run(p.latitude ?? null, p.longitude ?? null, p.mapScope ?? null, p.id, p.address);
  }
  for (const u of seedUnits.filter((unit) => unit.id.startsWith('unit-qc-'))) {
    db.prepare(`INSERT OR IGNORE INTO units (id, property_id, unit_label, monthly_rent, deposit, status, published, last_updated, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(u.id, u.propertyId, u.unitLabel, u.monthlyRent, u.deposit, u.status, Number(u.published), u.lastUpdated, u.description);
  }
  const auth = createAuthStore(db);

  // Mappers
  const mapOwner = (row) => ({
    id: row.id,
    displayName: row.display_name,
    contactMethod: row.contact_method,
    idReviewStatus: row.id_review_status,
    idSubmissionDate: row.id_submission_date,
    idDocumentName: row.id_document_name || undefined,
  });

  const mapPublicOwner = (row) => ({
    id: row.id,
    displayName: row.display_name,
    idReviewStatus: row.id_review_status,
    idSubmissionDate: row.id_submission_date,
  });

  const mapProperty = (row) => ({
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    type: row.type,
    area: row.area,
    address: row.address,
    rules: JSON.parse(row.rules_json),
    amenities: JSON.parse(row.amenities_json),
    contactMethod: row.contact_method,
    imageUrl: row.image_url || undefined,
    latitude: row.latitude,
    longitude: row.longitude,
    mapScope: row.map_scope,
  });

  const mapUnit = (row) => ({
    id: row.id,
    propertyId: row.property_id,
    unitLabel: row.unit_label,
    monthlyRent: row.monthly_rent,
    deposit: row.deposit,
    status: row.status,
    published: Boolean(row.published),
    lastUpdated: row.last_updated,
    description: row.description,
    expectedAvailableFrom: row.expected_available_from ?? null,
  });

  const mapTenant = (row) => ({
    id: row.id,
    unitId: row.unit_id,
    name: row.name,
    contact: row.contact,
    moveInDate: row.move_in_date,
    notes: row.notes || undefined,
  });

  const mapRentRecord = (row) => ({
    id: row.id,
    unitId: row.unit_id,
    tenantName: row.tenant_name,
    month: row.month,
    amountDue: row.amount_due,
    paymentStatus: row.payment_status,
    recordedDate: row.recorded_date,
  });

  const mapShortStay = (row) => ({
    id: row.id,
    unitId: row.unit_id,
    guestName: row.guest_name,
    checkInDate: row.check_in_date,
    checkOutDate: row.check_out_date,
    rentTotalPhp: row.rent_total_centavos / 100,
    source: row.source,
    status: row.status,
    commissionPercent: row.commission_percent,
    commissionPhp: row.status === 'Completed' && row.source === 'SilidSmart'
      ? Math.round(row.rent_total_centavos * row.commission_percent / 100) / 100 : 0,
    recordedAt: row.recorded_at,
    inquiryId: row.inquiry_id ?? null,
  });

  const mapUtility = (row) => ({
    id: row.id, unitId: row.unit_id, utilityType: row.utility_type,
    billingMonth: row.billing_month, amountPhp: row.amount_centavos / 100,
    dueDate: row.due_date, paymentStatus: row.payment_status,
    paymentDate: row.payment_date, reference: row.reference, recordedAt: row.recorded_at,
  });

  const mapInquiry = (row) => ({
    id: row.id,
    unitId: row.unit_id,
    propertyId: row.property_id,
    propertyName: row.property_name,
    unitLabel: row.unit_label,
    renterName: row.renter_name,
    renterContact: row.renter_contact,
    moveInDate: row.move_in_date,
    message: row.message,
    status: row.status,
    submittedAt: row.submitted_at,
  });

  const mapReport = (row) => ({
    id: row.id,
    unitId: row.unit_id,
    propertyName: row.property_name,
    unitLabel: row.unit_label,
    reason: row.reason,
    details: row.details,
    submittedDate: row.submitted_date,
    status: row.status,
  });

  return {
    auth,
    /**
     * Public B2C Endpoint Contract:
     * Default scope returns published vacancies; all scope includes published occupied units.
     * Zero tenant PII or rent ledger rows are ever queried or returned.
     */
    getPublicListings(availability = 'available') {
      const visibility = publicAvailabilityFilter(availability);
      const rows = db
        .prepare(`
          SELECT
            u.id AS unit_id,
            u.property_id,
            u.unit_label,
            u.monthly_rent,
            u.deposit,
            u.status,
            u.published,
            u.last_updated,
            u.description,
            u.expected_available_from,
            p.name AS property_name,
            p.type AS property_type,
            p.area AS property_area,
            p.address AS property_address,
            p.rules_json,
            p.amenities_json,
            p.contact_method AS property_contact,
            p.image_url,
            o.id AS owner_id,
            o.display_name AS owner_display_name,
            o.id_review_status
          FROM units u
          JOIN properties p ON p.id = u.property_id
          JOIN owners o ON o.id = p.owner_id
          WHERE ${visibility}
          ORDER BY u.id ASC
        `)
        .all();

      return {
        prototypeNotice: 'Concept prototype - sample properties only',
        renterFeePhp: 0,
        listings: rows.map((r) => ({
          unitId: r.unit_id,
          unitLabel: r.unit_label,
          monthlyRent: r.monthly_rent,
          deposit: r.deposit,
          status: r.status,
          expectedAvailableFrom: r.expected_available_from ?? null,
          lastUpdated: r.last_updated,
          freshnessNotice: `Availability last updated by owner: ${r.last_updated}`,
          description: r.description,
          property: {
            id: r.property_id,
            name: r.property_name,
            type: r.property_type,
            area: r.property_area,
            address: r.property_address,
            rules: JSON.parse(r.rules_json),
            amenities: JSON.parse(r.amenities_json),
            contactMethod: r.property_contact,
            imageUrl: r.image_url,
          },
          owner: {
            id: r.owner_id,
            displayName: r.owner_display_name,
            idReviewStatus: r.id_review_status,
            trustBadgeText: r.id_review_status === 'ID reviewed' ? 'Owner ID reviewed' : r.id_review_status,
            safetyDisclaimer:
              r.id_review_status === 'ID reviewed' ? 'This does not certify property safety' : null,
          },
        })),
      };
    },

    getPublicWorkspace(renterId = null, availability = 'available') {
      const visibility = publicAvailabilityFilter(availability);
      const owners = db
        .prepare('SELECT id, display_name, id_review_status, id_submission_date FROM owners ORDER BY id ASC')
        .all()
        .map(mapPublicOwner);
      const properties = db.prepare(`SELECT p.* FROM properties p WHERE EXISTS (SELECT 1 FROM units u WHERE u.property_id = p.id AND ${visibility}) ORDER BY p.id ASC`).all().map(mapProperty);
      const units = db
        .prepare(`SELECT u.* FROM units u WHERE ${visibility} ORDER BY u.id ASC`)
        .all()
        .map(mapUnit);
      const inquiries = renterId ? db.prepare('SELECT * FROM inquiries WHERE renter_id = ? ORDER BY id DESC').all(renterId).map(mapInquiry) : [];

      return {
        prototypeNotice: 'Concept prototype - sample properties only',
        renterFeePhp: 0,
        owners,
        properties,
        units,
        inquiries,
      };
    },

    getOwnerWorkspace(ownerId) {
      const ownerRow = db.prepare('SELECT * FROM owners WHERE id = ?').get(ownerId);
      if (!ownerRow) {
        throw new NotFoundError('OWNER_NOT_FOUND', `Owner ${ownerId} not found.`);
      }

      const owners = [mapOwner(ownerRow)];

      const properties = db
        .prepare('SELECT * FROM properties WHERE owner_id = ? ORDER BY id ASC')
        .all(ownerId)
        .map(mapProperty);

      const units = db
        .prepare(`
          SELECT u.*
          FROM units u
          JOIN properties p ON p.id = u.property_id
          WHERE p.owner_id = ?
          ORDER BY u.id ASC
        `)
        .all(ownerId)
        .map(mapUnit);

      const tenants = db
        .prepare(`
          SELECT t.*
          FROM tenants t
          JOIN units u ON u.id = t.unit_id
          JOIN properties p ON p.id = u.property_id
          WHERE p.owner_id = ?
          ORDER BY t.id ASC
        `)
        .all(ownerId)
        .map(mapTenant);

      const rentRecords = db
        .prepare(`
          SELECT r.*
          FROM rent_records r
          JOIN units u ON u.id = r.unit_id
          JOIN properties p ON p.id = u.property_id
          WHERE p.owner_id = ?
          ORDER BY r.id ASC
        `)
        .all(ownerId)
        .map(mapRentRecord);

      const inquiries = db
        .prepare(`
          SELECT i.*
          FROM inquiries i
          JOIN properties p ON p.id = i.property_id
          WHERE p.owner_id = ?
          ORDER BY i.id DESC
        `)
        .all(ownerId)
        .map(mapInquiry);

      return {
        owner: mapOwner(ownerRow),
        owners,
        properties,
        units,
        tenants,
        rentRecords,
        inquiries,
        shortStays: db.prepare(`SELECT s.* FROM short_stay_records s
          JOIN units u ON u.id = s.unit_id JOIN properties p ON p.id = u.property_id
          WHERE p.owner_id = ? ORDER BY s.recorded_at DESC, s.id DESC`).all(ownerId).map(mapShortStay),
        subscription: calculateBmcSubscriptionTier(units.length),
        utilityRecords: db.prepare(`SELECT r.* FROM utility_records r
          JOIN units u ON u.id = r.unit_id JOIN properties p ON p.id = u.property_id
          WHERE p.owner_id = ? ORDER BY r.billing_month DESC, r.recorded_at DESC`).all(ownerId).map(mapUtility),
        commissionStatements: commissions.list(ownerId),
      };
    },

    getBootstrapState() {
      const owners = db.prepare('SELECT * FROM owners ORDER BY id ASC').all().map(mapOwner);
      const properties = db.prepare('SELECT * FROM properties ORDER BY id ASC').all().map(mapProperty);
      const units = db.prepare('SELECT * FROM units ORDER BY id ASC').all().map(mapUnit);
      const tenants = db.prepare('SELECT * FROM tenants ORDER BY id ASC').all().map(mapTenant);
      const rentRecords = db.prepare('SELECT * FROM rent_records ORDER BY id ASC').all().map(mapRentRecord);
      const inquiries = db.prepare('SELECT * FROM inquiries ORDER BY id DESC').all().map(mapInquiry);
      const listingReports = db.prepare('SELECT * FROM listing_reports ORDER BY id DESC').all().map(mapReport);
      const systemEvents = db.prepare('SELECT * FROM system_events ORDER BY rowid DESC LIMIT 50').all();

      return {
        owners,
        properties,
        units,
        tenants,
        rentRecords,
        inquiries,
        listingReports,
        systemEvents,
        commissionStatements: commissions.list(),
      };
    },

    getOwnerSubscriptionSummary(ownerId) {
      const owner = db.prepare('SELECT * FROM owners WHERE id = ?').get(ownerId);
      if (!owner) {
        throw new NotFoundError('OWNER_NOT_FOUND', `Owner ${ownerId} not found.`);
      }
      const countRow = db
        .prepare(`
          SELECT COUNT(*) AS count
          FROM units u
          JOIN properties p ON p.id = u.property_id
          WHERE p.owner_id = ?
        `)
        .get(ownerId);
      return calculateBmcSubscriptionTier(countRow?.count || 0);
    },

    // Local CLI/test fixture preparation only; not exposed as an HTTP mutation.
    preparePitchDemo(options) {
      return { ...preparePitchFixtures(db, auth, commissions, options), workspace: this.getOwnerWorkspace(PITCH_OWNER_ID) };
    },

    issueCommissionStatement: (ownerId, month) => commissions.issue(ownerId, month),
    submitCommissionRemittance: (id, input) => commissions.submit(id, input),
    reviewCommissionRemittance: (id, input, adminId) => commissions.review(id, input, adminId),
    voidCommissionStatement: (id, reason) => commissions.void(id, reason),

    recordShortStay({ unitId, guestName, checkInDate, checkOutDate, rentTotalPhp, source, inquiryId = null }) {
      if (!isIsoDate(checkInDate) || !isIsoDate(checkOutDate) || checkOutDate <= checkInDate) {
        throw new ValidationError('INVALID_STAY_DATES', 'Use valid dates with checkout after check-in.');
      }
      if (checkOutDate > manilaToday()) throw new ValidationError('STAY_NOT_COMPLETED', 'Completed stays cannot have a future checkout date.');
      if (typeof guestName !== 'string' || !guestName.trim() || guestName.trim().length > 120) {
        throw new ValidationError('INVALID_GUEST_NAME', 'Enter a guest name of 1–120 characters.');
      }
      if (!['SilidSmart', 'Other'].includes(source)) {
        throw new ValidationError('INVALID_STAY_SOURCE', 'Choose SilidSmart or Other as the source.');
      }
      const centavos = Math.round(rentTotalPhp * 100);
      if (typeof rentTotalPhp !== 'number' || !Number.isFinite(rentTotalPhp) || rentTotalPhp <= 0
          || rentTotalPhp > 10_000_000 || Math.abs(centavos - rentTotalPhp * 100) > 0.000001) {
        throw new ValidationError('INVALID_STAY_RENT', 'Rent must be greater than zero, at most ₱10,000,000, with up to two decimal places.');
      }
      if (!db.prepare('SELECT id FROM units WHERE id = ?').get(unitId)) {
        throw new NotFoundError('UNIT_NOT_FOUND', 'Unit not found.');
      }
      if (inquiryId !== null && (typeof inquiryId !== 'string' || source !== 'SilidSmart'
          || !db.prepare('SELECT id FROM inquiries WHERE id = ? AND unit_id = ?').get(inquiryId, unitId))) {
        throw new ValidationError('INVALID_STAY_INQUIRY', 'Link a SilidSmart inquiry for this same unit, or leave the link empty. The link does not verify the stay.');
      }
      const owner = db.prepare('SELECT p.owner_id FROM units u JOIN properties p ON p.id = u.property_id WHERE u.id = ?').get(unitId);
      commissions.assertPeriodOpen(owner.owner_id, checkOutDate);
      // This is an owner-declared completed stay, not a reservation or payment receipt.
      db.prepare(`INSERT INTO short_stay_records
        (id, unit_id, guest_name, check_in_date, check_out_date, rent_total_centavos, source, status, commission_percent, recorded_at, inquiry_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Completed', 5, ?, ?)`)
        .run(randomUUID(), unitId, guestName.trim(), checkInDate, checkOutDate, centavos, source, new Date().toISOString(), inquiryId);
      return { ok: true };
    },

    updateShortStayStatus({ recordId, status }) {
      if (!['Completed', 'Cancelled'].includes(status)) {
        throw new ValidationError('INVALID_STAY_STATUS', 'Status must be Completed or Cancelled.');
      }
      const stay = db.prepare(`SELECT s.check_out_date, p.owner_id FROM short_stay_records s JOIN units u ON u.id = s.unit_id
        JOIN properties p ON p.id = u.property_id WHERE s.id = ?`).get(recordId);
      if (stay) commissions.assertPeriodOpen(stay.owner_id, stay.check_out_date);
      const result = db.prepare('UPDATE short_stay_records SET status = ? WHERE id = ?').run(status, recordId);
      if (!result.changes) throw new NotFoundError('STAY_NOT_FOUND', 'Short-stay record not found.');
      return { ok: true };
    },

    updateUnitDirectory({ unitId, published, expectedAvailableFrom }) {
      if (typeof published !== 'boolean' || (expectedAvailableFrom != null && expectedAvailableFrom !== '' && !isIsoDate(expectedAvailableFrom))) {
        throw new ValidationError('INVALID_DIRECTORY_SETTINGS', 'Choose publication and an optional valid expected availability date.');
      }
      const unit = db.prepare('SELECT status FROM units WHERE id = ?').get(unitId);
      if (!unit) throw new NotFoundError('UNIT_NOT_FOUND', 'Unit not found.');
      const result = db.prepare('UPDATE units SET published = ?, expected_available_from = ?, last_updated = ? WHERE id = ?')
        .run(Number(published), unit.status === 'Occupied' ? expectedAvailableFrom || null : null, todayIso(), unitId);
      if (!result.changes) throw new NotFoundError('UNIT_NOT_FOUND', 'Unit not found.');
      return { ok: true };
    },

    addUtilityRecord(input) {
      const bill = validateUtility(input);
      if (!db.prepare('SELECT id FROM units WHERE id = ?').get(bill.unitId)) throw new NotFoundError('UNIT_NOT_FOUND', 'Unit not found.');
      if (db.prepare('SELECT id FROM utility_records WHERE unit_id = ? AND utility_type = ? AND billing_month = ?')
          .get(bill.unitId, bill.utilityType, bill.billingMonth)) {
        throw new ValidationError('DUPLICATE_UTILITY_BILL', 'A bill already exists for this unit, utility and month. Edit the existing bill.');
      }
      db.prepare(`INSERT INTO utility_records
        (id, unit_id, utility_type, billing_month, amount_centavos, due_date, payment_status, payment_date, reference, recorded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(randomUUID(), bill.unitId, bill.utilityType, bill.billingMonth,
          bill.centavos, bill.dueDate, bill.paymentStatus, bill.paymentDate, bill.reference, new Date().toISOString());
      return { ok: true };
    },

    updateUtilityRecord(recordId, input) {
      const row = db.prepare('SELECT * FROM utility_records WHERE id = ?').get(recordId);
      if (!row) throw new NotFoundError('UTILITY_NOT_FOUND', 'Utility bill not found.');
      const bill = validateUtility({ ...mapUtility(row), ...input, unitId: row.unit_id, utilityType: row.utility_type, billingMonth: row.billing_month });
      db.prepare(`UPDATE utility_records SET amount_centavos = ?, due_date = ?, payment_status = ?, payment_date = ?, reference = ? WHERE id = ?`)
        .run(bill.centavos, bill.dueDate, bill.paymentStatus, bill.paymentDate, bill.reference, recordId);
      return { ok: true };
    },

    toggleUnitOccupancy({ unitId, newStatus, tenantName, tenantContact, moveInDate }) {
      if (!unitId || !['Vacant', 'Occupied'].includes(newStatus)) {
        throw new ValidationError('INVALID_OCCUPANCY_STATUS', 'newStatus must be "Vacant" or "Occupied".');
      }

      const unitRow = db.prepare('SELECT * FROM units WHERE id = ?').get(unitId);
      if (!unitRow) {
        throw new NotFoundError('UNIT_NOT_FOUND', `Unit ${unitId} does not exist.`);
      }

      const propRow = db.prepare('SELECT * FROM properties WHERE id = ?').get(unitRow.property_id);
      const published = unitRow.published;
      const lastUpdated = todayIso();

      db.exec('BEGIN TRANSACTION;');
      try {
        db.prepare("UPDATE units SET status = ?, published = ?, last_updated = ?, expected_available_from = CASE WHEN ? = 'Vacant' THEN NULL ELSE expected_available_from END WHERE id = ?").run(
          newStatus,
          published,
          lastUpdated,
          newStatus,
          unitId
        );

        if (newStatus === 'Occupied' && tenantName && String(tenantName).trim()) {
          const cleanName = String(tenantName).trim();
          const cleanContact = tenantContact && String(tenantContact).trim() ? String(tenantContact).trim() : '0917-000-0000';
          const cleanDate = moveInDate || lastUpdated;

          db.prepare('DELETE FROM tenants WHERE unit_id = ?').run(unitId);
          db.prepare(
            'INSERT INTO tenants (id, unit_id, name, contact, move_in_date, notes) VALUES (?, ?, ?, ?, ?, ?)'
          ).run(`tenant-${Date.now()}`, unitId, cleanName, cleanContact, cleanDate, 'Assigned via Owner Vacancy Sync');

          db.prepare(
            'INSERT INTO rent_records (id, unit_id, tenant_name, month, amount_due, payment_status, recorded_date) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).run(
            `rent-${Date.now()}`,
            unitId,
            cleanName,
            currentMonthLabel(),
            unitRow.monthly_rent,
            'Due',
            lastUpdated
          );
        } else if (newStatus === 'Vacant') {
          db.prepare('DELETE FROM tenants WHERE unit_id = ?').run(unitId);
        }

        recordEvent(
          'SYNC',
          `[Sync Engine] Unit ${unitRow.unit_label} (${propRow?.name || 'Property'}) set to ${newStatus}. Public directory cache updated immediately.`
        );

        db.exec('COMMIT;');
      } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
      }

      return this.getBootstrapState();
    },

    addUnit({ propertyId, unitLabel, monthlyRent, deposit, description }) {
      if (!propertyId || !unitLabel || !String(unitLabel).trim()) {
        throw new ValidationError('INVALID_UNIT_PAYLOAD', 'propertyId and unitLabel are required.');
      }
      const rentNum = Number(monthlyRent);
      const depNum = Number(deposit ?? 0);
      if (!Number.isFinite(rentNum) || rentNum <= 0) {
        throw new ValidationError('INVALID_MONTHLY_RENT', 'monthlyRent must be a positive number.');
      }

      const propRow = db.prepare('SELECT * FROM properties WHERE id = ?').get(propertyId);
      if (!propRow) {
        throw new NotFoundError('PROPERTY_NOT_FOUND', `Property ${propertyId} not found.`);
      }

      const id = `unit-${Date.now()}`;
      const lastUpdated = todayIso();
      db.prepare(`
        INSERT INTO units (id, property_id, unit_label, monthly_rent, deposit, status, published, last_updated, description)
        VALUES (?, ?, ?, ?, ?, 'Vacant', 1, ?, ?)
      `).run(
        id,
        propertyId,
        String(unitLabel).trim(),
        Math.round(rentNum),
        Math.max(0, Math.round(depNum)),
        lastUpdated,
        description ? String(description).trim() : 'Standard comfortable rental space with basic fixtures.'
      );

      recordEvent(
        'SYNC',
        `[Sync Engine] New unit ${String(unitLabel).trim()} added to ${propRow.name}. Owner tier room count recalculated.`
      );

      return this.getBootstrapState();
    },

    updateRentStatus({ recordId, paymentStatus }) {
      if (!recordId || !['Paid', 'Due', 'Overdue'].includes(paymentStatus)) {
        throw new ValidationError('INVALID_PAYMENT_STATUS', 'paymentStatus must be Paid, Due, or Overdue.');
      }
      const res = db
        .prepare('UPDATE rent_records SET payment_status = ?, recorded_date = ? WHERE id = ?')
        .run(paymentStatus, todayIso(), recordId);
      if (res.changes === 0) {
        throw new NotFoundError('RENT_RECORD_NOT_FOUND', `Rent record ${recordId} not found.`);
      }

      recordEvent('BILLING', `[Rent Ledger] Record ${recordId} payment status updated to "${paymentStatus}".`);
      return this.getBootstrapState();
    },

    submitInquiry({ unitId, propertyId, propertyName, unitLabel, renterName, renterContact, moveInDate, message, renterId }) {
      if (!unitId || !propertyId || !renterName || !String(renterName).trim() || !renterContact || !String(renterContact).trim()) {
        throw new ValidationError('INVALID_INQUIRY_PAYLOAD', 'unitId, propertyId, renterName, and renterContact are required.');
      }

      const target = db.prepare("SELECT id FROM units WHERE id = ? AND property_id = ? AND status = 'Vacant' AND published = 1").get(unitId, propertyId);
      if (!target) throw new ValidationError('LISTING_UNAVAILABLE', 'This listing is no longer available for viewing.');
      const id = `inq-${Date.now()}`;
      const submittedAt = nowTimestamp();
      const targetMoveIn = moveInDate || defaultMoveInIso();
      db.prepare(`
        INSERT INTO inquiries (id, unit_id, property_id, property_name, unit_label, renter_name, renter_contact, move_in_date, message, status, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?)
      `).run(
        id,
        unitId,
        propertyId,
        propertyName || 'Property',
        unitLabel || 'Unit',
        String(renterName).trim(),
        String(renterContact).trim(),
        targetMoveIn,
        message ? String(message).trim() : 'Requesting in-person viewing.',
        submittedAt
      );

      if (renterId) db.prepare('UPDATE inquiries SET renter_id = ? WHERE id = ?').run(renterId, id);

      recordEvent(
        'INQUIRY',
        `[Viewing Request] ${String(renterName).trim()} requested viewing for ${propertyName} (${unitLabel}) on ${targetMoveIn}.`
      );

      return this.getBootstrapState();
    },

    respondInquiry({ inquiryId, action }) {
      if (!inquiryId || !['Approved', 'Declined'].includes(action)) {
        throw new ValidationError('INVALID_INQUIRY_ACTION', 'action must be Approved or Declined.');
      }
      const res = db.prepare('UPDATE inquiries SET status = ? WHERE id = ?').run(action, inquiryId);
      if (res.changes === 0) {
        throw new NotFoundError('INQUIRY_NOT_FOUND', `Inquiry ${inquiryId} not found.`);
      }

      recordEvent('INQUIRY', `[Viewing Request] Inquiry ${inquiryId} was ${action} by property manager.`);
      return this.getBootstrapState();
    },

    submitReport({ unitId, propertyName, unitLabel, reason, details }) {
      if (!unitId || !reason || !String(reason).trim()) {
        throw new ValidationError('INVALID_REPORT_PAYLOAD', 'unitId and reason are required.');
      }

      const id = `rep-${Date.now()}`;
      db.prepare(`
        INSERT INTO listing_reports (id, unit_id, property_name, unit_label, reason, details, submitted_date, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending')
      `).run(
        id,
        unitId,
        propertyName || 'Property',
        unitLabel || 'Unit',
        String(reason).trim(),
        details ? String(details).trim() : 'Reported via public directory.',
        todayIso()
      );

      recordEvent(
        'MODERATION',
        `[Listing Flag] Renter flagged ${propertyName} ${unitLabel}: "${String(reason).trim()}". Escalated to admin review queue.`
      );

      return this.getBootstrapState();
    },

    reviewOwnerId({ ownerId, newStatus }) {
      if (!ownerId || !['Pending review', 'ID reviewed', 'Needs correction'].includes(newStatus)) {
        throw new ValidationError('INVALID_ID_STATUS', 'newStatus must be Pending review, ID reviewed, or Needs correction.');
      }
      const owner = db.prepare('SELECT * FROM owners WHERE id = ?').get(ownerId);
      if (!owner) {
        throw new NotFoundError('OWNER_NOT_FOUND', `Owner ${ownerId} not found.`);
      }

      db.prepare('UPDATE owners SET id_review_status = ? WHERE id = ?').run(newStatus, ownerId);
      recordEvent(
        'MODERATION',
        `[ID Verification] Owner "${owner.display_name}" verification status changed to "${newStatus}". Public trust badges refreshed.`
      );

      return this.getBootstrapState();
    },

    resolveReport({ reportId }) {
      if (!reportId) {
        throw new ValidationError('INVALID_REPORT_ID', 'reportId is required.');
      }
      const res = db.prepare("UPDATE listing_reports SET status = 'Resolved' WHERE id = ?").run(reportId);
      if (res.changes === 0) {
        throw new NotFoundError('REPORT_NOT_FOUND', `Report ${reportId} not found.`);
      }

      recordEvent('MODERATION', `[Moderation] Listing flag ${reportId} marked resolved by platform admin.`);
      return this.getBootstrapState();
    },

    togglePublishUnit({ unitId, published }) {
      if (!unitId || typeof published !== 'boolean') {
        throw new ValidationError('INVALID_PUBLISH_PAYLOAD', 'unitId and boolean published are required.');
      }
      const res = db.prepare('UPDATE units SET published = ? WHERE id = ?').run(published ? 1 : 0, unitId);
      if (res.changes === 0) {
        throw new NotFoundError('UNIT_NOT_FOUND', `Unit ${unitId} not found.`);
      }

      recordEvent(
        'MODERATION',
        `[Moderation] Unit ${unitId} publish state toggled to ${published ? 'PUBLISHED' : 'DELISTED'} by admin.`
      );
      return this.getBootstrapState();
    },

    resetDatabase() {
      populateSeedData();
      auth.seedDemoAccounts();
      recordEvent('SYNC', '[System Reset] All SQLite tables reset to canonical BMC seed state.');
      return this.getBootstrapState();
    },

    onboardOwner({
      ownerId,
      displayName,
      contactMethod,
      idDocumentName,
      propertyName,
      propertyType = 'Boarding house',
      area = 'Sampaloc, Manila',
      address = 'Sampaloc University Belt, Manila',
      initialUnitsCount = 1,
      monthlyRent = 3800,
      account,
    }) {
      if (!displayName || !String(displayName).trim() || !propertyName || !String(propertyName).trim()) {
        throw new ValidationError('INVALID_ONBOARD_PAYLOAD', 'displayName and propertyName are required.');
      }

      const validTypes = ['Boarding house', 'Apartment', 'Dorm', 'Condo'];
      const cleanType = validTypes.includes(propertyType) ? propertyType : 'Boarding house';
      const newOwnerId = ownerId || `owner-${Date.now()}`;
      const newPropId = `prop-${Date.now()}`;
      const cleanName = String(displayName).trim();
      const cleanPropName = String(propertyName).trim();
      const cleanContact = contactMethod && String(contactMethod).trim() ? String(contactMethod).trim() : '0917-000-0000';
      const today = todayIso();
      const rentNum = Math.max(1000, Math.round(Number(monthlyRent) || 3800));
      const unitsToCreate = Math.min(Math.max(1, Number(initialUnitsCount) || 1), 5);

      let user;
      db.exec('BEGIN TRANSACTION;');
      try {
        db.prepare(`
          INSERT INTO owners (id, display_name, contact_method, id_review_status, id_submission_date, id_document_name)
          VALUES (?, ?, ?, 'Pending review', ?, ?)
        `).run(
          newOwnerId,
          cleanName,
          cleanContact,
          today,
          idDocumentName ? String(idDocumentName).trim() : 'Government_ID_Submission.pdf'
        );

        db.prepare(`
          INSERT INTO properties (id, owner_id, name, type, area, address, rules_json, amenities_json, contact_method, image_url, map_scope)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          newPropId,
          newOwnerId,
          cleanPropName,
          cleanType,
          String(area).trim(),
          String(address).trim(),
          JSON.stringify(['No smoking inside rooms', 'Visitors allowed until 9:00 PM', '1 month advance, 1 month deposit']),
          JSON.stringify(['High-Speed Wi-Fi', 'Study Desk & Chair', 'Individual Sub-meter', '24/7 CCTV Security']),
          cleanContact,
          'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
          /quezon city/i.test(area) ? 'qc' : /sampaloc|ust|manila/i.test(area) ? 'ust' : null
        );

        const insUnit = db.prepare(`
          INSERT INTO units (id, property_id, unit_label, monthly_rent, deposit, status, published, last_updated, description)
          VALUES (?, ?, ?, ?, ?, 'Vacant', 1, ?, ?)
        `);

        for (let i = 1; i <= unitsToCreate; i++) {
          insUnit.run(
            `unit-${Date.now()}-${i}`,
            newPropId,
            `Room 10${i}`,
            rentNum,
            rentNum,
            today,
            `Newly onboarded ${cleanType.toLowerCase()} unit with Wi-Fi, study desk, and sub-meter.`
          );
        }

        recordEvent(
          'SYNC',
          `[Owner Onboarding] ${cleanName} registered "${cleanPropName}" (${unitsToCreate} initial vacant unit(s)). ID queued for admin review.`
        );

        if (account) user = auth.register(account, 'owner', newOwnerId);
        db.exec('COMMIT;');
      } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
      }

      return {
        onboardedOwnerId: newOwnerId,
        user,
        state: this.getBootstrapState(),
      };
    },
  };
}
