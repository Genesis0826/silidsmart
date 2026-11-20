import { randomUUID } from 'node:crypto';

// Date-only business periods use the Philippines calendar; timestamps remain UTC.
export function manilaToday() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
}

export function createCommissionStore(db, { ValidationError, NotFoundError, isIsoDate }) {
  const fail = (code, message) => { throw new ValidationError(code, message); };
  const statementRow = (id) => {
    const row = db.prepare('SELECT * FROM commission_statements WHERE id = ?').get(id);
    if (!row) throw new NotFoundError('STATEMENT_NOT_FOUND', 'Commission statement not found.');
    return row;
  };
  const activeRemittance = id => db.prepare("SELECT * FROM commission_remittances WHERE statement_id = ? AND status IN ('Submitted', 'Verified')").get(id);
  const mapRemittance = r => ({
    id: r.id, amountPhp: r.amount_centavos / 100, method: r.method, reference: r.reference,
    paymentDate: r.payment_date, status: r.status, submittedAt: r.submitted_at,
    reviewNote: r.review_note, reviewedAt: r.reviewed_at, receivedDate: r.received_date,
  });
  function mapStatement(s) {
    const remittances = db.prepare('SELECT * FROM commission_remittances WHERE statement_id = ? ORDER BY submitted_at DESC, rowid DESC').all(s.id);
    const active = remittances.find(r => r.status !== 'Rejected');
    const paymentStatus = s.state === 'Void' ? 'Void' : s.commission_centavos === 0 ? 'No commission'
      : active?.status === 'Verified' ? 'Verified' : active ? 'Under review' : s.due_date < manilaToday() ? 'Overdue' : 'Due';
    return {
      id: s.id, ownerId: s.owner_id, billingMonth: s.billing_month, version: s.version, state: s.state,
      rentTotalPhp: s.rent_total_centavos / 100, commissionPhp: s.commission_centavos / 100,
      outstandingPhp: s.state === 'Void' || active?.status === 'Verified' ? 0 : s.commission_centavos / 100,
      items: JSON.parse(s.items_json), dueDate: s.due_date, issuedAt: s.issued_at,
      voidReason: s.void_reason, paymentStatus, remittances: remittances.map(mapRemittance),
    };
  }
  return {
    list(ownerId) {
      return (ownerId ? db.prepare('SELECT * FROM commission_statements WHERE owner_id = ? ORDER BY billing_month DESC, version DESC').all(ownerId)
        : db.prepare('SELECT * FROM commission_statements ORDER BY billing_month DESC, issued_at DESC, version DESC').all()).map(mapStatement);
    },
    assertPeriodOpen(ownerId, checkout) {
      if (db.prepare("SELECT id FROM commission_statements WHERE owner_id = ? AND billing_month = ? AND state = 'Issued'").get(ownerId, checkout.slice(0, 7))) {
        fail('COMMISSION_PERIOD_LOCKED', 'This checkout month has an issued statement. Ask an administrator to void an unpaid statement before correcting it. Verified statements stay locked.');
      }
    },
    issue(ownerId, month) {
      if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !isIsoDate(`${month}-01`) || month < '2000-01' || month >= manilaToday().slice(0, 7)) {
        fail('INVALID_COMMISSION_MONTH', 'Choose a completed calendar month, from January 2000 onward. The current month is a running preview.');
      }
      // Retry-safe: an existing issued snapshot is returned unchanged.
      const existing = db.prepare("SELECT id FROM commission_statements WHERE owner_id = ? AND billing_month = ? AND state = 'Issued'").get(ownerId, month);
      if (existing) return existing.id;
      const rows = db.prepare(`SELECT s.*, u.unit_label, p.name AS property_name FROM short_stay_records s
        JOIN units u ON u.id = s.unit_id JOIN properties p ON p.id = u.property_id
        WHERE p.owner_id = ? AND substr(s.check_out_date, 1, 7) = ? ORDER BY s.check_out_date, s.id`).all(ownerId, month);
      const items = rows.map(r => {
        const eligible = r.source === 'SilidSmart' && r.status === 'Completed';
        return { stayId: r.id, unitLabel: r.unit_label, propertyName: r.property_name,
          checkInDate: r.check_in_date, checkOutDate: r.check_out_date, rentTotalPhp: r.rent_total_centavos / 100,
          source: r.source, status: r.status, inquiryId: r.inquiry_id, commissionPercent: r.commission_percent,
          commissionPhp: eligible ? Math.round(r.rent_total_centavos * r.commission_percent / 100) / 100 : 0 };
      });
      const rent = rows.reduce((sum, r) => sum + (r.source === 'SilidSmart' && r.status === 'Completed' ? r.rent_total_centavos : 0), 0);
      const fee = rows.reduce((sum, r) => sum + (r.source === 'SilidSmart' && r.status === 'Completed' ? Math.round(r.rent_total_centavos * r.commission_percent / 100) : 0), 0);
      const [year, monthNumber] = month.split('-').map(Number);
      const dueDate = new Date(Date.UTC(year, monthNumber, 10)).toISOString().slice(0, 10);
      const version = db.prepare('SELECT COALESCE(MAX(version), 0) + 1 AS version FROM commission_statements WHERE owner_id = ? AND billing_month = ?').get(ownerId, month).version;
      const id = randomUUID();
      db.prepare(`INSERT INTO commission_statements (id, owner_id, billing_month, version, state, rent_total_centavos, commission_centavos, items_json, due_date, issued_at)
        VALUES (?, ?, ?, ?, 'Issued', ?, ?, ?, ?, ?)`).run(id, ownerId, month, version, rent, fee, JSON.stringify(items), dueDate, new Date().toISOString());
      return id;
    },
    submit(statementId, input) {
      const s = statementRow(statementId);
      if (s.state !== 'Issued' || s.commission_centavos === 0) fail('STATEMENT_NOT_PAYABLE', 'Only an issued statement with commission due can receive a remittance report.');
      if (activeRemittance(statementId)) fail('REMITTANCE_ALREADY_REPORTED', 'This statement already has a transfer under review or verified.');
      const { amountPhp, method, reference, paymentDate } = input;
      const cents = Math.round(amountPhp * 100);
      if (typeof amountPhp !== 'number' || !Number.isFinite(amountPhp) || Math.abs(amountPhp * 100 - cents) > 0.000001 || cents !== s.commission_centavos) {
        fail('INVALID_REMITTANCE_AMOUNT', 'Report one transfer for the exact commission amount. Partial or combined payments are outside this prototype.');
      }
      if (!['Bank transfer', 'GCash'].includes(method) || !isIsoDate(paymentDate) || paymentDate > manilaToday()
          || typeof reference !== 'string' || !reference.trim() || reference.trim().length > 120 || /[\x00-\x1f\x7f]/.test(reference)) {
        fail('INVALID_REMITTANCE_DETAILS', 'Choose Bank transfer or GCash, a payment date no later than today, and a reference of 1–120 characters.');
      }
      const key = reference.trim().replace(/\s+/g, ' ').toLowerCase();
      if (db.prepare("SELECT id FROM commission_remittances WHERE method = ? AND reference_key = ? AND status IN ('Submitted', 'Verified')").get(method, key)) {
        fail('DUPLICATE_REMITTANCE_REFERENCE', 'This transfer reference is already reported. Use a separate transfer for each statement.');
      }
      db.prepare(`INSERT INTO commission_remittances (id, statement_id, amount_centavos, method, reference, reference_key, payment_date, status, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Submitted', ?)`).run(randomUUID(), statementId, cents, method, reference.trim(), key, paymentDate, new Date().toISOString());
    },
    review(remittanceId, input, adminId) {
      const r = db.prepare('SELECT * FROM commission_remittances WHERE id = ?').get(remittanceId);
      if (!r) throw new NotFoundError('REMITTANCE_NOT_FOUND', 'Remittance report not found.');
      if (r.status !== 'Submitted') fail('REMITTANCE_ALREADY_REVIEWED', 'This report has already been reviewed.');
      const s = statementRow(r.statement_id);
      if (s.state !== 'Issued') fail('STATEMENT_NOT_PAYABLE', 'The statement is no longer issued.');
      const { decision, note, receivedDate, fundsReceived } = input;
      if (!['Verified', 'Rejected'].includes(decision) || typeof note !== 'string' || !note.trim() || note.trim().length > 500) {
        fail('INVALID_REMITTANCE_REVIEW', 'Choose Verified or Rejected and enter a review note of 1–500 characters.');
      }
      if (decision === 'Verified' && (fundsReceived !== true || !isIsoDate(receivedDate) || receivedDate > manilaToday() || receivedDate < r.payment_date)) {
        fail('FUNDS_CONFIRMATION_REQUIRED', 'Confirm actual funds received and a received date between the reported payment date and today. A reference alone does not verify payment.');
      }
      db.prepare(`UPDATE commission_remittances SET status = ?, review_note = ?, reviewed_at = ?, reviewed_by = ?, received_date = ? WHERE id = ?`)
        .run(decision, note.trim(), new Date().toISOString(), adminId, decision === 'Verified' ? receivedDate : null, remittanceId);
    },
    void(statementId, reason) {
      const s = statementRow(statementId);
      if (s.state !== 'Issued' || activeRemittance(statementId)) fail('STATEMENT_CANNOT_VOID', 'Only an issued statement without a pending or verified remittance can be voided. Review pending reports first.');
      if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 500) fail('VOID_REASON_REQUIRED', 'Enter a correction reason of 1–500 characters.');
      db.prepare("UPDATE commission_statements SET state = 'Void', void_reason = ?, voided_at = ? WHERE id = ?").run(reason.trim(), new Date().toISOString(), statementId);
    },
  };
}
