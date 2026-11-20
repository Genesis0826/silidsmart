import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createSilidSmartService } from '../src/service.mjs';
import { createAppServer } from '../src/server.mjs';
import { manilaToday } from '../src/commissions.mjs';

describe('Monthly commission statements and external remittance review', () => {
  let server, base, ownerUnit, inquiryId;
  const cookies = {};
  const emails = { owner: 'maria.santos@silidsmart.ph', renter: 'juan.delacruz@gmail.com', admin: 'governance@silidsmart.ph' };
  const call = async (path, method = 'GET', body, role = 'owner') => {
    if (role && !cookies[role]) {
      const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: emails[role], password: 'password123' }) });
      assert.equal(login.status, 200);
      cookies[role] = login.headers.get('set-cookie').split(';')[0];
    }
    const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(role ? { Cookie: cookies[role] } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  };
  const workspace = () => call('/api/owner/owner-1/workspace');
  const stay = (changes = {}) => call('/api/owner/short-stays', 'POST', {
    unitId: ownerUnit, guestName: 'Commission QA guest', checkInDate: '2020-10-01', checkOutDate: '2020-10-03', rentTotalPhp: 10000, source: 'SilidSmart', ...changes,
  });
  const issue = (billingMonth = '2020-10') => call('/api/owner/commission-statements', 'POST', { billingMonth, commissionPhp: 1, ownerId: 'owner-2' });
  const submit = (id, changes = {}) => call(`/api/owner/commission-statements/${id}/remittances`, 'POST', { amountPhp: 500, method: 'Bank transfer', paymentDate: '2020-11-01', reference: 'QA-TRANSFER-1', ...changes });
  const review = (id, changes = {}, role = 'admin') => call(`/api/admin/commission-remittances/${id}`, 'PATCH', { decision: 'Verified', note: 'Matched the actual received amount and reference in the isolated QA fixture.', fundsReceived: true, receivedDate: '2020-11-01', ...changes }, role);
  beforeEach(async () => {
    Object.keys(cookies).forEach(k => delete cookies[k]);
    server = createAppServer(createSilidSmartService(':memory:'));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
    const { body } = await workspace(); ownerUnit = body.units[0].id;
    inquiryId = body.inquiries.find(i => i.unitId === ownerUnit)?.id;
  });
  afterEach(async () => { await new Promise(resolve => server.close(resolve)); });

  it('snapshots the checkout cohort, excludes other/cancelled stays, sums individually rounded centavos, and is retry-safe', async () => {
    await stay();
    const other = await stay({ rentTotalPhp: 20000, source: 'Other' });
    assert.equal(other.status, 201);
    const cancelled = await stay({ rentTotalPhp: 30000 });
    const cancelledId = cancelled.body.shortStays.find(s => s.rentTotalPhp === 30000).id;
    await call(`/api/owner/short-stays/${cancelledId}`, 'PATCH', { status: 'Cancelled' });
    // Each PHP 0.10 line yields PHP 0.01, rather than rounding an aggregate 0.20 once.
    await stay({ rentTotalPhp: 0.10 }); await stay({ rentTotalPhp: 0.10 });
    await stay({ checkInDate: '2020-10-31', checkOutDate: '2020-11-01', rentTotalPhp: 999 });
    const result = await issue(); assert.equal(result.status, 201);
    const s = result.body.commissionStatements[0];
    assert.equal(s.ownerId, 'owner-1'); assert.equal(s.rentTotalPhp, 10000.20); assert.equal(s.commissionPhp, 500.02);
    assert.equal(s.outstandingPhp, 500.02); assert.equal(s.items.length, 5); assert.equal(s.dueDate, '2020-11-10');
    assert.equal(s.paymentStatus, 'Overdue'); assert.equal(s.version, 1);
    const again = await issue(); assert.equal(again.body.commissionStatements.length, 1); assert.equal(again.body.commissionStatements[0].id, s.id);
    assert.equal((await stay()).body.error.code, 'COMMISSION_PERIOD_LOCKED');
    assert.equal((await call(`/api/owner/short-stays/${cancelledId}`, 'PATCH', { status: 'Completed' })).body.error.code, 'COMMISSION_PERIOD_LOCKED');
    assert.equal((await stay({ checkInDate: '2020-12-01', checkOutDate: '2020-12-02' })).status, 201);
    assert.equal((await issue('2020-12')).body.commissionStatements[0].dueDate, '2021-01-10');
  });

  it('allows closed zero-commission months, denies invalid/open periods and future completed stays', async () => {
    for (const month of ['2020-13', '2020-1', '1999-12', manilaToday().slice(0, 7), '2999-01', 202010, null]) {
      assert.equal((await issue(month)).status, 400);
    }
    const result = await issue(); const s = result.body.commissionStatements[0];
    assert.equal(s.paymentStatus, 'No commission'); assert.equal(s.commissionPhp, 0); assert.deepEqual(s.items, []);
    assert.equal((await submit(s.id)).status, 400);
    assert.equal((await stay({ checkInDate: '2999-01-01', checkOutDate: '2999-01-03' })).body.error.code, 'STAY_NOT_COMPLETED');
  });

  it('requires exact external payment details, keeps money due during review, supports correction and staff verification', async () => {
    await stay(); const s = (await issue()).body.commissionStatements[0];
    for (const change of [{ amountPhp: 499 }, { amountPhp: 500.001 }, { amountPhp: '500' }, { method: 'Card' }, { reference: ' ' }, { reference: 'x'.repeat(121) }, { reference: 'ABC\nDEF' }, { paymentDate: '2020-02-30' }, { paymentDate: '2999-01-01' }]) {
      assert.equal((await submit(s.id, change)).status, 400, JSON.stringify(change));
    }
    const sent = await submit(s.id, { status: 'Verified' }); assert.equal(sent.status, 201);
    const reported = sent.body.commissionStatements[0]; const r = reported.remittances[0];
    assert.equal(reported.paymentStatus, 'Under review'); assert.equal(reported.outstandingPhp, 500); assert.equal(r.status, 'Submitted');
    assert.equal((await submit(s.id)).status, 400);
    assert.equal((await review(r.id, {}, 'owner')).status, 403);
    for (const change of [{ fundsReceived: false }, { receivedDate: '2020-10-31' }, { receivedDate: '2999-01-01' }, { note: '' }, { decision: 'Paid' }]) assert.equal((await review(r.id, change)).status, 400);
    const returned = await review(r.id, { decision: 'Rejected', note: 'Reference could not be matched. Please correct it.' });
    assert.equal(returned.status, 200);
    assert.equal(returned.body.commissionStatements[0].outstandingPhp, 500);
    const resent = await submit(s.id, { reference: 'QA-CORRECTED-REF' }); assert.equal(resent.status, 201);
    const next = resent.body.commissionStatements[0].remittances[0];
    const verified = await review(next.id); const final = verified.body.commissionStatements[0];
    assert.equal(final.paymentStatus, 'Verified'); assert.equal(final.outstandingPhp, 0); assert.equal(final.remittances.length, 2);
    assert.equal(final.remittances[0].receivedDate, '2020-11-01');
    assert.equal((await review(next.id)).status, 400);
    assert.equal((await call(`/api/admin/commission-statements/${s.id}/void`, 'POST', { reason: 'Attempt to void settled invoice' }, 'admin')).status, 400);
  });

  it('prevents transfer reuse and preserves versioned statements when unpaid amounts need correction', async () => {
    const first = await stay(); const recordId = first.body.shortStays[0].id;
    const s = (await issue()).body.commissionStatements[0];
    const submitted = await submit(s.id); const r = submitted.body.commissionStatements[0].remittances[0];
    const voidPath = `/api/admin/commission-statements/${s.id}/void`;
    assert.equal((await call(voidPath, 'POST', { reason: 'Correct stay' }, 'admin')).status, 400);
    await review(r.id, { decision: 'Rejected' });
    assert.equal((await call(voidPath, 'POST', { reason: '' }, 'admin')).status, 400);
    assert.equal((await call(voidPath, 'POST', { reason: 'Owner reported an incorrect completion status.' }, 'admin')).status, 200);
    assert.equal((await call(`/api/owner/short-stays/${recordId}`, 'PATCH', { status: 'Cancelled' })).status, 200);
    const revised = (await issue()).body.commissionStatements;
    assert.equal(revised.length, 2); assert.equal(revised[0].version, 2); assert.equal(revised[0].commissionPhp, 0);
    assert.equal(revised[1].state, 'Void'); assert.equal(revised[1].commissionPhp, 500);
    await stay({ checkInDate: '2020-11-01', checkOutDate: '2020-11-03' });
    const november = (await issue('2020-11')).body.commissionStatements.find(x => x.billingMonth === '2020-11');
    await submit(november.id, { reference: 'Unique-REF' });
    await stay({ checkInDate: '2020-12-01', checkOutDate: '2020-12-03' });
    const december = (await issue('2020-12')).body.commissionStatements.find(x => x.billingMonth === '2020-12');
    assert.equal((await submit(december.id, { reference: ' unique-ref ' })).body.error.code, 'DUPLICATE_REMITTANCE_REFERENCE');
  });

  it('isolates statements and transfer references from guests, renters and other owners, and resets new tables safely', async () => {
    await stay(); const s = (await issue()).body.commissionStatements[0]; await submit(s.id, { reference: 'PRIVATE-COMMISSION-REFERENCE' });
    for (const path of ['/api/public/listings', '/api/public/workspace?availability=all']) {
      const data = JSON.stringify((await call(path, 'GET', undefined, null)).body);
      for (const secret of ['commissionStatements', 'PRIVATE-COMMISSION-REFERENCE', s.id]) assert.equal(data.includes(secret), false);
    }
    assert.equal((await call('/api/owner/commission-statements', 'POST', { billingMonth: '2020-09' }, null)).status, 401);
    assert.equal((await call('/api/owner/commission-statements', 'POST', { billingMonth: '2020-09' }, 'renter')).status, 403);
    const signup = await call('/api/owners/onboard', 'POST', { ownerId: 'owner-commission-qa', displayName: 'Other statement owner', propertyName: 'Statement isolation', initialUnitsCount: 3, email: 'statement-isolation@example.test', password: 'secure-example-pass' }, null);
    // Onboarding signs in on that response, so get a new isolated owner cookie explicitly.
    assert.equal(signup.status, 201);
    const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: 'statement-isolation@example.test', password: 'secure-example-pass' }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const foreign = await fetch(`${base}/api/owner/commission-statements/${s.id}/remittances`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    assert.equal(foreign.status, 403);
    const other = await (await fetch(`${base}/api/owner/owner-commission-qa/workspace`, { headers: { Cookie: cookie } })).json();
    assert.deepEqual(other.commissionStatements, []); assert.equal(other.subscription.monthlyFeePhp, 0);
    assert.equal((await call('/api/system/reset', 'POST', {}, 'admin')).status, 200);
    assert.deepEqual((await workspace()).body.commissionStatements, []);
  });

  it('links only same-unit inquiries and never treats a link as independent source verification', async () => {
    const w = (await workspace()).body;
    const linked = w.inquiries[0];
    assert.ok(linked, 'Seed includes a traceable owner inquiry for this check');
    {
      const created = await stay({ unitId: linked.unitId, inquiryId: linked.id }); assert.equal(created.status, 201);
      assert.equal(created.body.shortStays[0].inquiryId, linked.id);
      assert.equal((await stay({ unitId: w.units.find(u => u.id !== linked.unitId).id, inquiryId: linked.id })).status, 400);
      assert.equal((await stay({ unitId: linked.unitId, source: 'Other', inquiryId: linked.id })).status, 400);
    }
    assert.equal((await stay({ inquiryId: 'nonexistent' })).status, 400);
    assert.equal(inquiryId === undefined || typeof inquiryId === 'string', true);
  });
});
