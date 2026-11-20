import { randomUUID, createHmac, createHash, timingSafeEqual } from "node:crypto";
import { AccessError } from "./auth.mjs";
import { manilaToday } from "./commissions.mjs";
import { createPayMongoSandboxAdapter } from "./payments.mjs";
const fail = (code, message, status = 400) => {
  throw new AccessError(status, code, message);
};
const isIdentifier = value => typeof value === 'string' && value.length > 0 && value.length <= 128;
const isoDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
const monthKey = (value) => {
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value;
  const parts = /^(\w+) (\d{4})$/.exec(value || "");
  const m = parts ? [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ].indexOf(parts[1]) : -1;
  return m < 0 ? null : `${parts[2]}-${String(m + 1).padStart(2, "0")}`;
};
export function billingGatewayReadiness(env = process.env) {
  let origin;
  try {
    const u = new URL(env.SILIDSMART_APP_ORIGIN);
    if (u.origin === env.SILIDSMART_APP_ORIGIN && (u.protocol === "https:" || u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname))) origin = u.origin;
  } catch {}
  const enabled = env.PAYMONGO_BILLING_SANDBOX === "true" && /^sk_test_[A-Za-z0-9]+$/.test(env.PAYMONGO_SECRET_KEY || "") && typeof env.PAYMONGO_WEBHOOK_SECRET === "string" && env.PAYMONGO_WEBHOOK_SECRET.length >= 16 && !!origin;
  return {
    checkoutEnabled: !!enabled,
    mode: "Sandbox only",
    livePaymentsEnabled: false,
    ownerSplitEnabled: false,
    message: enabled ? "PayMongo test checkout is configured. Test payments do not settle real rent, deduct platform fees or pay out to owners." : "PayMongo test checkout is unavailable. Server-side test credentials, webhook secret, return origin and explicit sandbox enablement are required."
  };
}
export function createTenantBillingStore(db, { env = process.env, fetchImpl = fetch } = {}) {
  const transaction = (fn) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };
  const linkRow = (id) => db.prepare("SELECT * FROM tenant_billing_links WHERE id=?").get(id);
  const billRow = (id) => db.prepare("SELECT * FROM tenant_bills WHERE id=?").get(id);
  const checkoutRow = (billId) => db.prepare("SELECT * FROM tenant_bill_checkouts WHERE bill_id=?").get(billId);
  const ownedLink = (owner, id) => {
    const l = linkRow(id);
    if (!l || l.owner_id !== owner) fail("BILLING_LINK_NOT_FOUND", "Billing access was not found.", 404);
    return l;
  };
  const ownedBill = (owner, id) => {
    const b = billRow(id);
    if (!b || b.owner_id !== owner) fail("BILL_NOT_FOUND", "Statement was not found.", 404);
    return b;
  };
  const tenantBill = (renter, id) => {
    const b = billRow(id);
    if (!b || b.renter_id !== renter || linkRow(b.link_id)?.state !== "Active") fail("BILL_NOT_FOUND", "Statement was not found.", 404);
    return b;
  };
  const activeTenant = (l) => l.tenant_id && db.prepare("SELECT t.id FROM tenants t JOIN units u ON u.id=t.unit_id JOIN properties p ON p.id=u.property_id WHERE t.id=? AND u.id=? AND u.status='Occupied' AND p.owner_id=?").get(l.tenant_id, l.unit_id, l.owner_id);
  const pending = (b) => [
    "Creating",
    "Pending",
    "Unknown"
  ].includes(checkoutRow(b.id)?.state);
  const sourceItem = (row, type) => ({
    sourceType: type === "Rent" ? "Rent" : "Utility",
    sourceId: row.id,
    label: type,
    amountCentavos: type === "Rent" ? Math.round(row.amount_due * 100) : row.amount_centavos,
    paidManually: row.payment_status === "Paid"
  });
  const billDto = (b) => {
    const l = linkRow(b.link_id);
    const c = checkoutRow(b.id);
    const due = b.state === "Issued" ? b.due_centavos : 0;
    return {
      id: b.id,
      linkId: b.link_id,
      billingMonth: b.billing_month,
      dueDate: b.due_date,
      state: b.state,
      propertyName: l.property_name,
      unitLabel: l.unit_label,
      tenantName: l.tenant_name,
      ownerName: db.prepare("SELECT display_name FROM owners WHERE id=?").get(b.owner_id)?.display_name,
      items: JSON.parse(b.items_json).map((i) => ({
        label: i.label,
        amountPhp: i.amountCentavos / 100,
        markedPaidManually: i.paidManually || b.state === "PaidExternal"
      })),
      totalPhp: b.total_centavos / 100,
      markedPaidPhp: (b.state === "PaidExternal" ? b.total_centavos : b.total_centavos - b.due_centavos) / 100,
      amountDuePhp: due / 100,
      status: b.state === "Void" ? "Voided" : b.state === "PaidExternal" || !due ? "Paid (manual)" : b.due_date < manilaToday() ? "Overdue" : "Due",
      createdAt: b.created_at,
      note: b.note,
      paymentDate: b.payment_date,
      sandboxStatus: c?.state || "Not started",
      sandboxPaymentId: c?.state === "SandboxPaid" ? c.payment_id : null,
      proposedOnlineCommissionPhp: Math.round(JSON.parse(b.items_json).filter((i) => i.label === "Rent" && !i.paidManually).reduce((s, i) => s + i.amountCentavos, 0) * .03) / 100
    };
  };
  const linkDto = (l) => ({
    id: l.id,
    tenantId: l.tenant_id,
    unitId: l.unit_id,
    tenantName: l.tenant_name,
    propertyName: l.property_name,
    unitLabel: l.unit_label,
    renterName: db.prepare("SELECT name FROM accounts WHERE id=?").get(l.renter_id)?.name,
    renterEmail: db.prepare("SELECT email FROM accounts WHERE id=?").get(l.renter_id)?.email,
    state: l.state === "Active" && !activeTenant(l) ? "Ended" : l.state,
    createdAt: l.created_at
  });
  const store = {
    readiness: () => billingGatewayReadiness(env),
    ownerWorkspace(owner) {
      return {
        links: db.prepare("SELECT * FROM tenant_billing_links WHERE owner_id=? ORDER BY created_at DESC").all(owner).map(linkDto),
        bills: db.prepare("SELECT * FROM tenant_bills WHERE owner_id=? ORDER BY created_at DESC").all(owner).map(billDto),
        gateway: store.readiness()
      };
    },
    tenantWorkspace(renter) {
      return {
        invitations: db.prepare("SELECT * FROM tenant_billing_links WHERE renter_id=? AND state='Invited'").all(renter).filter(activeTenant).map((l) => ({
          id: l.id,
          propertyName: l.property_name,
          unitLabel: l.unit_label,
          ownerName: db.prepare("SELECT display_name FROM owners WHERE id=?").get(l.owner_id)?.display_name
        })),
        bills: db.prepare("SELECT b.* FROM tenant_bills b JOIN tenant_billing_links l ON l.id=b.link_id WHERE b.renter_id=? AND l.state='Active' ORDER BY b.created_at DESC").all(renter).map(billDto),
        gateway: store.readiness()
      };
    },
    invite(owner, input) {
      if (!input || input.tenancyConfirmed !== true || !isIdentifier(input.tenantId) || typeof input.email !== "string" || input.email.length > 254) fail("TENANCY_CONFIRMATION_REQUIRED", "Confirm the actual tenancy and enter the renter’s registered email.");
      const t = db.prepare("SELECT t.*,u.status,p.owner_id,p.name AS property_name,u.unit_label FROM tenants t JOIN units u ON u.id=t.unit_id JOIN properties p ON p.id=u.property_id WHERE t.id=? AND p.owner_id=? AND u.status='Occupied'").get(input.tenantId, owner);
      const account = db.prepare("SELECT id FROM accounts WHERE email=? COLLATE NOCASE AND role='renter'").get(input.email.trim());
      if (!t || !account) fail("CANNOT_INVITE_TENANT", "Check the occupied tenant record and the renter’s registered email.");
      const old = db.prepare("SELECT * FROM tenant_billing_links WHERE tenant_id=? AND state IN ('Invited','Active')").get(t.id);
      if (old) {
        if (old.renter_id === account.id) return linkDto(old);
        fail("TENANT_ALREADY_LINKED", "Revoke the earlier billing access before inviting a different account.", 409);
      }
      const id = randomUUID();
      db.prepare("INSERT INTO tenant_billing_links(id,owner_id,tenant_id,unit_id,renter_id,tenant_name,property_name,unit_label,state,created_at) VALUES(?,?,?,?,?,?,?,?,'Invited',?)").run(id, owner, t.id, t.unit_id, account.id, t.name, t.property_name, t.unit_label, new Date().toISOString());
      return linkDto(linkRow(id));
    },
    respond(renter, id, input) {
      const l = linkRow(id);
      if (!l || l.renter_id !== renter) fail("INVITATION_NOT_FOUND", "Invitation was not found.", 404);
      if (!input || !["Accept", "Decline"].includes(input.action) || input.action === "Accept" && input.tenancyConfirmed !== true) fail("INVALID_INVITATION_ACTION", "Confirm that this is your actual tenancy before accepting.");
      if (l.state === "Active" && input.action === "Accept") return;
      if (l.state !== "Invited" || !activeTenant(l)) fail("INVITATION_CLOSED", "This invitation is no longer available.", 409);
      db.prepare("UPDATE tenant_billing_links SET state=?,accepted_at=? WHERE id=?").run(input.action === "Accept" ? "Active" : "Declined", new Date().toISOString(), id);
    },
    revoke(owner, id) {
      const l = ownedLink(owner, id);
      if (db.prepare("SELECT b.id FROM tenant_bills b JOIN tenant_bill_checkouts c ON c.bill_id=b.id WHERE b.link_id=? AND c.state IN ('Creating','Pending','Unknown')").get(id)) fail("CHECKOUT_PENDING", "Reconcile or cancel the test checkout before revoking access.", 409);
      db.prepare("UPDATE tenant_billing_links SET state='Revoked' WHERE id=?").run(l.id);
    },
    publish(owner, input) {
      return transaction(() => {
        if (!input || input.chargesConfirmed !== true || !isIdentifier(input.linkId) || (input.rentRecordId != null && !isIdentifier(input.rentRecordId)) || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(input.billingMonth || "") || !isoDate(input.dueDate)) fail("INVALID_TENANT_BILL", "Confirm the recipient and charges, billing month and due date.");
        const l = ownedLink(owner, input.linkId);
        if (l.state !== "Active" || !activeTenant(l)) fail("TENANT_ACCESS_NOT_ACTIVE", "The current tenant must accept billing access first.", 409);
        if (db.prepare("SELECT id FROM tenant_bills WHERE link_id=? AND billing_month=? AND state!='Void'").get(l.id, input.billingMonth)) fail("BILL_ALREADY_ISSUED", "A statement already exists for this tenant/month. Void it before correction.", 409);
        const items = [];
        if (input.rentRecordId) {
          const r = db.prepare("SELECT * FROM rent_records WHERE id=? AND unit_id=?").get(input.rentRecordId, l.unit_id);
          if (!r || monthKey(r.month) !== input.billingMonth || r.tenant_name !== l.tenant_name) fail("INVALID_BILL_SOURCE", "Choose this tenant’s recorded rent for the selected month.");
          items.push(sourceItem(r, "Rent"));
        }
        if (!Array.isArray(input.utilityRecordIds) || input.utilityRecordIds.some(id => !isIdentifier(id)) || input.utilityRecordIds.length > 3 || new Set(input.utilityRecordIds).size !== input.utilityRecordIds.length) fail("INVALID_BILL_SOURCE", "Choose up to three distinct utility bills.");
        for (const id of input.utilityRecordIds) {
          const u = db.prepare("SELECT * FROM utility_records WHERE id=? AND unit_id=? AND billing_month=?").get(id, l.unit_id, input.billingMonth);
          if (!u) fail("INVALID_BILL_SOURCE", "Utility bills must belong to this tenant’s unit and month.");
          items.push(sourceItem(u, u.utility_type));
        }
        for (const item of items) store.assertSourceEditable(item.sourceType, item.sourceId);
        const total = items.reduce((s, i) => s + i.amountCentavos, 0), due = items.filter((i) => !i.paidManually).reduce((s, i) => s + i.amountCentavos, 0);
        if (!Number.isSafeInteger(total) || total <= 0 || total > 1e9) fail("INVALID_BILL_TOTAL", "Select recorded charges totalling at most ₱10,000,000.");
        const id = randomUUID();
        db.prepare("INSERT INTO tenant_bills(id,link_id,owner_id,renter_id,billing_month,due_date,items_json,total_centavos,due_centavos,state,created_at) VALUES(?,?,?,?,?,?,?,?,?,'Issued',?)").run(id, l.id, owner, l.renter_id, input.billingMonth, input.dueDate, JSON.stringify(items), total, due, new Date().toISOString());
        return billDto(billRow(id));
      });
    },
    assertSourceEditable(type, id) {
      if (db.prepare("SELECT b.id FROM tenant_bills b,json_each(b.items_json) i WHERE b.state='Issued' AND json_extract(i.value,'$.sourceType')=? AND json_extract(i.value,'$.sourceId')=? LIMIT 1").get(type, id)) fail("BILL_SOURCE_LOCKED", "This record is in an issued tenant statement. Record payment through Tenant Billing or void the statement before correction.", 409);
    },
    voidBill(owner, id, input) {
      const b = ownedBill(owner, id);
      if (b.state !== "Issued" || pending(b)) fail("BILL_CANNOT_VOID", "Only an unpaid statement without an open checkout can be voided.", 409);
      if (typeof input?.reason !== "string" || !input.reason.trim() || input.reason.length > 500) fail("VOID_REASON_REQUIRED", "Enter a correction reason.");
      db.prepare("UPDATE tenant_bills SET state='Void',note=? WHERE id=?").run(input.reason.trim(), id);
    },
    markExternal(owner, id, input) {
      return transaction(() => {
        const b = ownedBill(owner, id);
        if (b.state !== "Issued" || pending(b)) fail("BILL_CANNOT_SETTLE", "The statement must be issued with no open test checkout.", 409);
        if (input?.fundsReceived !== true || !isoDate(input.paymentDate) || input.paymentDate > manilaToday() || typeof input.reference !== "string" || input.reference.trim().length > 120) fail("INVALID_EXTERNAL_PAYMENT", "Confirm receipt, a valid payment date no later than today and a reference of at most 120 characters.");
        for (const item of JSON.parse(b.items_json)) {
          if (item.paidManually) continue;
          const rent = item.sourceType === "Rent";
          const table = rent ? "rent_records" : "utility_records";
          const source = db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(item.sourceId);
          if (!source || (rent ? Math.round(source.amount_due * 100) : source.amount_centavos) !== item.amountCentavos) fail("BILL_SOURCE_CHANGED", "A source charge changed; resolve the statement before marking payment.", 409);
          if (rent) db.prepare("UPDATE rent_records SET payment_status='Paid',recorded_date=? WHERE id=?").run(input.paymentDate, item.sourceId);
          else db.prepare("UPDATE utility_records SET payment_status='Paid',payment_date=?,reference=? WHERE id=?").run(input.paymentDate, input.reference.trim(), item.sourceId);
        }
        db.prepare("UPDATE tenant_bills SET state='PaidExternal',payment_date=?,reference=? WHERE id=?").run(input.paymentDate, input.reference.trim(), id);
      });
    },
    async checkout(renter, id) {
      const b = tenantBill(renter, id);
      if (b.state !== "Issued" || b.due_centavos <= 0) fail("BILL_NOT_PAYABLE", "This statement has no outstanding amount.", 409);
      if (!store.readiness().checkoutEnabled) fail("GATEWAY_NOT_CONFIGURED", store.readiness().message, 503);
      let c = checkoutRow(id);
      if (c?.state === "SandboxPaid") fail("SANDBOX_ALREADY_COMPLETED", "This statement already has a completed test. Real rent remains unchanged.", 409);
      if (c?.state === "Expired") fail("SANDBOX_CHECKOUT_EXPIRED", "This test checkout expired. Ask the owner to void/reissue the unpaid statement for a new test.", 409);
      if (c?.state === "Pending") return {
        checkoutUrl: c.checkout_url,
        mode: "sandbox",
        realAmountChargedPhp: 0
      };
      if (c?.state === "Creating") {
        if (Date.now() - Date.parse(c.updated_at) < 12e4) fail("CHECKOUT_IN_PROGRESS", "A checkout is being prepared. Retry shortly.", 409);
        db.prepare("UPDATE tenant_bill_checkouts SET state='Unknown' WHERE id=? AND state='Creating' AND updated_at=?").run(c.id, c.updated_at);
        c = checkoutRow(id);
      }
      // PayMongo expires idempotency keys after 24 hours. Do not create another
      // session after an uncertain old attempt; reconcile it with the provider.
      if (c?.state === "Unknown" && Date.now() - Date.parse(c.created_at) > 23 * 60 * 60 * 1e3) fail("CHECKOUT_RECONCILIATION_REQUIRED", "This uncertain checkout is too old to retry safely. Contact the operator to reconcile the provider session before reissuing a statement.", 409);
      if (!c) {
        const key = randomUUID();
        const now = new Date().toISOString();
        db.prepare("INSERT INTO tenant_bill_checkouts(id,bill_id,reference_number,amount_centavos,state,created_at,updated_at) VALUES(?,?,?,?,'Creating',?,?)").run(key, id, `BILLTEST_${key}`, b.due_centavos, now, now);
        c = checkoutRow(id);
      } else if (!db.prepare("UPDATE tenant_bill_checkouts SET state='Creating' WHERE id=? AND state='Unknown'").run(c.id).changes) fail("CHECKOUT_IN_PROGRESS", "Another checkout request is in progress.", 409);
      const adapter = createPayMongoSandboxAdapter({
        secretKey: env.PAYMONGO_SECRET_KEY,
        fetchImpl
      });
      try {
        const result = await adapter.createTestSession({
          reference: c.reference_number,
          lineItems: JSON.parse(b.items_json).filter((i) => !i.paidManually).map((i) => ({
            name: `${i.label} ${b.billing_month}`,
            amount: i.amountCentavos
          })),
          successUrl: `${env.SILIDSMART_APP_ORIGIN}/?tenantBills=1`,
          cancelUrl: `${env.SILIDSMART_APP_ORIGIN}/?tenantBills=1`
        });
        const live = checkoutRow(id);
        if (live.session_id && live.session_id !== result.id) fail("SESSION_MISMATCH", "Provider session did not match the stored checkout.", 502);
        db.prepare("UPDATE tenant_bill_checkouts SET session_id=?,checkout_url=?,state=CASE WHEN state='SandboxPaid' THEN state ELSE 'Pending' END,updated_at=? WHERE id=?").run(result.id, result.checkoutUrl, new Date().toISOString(), c.id);
        return {
          checkoutUrl: result.checkoutUrl,
          mode: "sandbox",
          realAmountChargedPhp: 0
        };
      } catch (e) {
        db.prepare("UPDATE tenant_bill_checkouts SET state='Unknown',updated_at=? WHERE id=? AND state='Creating'").run(new Date().toISOString(), c.id);
        if (e instanceof AccessError) throw e;
        fail("GATEWAY_REQUEST_FAILED", "Test checkout could not be confirmed. Retry uses the same provider idempotency key; no rent was marked paid.", 502);
      }
    },
    applySession(c, resource) {
      if (!/^cs_[A-Za-z0-9_-]{1,120}$/.test(resource?.id || "") || c.session_id && resource.id !== c.session_id || resource?.type !== "checkout_session" || resource?.attributes?.reference_number !== c.reference_number) fail("SESSION_MISMATCH", "Provider session does not match this statement.", 400);
      const a = resource.attributes;
      if (a.livemode === true) fail("LIVE_EVENT_REJECTED", "Only sandbox results are accepted.");
      if (a.payments != null && !Array.isArray(a.payments)) fail("PAYMENT_MISMATCH", "Invalid provider payment list.");
      const payments = (a.payments || []).filter((p) => p?.attributes?.status === "paid");
      if (!payments.length) return false;
      if (payments.length !== 1 || payments[0].attributes.amount !== c.amount_centavos || payments[0].attributes.currency !== "PHP" || payments[0].attributes.livemode === true || a.payment_intent?.attributes?.amount !== c.amount_centavos || a.payment_intent?.attributes?.currency !== "PHP" || a.payment_intent?.attributes?.status !== "succeeded") fail("PAYMENT_MISMATCH", "Provider amount, currency or payment state does not match the statement.");
      const p = payments[0];
      if (typeof p.id !== "string" || !p.id || p.id.length > 128) fail("PAYMENT_MISMATCH", "Invalid provider payment identity.");
      const existing = db.prepare("SELECT id FROM tenant_bill_checkouts WHERE payment_id=? AND id!=?").get(p.id, c.id);
      if (existing) fail("PAYMENT_ALREADY_USED", "A payment cannot settle multiple test statements.", 409);
      if (c.state === "SandboxPaid" && c.payment_id !== p.id) fail("PAYMENT_MISMATCH", "This test was already completed by another payment.", 409);
      db.prepare("UPDATE tenant_bill_checkouts SET state='SandboxPaid',session_id=?,payment_id=?,updated_at=? WHERE id=?").run(resource.id, p.id, new Date().toISOString(), c.id);
      return true;
    },
    async reconcile(renter, id, cancel = false) {
      const b = tenantBill(renter, id), c = checkoutRow(id);
      if (!c?.session_id) fail("CHECKOUT_NOT_READY", "No confirmed provider session is available yet.", 409);
      if (!store.readiness().checkoutEnabled) fail("GATEWAY_NOT_CONFIGURED", store.readiness().message, 503);
      const adapter = createPayMongoSandboxAdapter({
        secretKey: env.PAYMONGO_SECRET_KEY,
        fetchImpl
      });
      let resource;
      try {
        resource = await adapter.retrieveTestSession(c.session_id);
      } catch {
        fail("GATEWAY_REQUEST_FAILED", "The provider could not confirm this test checkout. No real rent was marked paid.", 502);
      }
      if (store.applySession(c, resource)) return;
      if (cancel) {
        try {
          resource = await adapter.expireTestSession(c.session_id);
        } catch {
          fail("GATEWAY_REQUEST_FAILED", "The provider could not confirm cancellation. Recheck the test checkout before changing the bill.", 502);
        }
        if (store.applySession(c, resource)) return;
      }
      if (resource.attributes?.status === "expired") db.prepare("UPDATE tenant_bill_checkouts SET state='Expired',updated_at=? WHERE id=? AND state!='SandboxPaid'").run(new Date().toISOString(), c.id);
      return billDto(b);
    },
    webhook(raw, signature) {
      if (!store.readiness().checkoutEnabled) fail("GATEWAY_NOT_CONFIGURED", "Sandbox webhook is not configured.", 503);
      const parts = Object.fromEntries(String(signature || "").split(",").map((v) => v.trim().split("=")));
      if (!/^\d{10}$/.test(parts.t || "") || Math.abs(Date.now() / 1e3 - Number(parts.t)) > 300 || !/^[a-f0-9]{64}$/i.test(parts.te || "")) fail("INVALID_WEBHOOK_SIGNATURE", "Webhook signature is invalid or expired.", 401);
      const expected = createHmac("sha256", env.PAYMONGO_WEBHOOK_SECRET).update(`${parts.t}.`).update(raw).digest();
      if (!timingSafeEqual(expected, Buffer.from(parts.te, "hex"))) fail("INVALID_WEBHOOK_SIGNATURE", "Webhook signature is invalid.", 401);
      let event;
      try {
        event = JSON.parse(raw.toString("utf8")).data;
      } catch {
        fail("INVALID_WEBHOOK", "Invalid event JSON.");
      }
      if (event?.attributes?.livemode !== false) fail("LIVE_EVENT_REJECTED", "Only sandbox events are accepted.");
      if (event.attributes.type !== "checkout_session.payment.paid") return { ignored: true };
      if (typeof event.id !== "string" || !event.id || event.id.length > 128) fail("INVALID_WEBHOOK", "Invalid event identity.");
      const hash = createHash("sha256").update(raw).digest("hex");
      const previous = db.prepare("SELECT payload_hash FROM tenant_billing_events WHERE id=?").get(event.id);
      if (previous) {
        if (previous.payload_hash !== hash) fail("WEBHOOK_REPLAY_CONFLICT", "Event identity was reused with different data.", 409);
        return { duplicate: true };
      }
      const resource = event.attributes.data;
      const reference = resource?.attributes?.reference_number;
      const c = db.prepare("SELECT * FROM tenant_bill_checkouts WHERE reference_number=?").get(typeof reference === "string" ? reference : "");
      if (!c) return { ignored: true };
      return transaction(() => {
        if (!store.applySession(c, resource)) fail("PAYMENT_NOT_COMPLETED", "Event has no completed payment.");
        db.prepare("INSERT INTO tenant_billing_events(id,payload_hash,checkout_id,received_at) VALUES(?,?,?,?)").run(event.id, hash, c.id, new Date().toISOString());
        return {
          accepted: true,
          sandboxOnly: true
        };
      });
    }
  };
  return store;
}
