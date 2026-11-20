import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createSilidSmartService } from '../src/service.mjs';
import { createAppServer } from '../src/server.mjs';
import { PITCH_OWNER_ID } from '../src/pitch-seed.mjs';
import { billingGatewayReadiness } from '../src/tenant-billing.mjs';

// Fictional credentials and injected provider responses. No PayMongo calls/funds.
const testEnv = { PAYMONGO_BILLING_SANDBOX: 'true', PAYMONGO_SECRET_KEY: 'sk_test_fixtureonly', PAYMONGO_WEBHOOK_SECRET: 'fictional-webhook-secret-for-tests', SILIDSMART_APP_ORIGIN: 'http://127.0.0.1:5173' };
const fails = code => error => error.code === code;
function provider() {
  const calls = []; let session; let failOnce = false; let wait;
  const fetchImpl = async (url, options) => {
    if (options.method === 'POST' && url.endsWith('/v2/checkout_sessions')) {
      const a = JSON.parse(options.body).data.attributes;
      calls.push({ reference: a.reference_number, items: a.line_items, idempotency: options.headers['Idempotency-Key'] });
      if (wait) await wait;
      if (failOnce) { failOnce = false; throw new Error('Injected uncertain timeout'); }
      if (!session || session.attributes.reference_number !== a.reference_number) session = { id: `cs_fixture_${calls.length}`, type: 'checkout_session', attributes: { ...a, status: 'active', livemode: false, checkout_url: 'https://checkout.paymongo.com/fixture', payments: [] } };
    } else if (url.endsWith('/expire')) session.attributes.status = 'expired';
    return { ok: true, json: async () => ({ data: structuredClone(session) }) };
  };
  return { calls, fetchImpl, get session() { return session; }, set failOnce(v) { failOnce = v; }, set wait(v) { wait = v; },
    paid() {
      const amount = session.attributes.line_items.reduce((s, i) => s + i.amount, 0);
      session.attributes.payment_intent = { id: 'pi_fixture', attributes: { amount, currency: 'PHP', status: 'succeeded' } };
      session.attributes.payments = [{ id: 'pay_fixture', type: 'payment', attributes: { amount, currency: 'PHP', status: 'paid', livemode: false } }];
      return structuredClone(session);
    },
  };
}
function fixture(configured = false) {
  const p = provider();
  const service = createSilidSmartService(':memory:', { paymentEnv: configured ? testEnv : {}, paymentFetch: p.fetchImpl });
  const w = service.preparePitchDemo().workspace;
  const renter = service.auth.login('juan.delacruz@gmail.com', 'password123');
  const other = service.auth.register({ name: 'Other Renter Example', email: 'other.renter@example.test', phone: '09171234567', password: 'password123' });
  const tenant = w.tenants.find(t => t.unitId === 'pitch-demo-unit-3');
  const rent = w.rentRecords.find(r => r.unitId === tenant.unitId);
  const month = w.utilityRecords[0].billingMonth;
  const store = service.tenantBilling;
  const invite = () => store.invite(PITCH_OWNER_ID, { tenantId: tenant.id, email: renter.email, tenancyConfirmed: true });
  const publish = () => {
    const l = invite(); store.respond(renter.id, l.id, { action: 'Accept', tenancyConfirmed: true });
    return store.publish(PITCH_OWNER_ID, { linkId: l.id, billingMonth: month, dueDate: `${month}-28`, rentRecordId: rent.id, utilityRecordIds: w.utilityRecords.map(u => u.id), chargesConfirmed: true });
  };
  return { p, service, w, renter, other, tenant, rent, month, store, invite, publish };
}
function signed(resource, id = 'evt_fixture', transform = value => value) {
  const event = transform({ data: { id, type: 'event', attributes: { type: 'checkout_session.payment.paid', livemode: false, data: structuredClone(resource) } } });
  const raw = Buffer.from(JSON.stringify(event)); const t = String(Math.floor(Date.now() / 1000));
  return [raw, `t=${t},te=${createHmac('sha256', testEnv.PAYMONGO_WEBHOOK_SECRET).update(`${t}.`).update(raw).digest('hex')},li=`];
}

describe('Private tenant statements and sandbox gateway', () => {
  it('requires all sandbox configuration, rejects live keys and unsafe return origins', () => {
    assert.equal(billingGatewayReadiness(testEnv).checkoutEnabled, true);
    for (const patch of [{ PAYMONGO_BILLING_SANDBOX: 'false' }, { PAYMONGO_SECRET_KEY: 'sk_live_fixture' }, { PAYMONGO_WEBHOOK_SECRET: '' }, { SILIDSMART_APP_ORIGIN: 'http://example.test' }, { SILIDSMART_APP_ORIGIN: 'https://example.test/path' }]) assert.equal(billingGatewayReadiness({ ...testEnv, ...patch }).checkoutEnabled, false);
  });
  it('separates viewing approval, tenant invitation, tenant acceptance and publication', () => {
    const f = fixture();
    assert.deepEqual(f.store.tenantWorkspace(f.renter.id).bills, []);
    assert.throws(() => f.store.invite('owner-1', { tenantId: f.tenant.id, email: f.renter.email, tenancyConfirmed: true }), fails('CANNOT_INVITE_TENANT'));
    assert.throws(() => f.store.invite(PITCH_OWNER_ID, { tenantId: f.tenant.id, email: f.renter.email }), fails('TENANCY_CONFIRMATION_REQUIRED'));
    const l = f.invite();
    assert.equal(f.store.tenantWorkspace(f.renter.id).invitations.length, 1);
    assert.equal(f.store.tenantWorkspace(f.other.id).invitations.length, 0);
    assert.throws(() => f.store.respond(f.other.id, l.id, { action: 'Accept', tenancyConfirmed: true }), fails('INVITATION_NOT_FOUND'));
    assert.throws(() => f.store.publish(PITCH_OWNER_ID, { linkId: l.id, billingMonth: f.month, dueDate: `${f.month}-28`, chargesConfirmed: true, utilityRecordIds: [] }), fails('TENANT_ACCESS_NOT_ACTIVE'));
    const bill = f.publish();
    assert.equal(f.store.tenantWorkspace(f.renter.id).bills[0].id, bill.id);
    assert.equal(f.store.tenantWorkspace(f.other.id).bills.length, 0);
  });
  it('snapshots exact selected charges and manual paid amounts without inventing missing utilities', () => {
    const f = fixture(), b = f.publish();
    assert.equal(b.totalPhp, 8500); assert.equal(b.markedPaidPhp, 300); assert.equal(b.amountDuePhp, 8200);
    assert.deepEqual(b.items.map(i => i.label), ['Rent', 'Electricity', 'Water']);
    assert.equal(b.items.some(i => i.label === 'Wi-Fi'), false);
    assert.equal(b.proposedOnlineCommissionPhp, 210);
    assert.equal(JSON.stringify(b).includes('tenantContact'), false);
    assert.equal(JSON.stringify(f.service.getPublicWorkspace(null, 'all')).includes(b.id), false);
    assert.throws(() => f.service.updateRentStatus({ recordId: f.rent.id, paymentStatus: 'Paid' }), fails('BILL_SOURCE_LOCKED'));
    assert.throws(() => f.service.updateUtilityRecord(f.w.utilityRecords[0].id, { amountPhp: 2 }), fails('BILL_SOURCE_LOCKED'));
  });
  it('rejects another unit/month/source and duplicate statements; corrections retain void history', () => {
    const f = fixture(), b = f.publish(), linkId = b.linkId;
    const input = { linkId, billingMonth: f.month, dueDate: `${f.month}-28`, rentRecordId: f.rent.id, utilityRecordIds: [], chargesConfirmed: true };
    assert.throws(() => f.store.publish(PITCH_OWNER_ID, input), fails('BILL_ALREADY_ISSUED'));
    f.store.voidBill(PITCH_OWNER_ID, b.id, { reason: 'Correct selected charges' });
    assert.throws(() => f.store.publish(PITCH_OWNER_ID, { ...input, rentRecordId: {} }), fails('INVALID_TENANT_BILL'));
    assert.throws(() => f.store.publish(PITCH_OWNER_ID, { ...input, utilityRecordIds: [{}] }), fails('INVALID_BILL_SOURCE'));
    assert.throws(() => f.store.publish(PITCH_OWNER_ID, { ...input, billingMonth: '2026-01' }), fails('INVALID_BILL_SOURCE'));
    const foreign = f.service.getOwnerWorkspace('owner-1').rentRecords[0];
    assert.throws(() => f.store.publish(PITCH_OWNER_ID, { ...input, rentRecordId: foreign.id }), fails('INVALID_BILL_SOURCE'));
    const newBill = f.store.publish(PITCH_OWNER_ID, input); assert.notEqual(newBill.id, b.id);
    const voided = f.store.tenantWorkspace(f.renter.id).bills.find(row => row.id === b.id);
    assert.equal(voided.amountDuePhp, 0); assert.equal(voided.markedPaidPhp, 300); assert.equal(voided.status, 'Voided');
  });
  it('records a confirmed external full payment in source ledgers without commission', () => {
    const f = fixture(), b = f.publish();
    assert.throws(() => f.store.markExternal('owner-1', b.id, {}), fails('BILL_NOT_FOUND'));
    assert.throws(() => f.store.markExternal(PITCH_OWNER_ID, b.id, { paymentDate: `${f.month}-01`, reference: '' }), fails('INVALID_EXTERNAL_PAYMENT'));
    f.store.markExternal(PITCH_OWNER_ID, b.id, { fundsReceived: true, paymentDate: `${f.month}-01`, reference: 'EXAMPLE-OUTSIDE-RECEIPT' });
    const after = f.store.tenantWorkspace(f.renter.id).bills[0];
    assert.equal(after.amountDuePhp, 0); assert.equal(after.status, 'Paid (manual)');
    assert.equal(f.service.getOwnerWorkspace(PITCH_OWNER_ID).rentRecords.find(r => r.id === f.rent.id).paymentStatus, 'Paid');
    assert.ok(f.service.getOwnerWorkspace(PITCH_OWNER_ID).utilityRecords.every(u => u.paymentStatus === 'Paid'));
    assert.equal(f.p.calls.length, 0);
  });
  it('retains only the original tenant’s history after move-out and revokes access explicitly', () => {
    const f = fixture(), b = f.publish();
    f.service.toggleUnitOccupancy({ unitId: f.tenant.unitId, newStatus: 'Vacant' });
    assert.equal(f.store.tenantWorkspace(f.renter.id).bills[0].id, b.id);
    assert.equal(f.store.ownerWorkspace(PITCH_OWNER_ID).links[0].state, 'Ended');
    assert.throws(() => f.store.publish(PITCH_OWNER_ID, { linkId: b.linkId, billingMonth: f.month, dueDate: `${f.month}-28`, chargesConfirmed: true }), fails('TENANT_ACCESS_NOT_ACTIVE'));
    f.store.revoke(PITCH_OWNER_ID, b.linkId);
    assert.equal(f.store.tenantWorkspace(f.renter.id).bills.length, 0);
    assert.equal(f.store.ownerWorkspace(PITCH_OWNER_ID).bills.length, 1);
  });
  it('keeps checkout disabled without credentials and authorizes the bill against the session user', async () => {
    const f = fixture(), b = f.publish();
    await assert.rejects(f.store.checkout(f.other.id, b.id), fails('BILL_NOT_FOUND'));
    await assert.rejects(f.store.checkout(f.renter.id, b.id), fails('GATEWAY_NOT_CONFIGURED'));
    assert.equal(f.store.tenantWorkspace(f.renter.id).bills[0].sandboxStatus, 'Not started');
    assert.equal(f.p.calls.length, 0);
  });
  it('creates one idempotent checkout using only outstanding server-side line items', async () => {
    const f = fixture(true), b = f.publish();
    const checkout = await f.store.checkout(f.renter.id, b.id);
    assert.equal(checkout.mode, 'sandbox'); assert.equal(checkout.realAmountChargedPhp, 0);
    assert.equal(f.p.calls[0].items.reduce((s, i) => s + i.amount, 0), 820000);
    assert.equal(f.p.calls[0].items.some(i => i.name.startsWith('Water')), false);
    assert.equal(f.p.calls[0].reference, f.p.calls[0].idempotency);
    assert.deepEqual(await f.store.checkout(f.renter.id, b.id), checkout); assert.equal(f.p.calls.length, 1);
    assert.throws(() => f.store.markExternal(PITCH_OWNER_ID, b.id, {}), fails('BILL_CANNOT_SETTLE'));
    assert.throws(() => f.store.voidBill(PITCH_OWNER_ID, b.id, { reason: 'Conflict' }), fails('BILL_CANNOT_VOID'));
    assert.throws(() => f.store.revoke(PITCH_OWNER_ID, b.linkId), fails('CHECKOUT_PENDING'));
  });
  it('retries an uncertain request with the same idempotency key and blocks concurrent creation', async () => {
    const f = fixture(true), b = f.publish(); f.p.failOnce = true;
    await assert.rejects(f.store.checkout(f.renter.id, b.id), fails('GATEWAY_REQUEST_FAILED'));
    let release; f.p.wait = new Promise(r => { release = r; });
    const inFlight = f.store.checkout(f.renter.id, b.id);
    await assert.rejects(f.store.checkout(f.renter.id, b.id), fails('CHECKOUT_IN_PROGRESS'));
    release(); await inFlight;
    assert.equal(f.p.calls.length, 2); assert.equal(f.p.calls[0].idempotency, f.p.calls[1].idempotency);
  });
  it('verifies signed sandbox events idempotently without settling real rent or utilities', async () => {
    const f = fixture(true), b = f.publish(); await f.store.checkout(f.renter.id, b.id);
    const paid = f.p.paid(), event = signed(paid);
    assert.equal(f.store.webhook(...event).accepted, true);
    assert.equal(f.store.webhook(...event).duplicate, true);
    const after = f.store.tenantWorkspace(f.renter.id).bills[0];
    assert.equal(after.sandboxStatus, 'SandboxPaid'); assert.equal(after.amountDuePhp, 8200); assert.equal(after.state, 'Issued');
    assert.equal(f.service.getOwnerWorkspace(PITCH_OWNER_ID).rentRecords.find(r => r.id === f.rent.id).paymentStatus, 'Due');
    assert.equal(f.service.getOwnerWorkspace(PITCH_OWNER_ID).utilityRecords.find(u => u.utilityType === 'Electricity').paymentStatus, 'Due');
    assert.throws(() => f.store.webhook(...signed(paid, 'evt_fixture', e => { e.data.attributes.data.attributes.status = 'different'; return e; })), fails('WEBHOOK_REPLAY_CONFLICT'));
    await assert.rejects(f.store.checkout(f.renter.id, b.id), fails('SANDBOX_ALREADY_COMPLETED'));
    f.store.voidBill(PITCH_OWNER_ID, b.id, { reason: 'No real funds moved; reissue for test isolation' });
    const next = f.store.publish(PITCH_OWNER_ID, { linkId: b.linkId, billingMonth: f.month, dueDate: `${f.month}-28`, rentRecordId: f.rent.id, utilityRecordIds: f.w.utilityRecords.map(u => u.id), chargesConfirmed: true });
    await f.store.checkout(f.renter.id, next.id);
    assert.throws(() => f.store.webhook(...signed(f.p.paid(), 'evt_reused_payment')), fails('PAYMENT_ALREADY_USED'));
  });
  it('does not retry an uncertain checkout after the provider idempotency window', async t => {
    const f = fixture(true), b = f.publish(); f.p.failOnce = true;
    await assert.rejects(f.store.checkout(f.renter.id, b.id), fails('GATEWAY_REQUEST_FAILED'));
    t.mock.timers.enable({ apis: ['Date'], now: Date.now() }); t.mock.timers.tick(24 * 60 * 60 * 1000);
    await assert.rejects(f.store.checkout(f.renter.id, b.id), fails('CHECKOUT_RECONCILIATION_REQUIRED'));
    assert.equal(f.p.calls.length, 1);
  });
  it('rejects spoofed, expired, live, wrong-session, wrong-amount and wrong-currency events', async () => {
    const f = fixture(true), b = f.publish(); await f.store.checkout(f.renter.id, b.id); const paid = f.p.paid();
    const [raw, signature] = signed(paid);
    assert.throws(() => f.store.webhook(raw, signature.replace(/te=./, 'te=z')), fails('INVALID_WEBHOOK_SIGNATURE'));
    assert.throws(() => f.store.webhook(raw, signature.replace(/t=\d+/, 't=1000000000')), fails('INVALID_WEBHOOK_SIGNATURE'));
    for (const mutate of [r => { r.attributes.livemode = true; }, r => { r.id = 'cs_wrong'; }, r => { r.attributes.payments[0].attributes.amount = 1; }, r => { r.attributes.payments[0].attributes.currency = 'USD'; }]) {
      const bad = structuredClone(paid); mutate(bad); assert.throws(() => f.store.webhook(...signed(bad)), e => ['LIVE_EVENT_REJECTED', 'SESSION_MISMATCH', 'PAYMENT_MISMATCH'].includes(e.code));
    }
    assert.throws(() => f.store.webhook(...signed(paid, 'evt_live', e => { e.data.attributes.livemode = true; return e; })), fails('LIVE_EVENT_REJECTED'));
    assert.equal(f.store.tenantWorkspace(f.renter.id).bills[0].sandboxStatus, 'Pending');
  });
  it('reconciles only provider results and confirms expiration before unlocking corrections', async () => {
    const f = fixture(true), b = f.publish(); await f.store.checkout(f.renter.id, b.id);
    await f.store.reconcile(f.renter.id, b.id); assert.equal(f.store.tenantWorkspace(f.renter.id).bills[0].sandboxStatus, 'Pending');
    await f.store.reconcile(f.renter.id, b.id, true); assert.equal(f.store.tenantWorkspace(f.renter.id).bills[0].sandboxStatus, 'Expired');
    f.store.voidBill(PITCH_OWNER_ID, b.id, { reason: 'Test expired; correction allowed' });
    assert.equal(f.store.tenantWorkspace(f.renter.id).bills[0].status, 'Voided');
  });
  it('enforces HTTP roles and session ownership, rejects forged amounts, and never pays on redirect', async () => {
    const f = fixture(true), b = f.publish(), server = createAppServer(f.service);
    await new Promise(r => server.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${server.address().port}`;
    const request = (path, cookie, body, method = 'POST') => fetch(base + path, { method: body ? method : 'GET', headers: { ...(cookie ? { Cookie: cookie } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const login = async email => (await request('/api/auth/login', null, { identifier: email, password: 'password123' })).headers.get('set-cookie').split(';')[0];
    try {
      assert.equal((await request('/api/tenant/billing')).status, 401);
      const owner = await login('pitch.owner@example.test'), renter = await login(f.renter.email), other = await login(f.other.email);
      assert.equal((await request('/api/tenant/billing', owner)).status, 403);
      assert.equal((await request('/api/owner/tenant-billing', renter)).status, 403);
      assert.equal((await request(`/api/tenant/bills/${b.id}/checkout`, other, { renterId: f.renter.id, amountPhp: 1 })).status, 404);
      assert.equal((await request(`/api/tenant/bills/${b.id}/checkout`, renter, { amountPhp: 1, paid: true })).status, 200);
      assert.equal(f.p.calls[0].items.reduce((s, i) => s + i.amount, 0), 820000);
      assert.equal((await request('/api/tenant/billing?tenantBills=1&paid=true', renter)).status, 200);
      assert.equal(f.store.tenantWorkspace(f.renter.id).bills[0].sandboxStatus, 'Pending');
      const paid = f.p.paid(), [body, signature] = signed(paid, 'evt_http');
      const webhook = await fetch(base + '/api/payments/paymongo/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Paymongo-Signature': signature }, body });
      assert.equal(webhook.status, 200); assert.equal(f.store.tenantWorkspace(f.renter.id).bills[0].sandboxStatus, 'SandboxPaid');
      assert.equal(JSON.stringify(await (await request('/api/tenant/billing', renter)).json()).includes(testEnv.PAYMONGO_SECRET_KEY), false);
      await request('/api/auth/logout', renter, {}); assert.equal((await request('/api/tenant/billing', renter)).status, 401);
    } finally { await new Promise(r => server.close(r)); }
  });
});
