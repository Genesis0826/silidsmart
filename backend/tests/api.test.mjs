import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createSilidSmartService, calculateBmcSubscriptionTier } from '../src/service.mjs';
import { createAppServer } from '../src/server.mjs';

describe('SilidSmart B2B2C Backend API & Privacy Guardrail Suite', () => {
  let server;
  let baseUrl;
  const cookies = new Map();
  const emails = { owner: 'maria.santos@silidsmart.ph', renter: 'juan.delacruz@gmail.com', admin: 'governance@silidsmart.ph' };
  const request = async (path, options = {}, selectedRole) => {
    const role = selectedRole || (path.startsWith('/api/owner/') ? 'owner' : /bootstrap|admin|system/.test(path) ? 'admin' : options.method === 'POST' && path.startsWith('/api/public/') ? 'renter' : null);
    if (role && !cookies.has(role)) {
      const login = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: emails[role], password: 'password123' }) });
      assert.equal(login.status, 200);
      cookies.set(role, login.headers.get('set-cookie').split(';')[0]);
    }
    return fetch(`${baseUrl}${path}`, { ...options, headers: { ...options.headers, ...(role ? { Cookie: cookies.get(role) } : {}) } });
  };

  before(async () => {
    const service = createSilidSmartService(':memory:');
    server = createAppServer(service);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('1. BMC Subscription Tier Calculator enforces 1 room/apt = 1 count and exact PHP pricing', () => {
    for (const [count, fee] of [[0, 0], [1, 0], [4, 0], [5, 99], [10, 99], [11, 199], [25, 199], [26, 349], [50, 349], [51, null]]) {
      assert.equal(calculateBmcSubscriptionTier(count).monthlyFeePhp, fee, `Boundary ${count}`);
    }
    const tier1 = calculateBmcSubscriptionTier(6);
    assert.equal(tier1.monthlyFeePhp, 99);
    assert.equal(tier1.countingRule, '1 room or 1 apartment = 1 count');
    assert.equal(tier1.disclaimer, 'The monthly fee depends on the total rooms or apartment units managed');

    const tier2 = calculateBmcSubscriptionTier(18);
    assert.equal(tier2.monthlyFeePhp, 199);

    const tier3 = calculateBmcSubscriptionTier(42);
    assert.equal(tier3.monthlyFeePhp, 349);

    const tierCustom = calculateBmcSubscriptionTier(65);
    assert.equal(tierCustom.monthlyFeePhp, null);
    assert.equal(tierCustom.customQuote, true);
  });

  it('2. Public Directory API (/api/public/listings) returns only Vacant published units and leaks 0 tenant PII', async () => {
    const res = await request('/api/public/listings');
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.prototypeNotice, 'Concept prototype - sample properties only');
    assert.equal(body.renterFeePhp, 0);
    assert.ok(Array.isArray(body.listings));
    assert.equal(body.listings.length, 9); // 6 UST + 3 Quezon City vacant example units

    const rawJsonString = JSON.stringify(body);
    // Verify zero tenant names or contacts leak into public payload
    assert.equal(rawJsonString.includes('Ana Patricia Reyes'), false);
    assert.equal(rawJsonString.includes('Carmela Bautista'), false);
    assert.equal(rawJsonString.includes('Engr. Mark Mendoza'), false);
    assert.equal(rawJsonString.includes('Trisha Mae Uy'), false);
    assert.equal(rawJsonString.includes('paymentStatus'), false);

    // Verify mandatory disclaimers on verified owner listing (unit-2)
    const verifiedListing = body.listings.find((l) => l.unitId === 'unit-2');
    assert.ok(verifiedListing);
    assert.equal(verifiedListing.status, 'Vacant');
    assert.match(verifiedListing.freshnessNotice, /^Availability last updated by owner:/);
    assert.equal(verifiedListing.owner.trustBadgeText, 'Owner ID reviewed');
    assert.equal(verifiedListing.owner.safetyDisclaimer, 'This does not certify property safety');
  });

  it('3. Real-Time Vacancy Sync: Marking unit-2 Occupied creates private tenant/ledger and delists from public search', async () => {
    const patchRes = await request('/api/owner/units/unit-2/occupancy', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newStatus: 'Occupied',
        tenantName: 'Carlo Mendoza',
        tenantContact: '0917-555-9000',
        moveInDate: '2026-11-07',
      }),
    });
    assert.equal(patchRes.status, 200);
    const updatedState = await patchRes.json();

    // Verify tenant and rent record were created in private workspace state
    const addedTenant = updatedState.tenants.find((t) => t.unitId === 'unit-2');
    assert.ok(addedTenant);
    assert.equal(addedTenant.name, 'Carlo Mendoza');

    const addedRent = updatedState.rentRecords.find((r) => r.unitId === 'unit-2' && r.tenantName === 'Carlo Mendoza');
    assert.ok(addedRent);
    assert.equal(addedRent.paymentStatus, 'Due');

    // Verify unit-2 immediately vanished from public directory search
    const pubRes = await request('/api/public/listings');
    const pubBody = await pubRes.json();
    assert.equal(pubBody.listings.some((l) => l.unitId === 'unit-2'), false);
    assert.equal(pubBody.listings.length, 8);
  });

  it('4. Input validation rejects invalid payloads with 400 Bad Request', async () => {
    const badRes = await request('/api/owner/units/unit-2/occupancy', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newStatus: 'InvalidState' }),
    });
    assert.equal(badRes.status, 400);
    const errBody = await badRes.json();
    assert.equal(errBody.error.code, 'INVALID_OCCUPANCY_STATUS');
  });

  it('5. Inquiry, Moderation, and System Reset workflows execute cleanly', async () => {
    // Submit viewing inquiry
    const inqRes = await request('/api/public/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unitId: 'unit-4',
        propertyId: 'prop-1',
        propertyName: 'P. Noval Scholars Boarding House',
        unitLabel: 'Room 305 (2-Pax Lower Bunk Bedspace)',
        renterName: 'Miguel Lopez',
        renterContact: '0918-777-1234',
        moveInDate: '2026-11-20',
        message: 'Can I view this afternoon?',
      }),
    });
    assert.equal(inqRes.status, 201);

    // Admin approves owner-3 ID review
    const adminRes = await request('/api/admin/owners/owner-3/id-review', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newStatus: 'ID reviewed' }),
    });
    assert.equal(adminRes.status, 200);
    const adminState = await adminRes.json();
    const owner3 = adminState.owners.find((o) => o.id === 'owner-3');
    assert.equal(owner3.idReviewStatus, 'ID reviewed');

    // Reset system back to seed state
    const resetRes = await request('/api/system/reset', { method: 'POST' });
    assert.equal(resetRes.status, 200);
    const resetState = await resetRes.json();
    assert.equal(resetState.units.filter((u) => u.status === 'Vacant' && u.published).length, 9);
  });

  it('6. Assisted Owner Onboarding (/api/owners/onboard) creates owner, property, and starter vacant units', async () => {
    const onboardRes = await request('/api/owners/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerId: 'owner-test-99',
        email: 'lorna@silidsmart.ph', password: 'test-password-123',
        displayName: 'Lorna Tolentino',
        contactMethod: '0917-888-1122 / lorna@silidsmart.ph',
        idDocumentName: 'PhilSys_National_ID.pdf',
        propertyName: 'Lorna Student Condo Residences',
        propertyType: 'Condo',
        area: 'Sampaloc, Manila',
        address: '888 Padre Noval St, Sampaloc, Manila',
        initialUnitsCount: 2,
        monthlyRent: 14500,
      }),
    });
    assert.equal(onboardRes.status, 201);
    const onboardBody = await onboardRes.json();
    assert.equal(onboardBody.onboardedOwnerId, 'owner-test-99');

    assert.equal(onboardBody.user.ownerId, 'owner-test-99');
    assert.equal(onboardBody.user.role, 'owner');
    assert.equal('state' in onboardBody, false);

    // Verify new vacant units are immediately searchable in public directory
    const pubRes = await request('/api/public/listings');
    const pubBody = await pubRes.json();
    assert.equal(pubBody.listings.length, 11); // 9 seed vacant + 2 newly onboarded vacant units
  });

  it('7. Public Workspace (/api/public/workspace) isolates public B2C listings from private PII & occupied units', async () => {
    const resetRes = await request('/api/system/reset', { method: 'POST' });
    assert.equal(resetRes.status, 200);

    const res = await request('/api/public/workspace');
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.prototypeNotice, 'Concept prototype - sample properties only');
    assert.equal(body.renterFeePhp, 0);
    assert.equal('tenants' in body, false);
    assert.equal('rentRecords' in body, false);
    assert.equal('listingReports' in body, false);
    assert.equal('systemEvents' in body, false);

    assert.ok(Array.isArray(body.units));
    assert.equal(body.units.every((u) => u.published && u.status === 'Vacant'), true);
    assert.equal(body.owners.every((o) => !('idDocumentName' in o) && !('contactMethod' in o)), true);
  });

  it('8. Owner-Scoped Workspace (/api/owner/:ownerId/workspace) isolates each landlord portfolio and denies access to another portfolio', async () => {
    const res = await request('/api/owner/owner-1/workspace');
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.owner.id, 'owner-1');
    assert.equal(body.properties.every((p) => p.ownerId === 'owner-1'), true);
    const ownedPropIds = new Set(body.properties.map((p) => p.id));
    assert.equal(body.units.every((u) => ownedPropIds.has(u.propertyId)), true);
    const ownedUnitIds = new Set(body.units.map((u) => u.id));
    assert.equal(body.tenants.every((t) => ownedUnitIds.has(t.unitId)), true);
    assert.equal(body.rentRecords.every((r) => ownedUnitIds.has(r.unitId)), true);
    assert.equal(body.inquiries.every((i) => ownedPropIds.has(i.propertyId)), true);
    assert.equal(body.subscription.managedUnits, body.units.length);

    assert.deepEqual(body.owners.map((owner) => owner.id), ['owner-1']);
    const missingRes = await request('/api/owner/owner-does-not-exist/workspace');
    assert.equal(missingRes.status, 403);

  });

  it('9. Guests cannot read private workspaces or write owner/admin records', async () => {
    for (const [path, method] of [
      ['/api/bootstrap', 'GET'], ['/api/owner/owner-1/workspace', 'GET'],
      ['/api/owner/units/unit-2/occupancy', 'PATCH'], ['/api/system/reset', 'POST'],
      ['/api/public/inquiries', 'POST'], ['/api/public/reports', 'POST'],
    ]) {
      const res = await fetch(`${baseUrl}${path}`, { method, headers: { 'Content-Type': 'application/json' }, ...(method === 'GET' ? {} : { body: '{}' }) });
      assert.equal(res.status, 401, path);
    }
    assert.deepEqual((await (await request('/api/public/workspace')).json()).inquiries, []);
  });

  it('10. Renters cannot access landlord/admin endpoints even with forged role fields', async () => {
    for (const path of ['/api/bootstrap', '/api/owner/owner-1/workspace', '/api/owner/owner-1/subscription']) {
      assert.equal((await request(path, {}, 'renter')).status, 403, path);
    }
    const res = await request('/api/admin/owners/owner-1/id-review', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin', newStatus: 'Needs correction' }),
    }, 'renter');
    assert.equal(res.status, 403);
  });

  it('11. Landlords cannot mutate other portfolios or receive platform-wide mutation responses', async () => {
    for (const [path, body] of [
      ['/api/owner/units/unit-6/occupancy', { newStatus: 'Occupied' }],
      ['/api/owner/units', { propertyId: 'prop-2', unitLabel: 'Unauthorized', monthlyRent: 5000 }],
    ]) {
      const res = await request(path, { method: path.endsWith('/units') ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      assert.equal(res.status, 403);
    }
    const res = await request('/api/owner/units/unit-2/occupancy', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newStatus: 'Vacant' }),
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.ok(body.properties.every((property) => property.ownerId === 'owner-1'));
    assert.equal('listingReports' in body, false);
    assert.equal('systemEvents' in body, false);
    assert.equal((await request('/api/bootstrap', {}, 'owner')).status, 403);
  });

  it('12. Server account identity scopes viewing requests, including forged renter IDs and shared contact details', async () => {
    const registered = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Juan Dela Cruz', email: 'another-renter@example.ph', phone: '0918-123-4567', password: 'test-password-123', role: 'admin', ownerId: 'owner-1' }),
    });
    assert.equal(registered.status, 201);
    const account = await registered.json();
    assert.equal(account.user.role, 'renter');
    assert.equal(account.user.ownerId, undefined);
    const cookie = registered.headers.get('set-cookie').split(';')[0];
    const submitted = await fetch(`${baseUrl}/api/public/inquiries`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ unitId: 'unit-2', propertyId: 'prop-1', renterName: 'Juan Dela Cruz', renterContact: '0918-123-4567', renterId: 'user-renter-1', message: 'Private second renter request' }),
    });
    assert.equal(submitted.status, 201);
    const own = await submitted.json();
    assert.equal(own.inquiries.length, 1);
    assert.equal(own.inquiries[0].message, 'Private second renter request');
    assert.equal('tenants' in own, false);
    assert.equal('rentRecords' in own, false);
    const other = await (await request('/api/public/workspace', {}, 'renter')).json();
    assert.equal(other.inquiries.some((inquiry) => inquiry.message === 'Private second renter request'), false);
    const guest = await (await request('/api/public/workspace')).json();
    assert.deepEqual(guest.inquiries, []);
  });

  it('13. Password validation rejects invented identities and sessions are revoked on logout', async () => {
    for (const [identifier, password] of [['admin@unknown.ph', 'password123'], ['maria.santos@silidsmart.ph', 'incorrect']]) {
      const res = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier, password, role: 'admin' }) });
      assert.equal(res.status, 401);
      assert.equal(res.headers.get('set-cookie'), null);
    }
    const logout = await request('/api/auth/logout', { method: 'POST' }, 'owner');
    assert.equal(logout.status, 200);
    assert.equal((await request('/api/owner/owner-1/workspace', {}, 'owner')).status, 401);
    cookies.delete('owner');
    const login = await request('/api/owner/owner-1/workspace');
    assert.equal(login.status, 200);
  });

  it('14. Map inventory contains only vacant published rentals with explicit UST and QC example coordinates', async () => {
    const body = await (await request('/api/public/workspace')).json();
    const scoped = (scope) => body.properties.filter((property) => property.mapScope === scope);
    assert.equal(scoped('ust').length, 5);
    assert.equal(scoped('qc').length, 3);
    for (const property of [...scoped('ust'), ...scoped('qc')]) {
      assert.ok(property.latitude > 14.5 && property.latitude < 14.8);
      assert.ok(property.longitude > 120.9 && property.longitude < 121.2);
      assert.ok(body.units.some((unit) => unit.propertyId === property.id && unit.status === 'Vacant' && unit.published));
    }
    assert.ok(scoped('qc').every((property) => property.name.includes('(Example)')));
  });

  it('15. Invalid owner account registration rolls back the property and account together', async () => {
    const before = await (await request('/api/bootstrap')).json();
    const response = await fetch(`${baseUrl}/api/owners/onboard`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId: 'owner-invalid-account', displayName: 'Invalid account', propertyName: 'Must not exist', email: 'invalid-email', password: 'short' }),
    });
    assert.equal(response.status, 400);
    const after = await (await request('/api/bootstrap')).json();
    assert.equal(after.properties.length, before.properties.length);
    assert.equal(after.owners.length, before.owners.length);
  });

  it('16. Private short-stay records enforce server-side 5%, cancellation and source rules', async () => {
    const before = await (await request('/api/owner/owner-1/workspace')).json();
    const stay = { unitId: before.units[0].id, guestName: 'Private short stay guest', checkInDate: '2026-11-01', checkOutDate: '2026-11-04', rentTotalPhp: 1500, source: 'SilidSmart' };
    const create = await request('/api/owner/short-stays', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...stay, commissionPercent: 0, commissionPhp: 0 }),
    });
    assert.equal(create.status, 201);
    const state = await create.json();
    const record = state.shortStays.find((row) => row.guestName === stay.guestName);
    assert.equal(record.commissionPercent, 5);
    assert.equal(record.commissionPhp, 75);
    assert.equal(record.status, 'Completed');
    assert.deepEqual(state.units, before.units, 'Ledger does not reserve or change occupancy');
    assert.equal(state.rentRecords.length, before.rentRecords.length);
    const reload = await (await request('/api/owner/owner-1/workspace')).json();
    assert.ok(reload.shortStays.some((row) => row.id === record.id));

    for (const path of ['/api/public/workspace', '/api/public/listings']) {
      const publicState = await (await request(path)).json();
      assert.equal(JSON.stringify(publicState).includes(stay.guestName), false);
      assert.equal('shortStays' in publicState, false);
    }
    const cancel = await request(`/api/owner/short-stays/${record.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Cancelled' }),
    });
    assert.equal(cancel.status, 200);
    assert.equal((await cancel.json()).shortStays.find((row) => row.id === record.id).commissionPhp, 0);
    const other = await request('/api/owner/short-stays', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...stay, guestName: 'Other source guest', source: 'Other' }),
    });
    assert.equal(other.status, 201);
    assert.equal((await other.json()).shortStays.find((row) => row.guestName === 'Other source guest').commissionPhp, 0);
    const cents = await request('/api/owner/short-stays', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...stay, guestName: 'Rounding guest', rentTotalPhp: 100.10 }),
    });
    assert.equal((await cents.json()).shortStays.find((row) => row.guestName === 'Rounding guest').commissionPhp, 5.01);
  });

  it('17. Short-stay validation and portfolio/role boundaries reject forged or invalid records', async () => {
    const owner = await (await request('/api/owner/owner-1/workspace')).json();
    const stay = { unitId: owner.units[0].id, guestName: 'Validation guest', checkInDate: '2026-11-01', checkOutDate: '2026-11-04', rentTotalPhp: 1500, source: 'SilidSmart' };
    for (const change of [{ checkOutDate: stay.checkInDate }, { checkInDate: '2026-02-30' }, { rentTotalPhp: -1 }, { rentTotalPhp: '1500' }, { rentTotalPhp: 1.234 }, { source: 'Invalid' }, { guestName: ' ' }]) {
      const res = await request('/api/owner/short-stays', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...stay, ...change }) });
      assert.equal(res.status, 400, JSON.stringify(change));
    }
    const all = await (await request('/api/bootstrap')).json();
    const foreignUnit = all.units.find((unit) => !owner.units.some((owned) => owned.id === unit.id));
    const foreign = await request('/api/owner/short-stays', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...stay, unitId: foreignUnit.id }) });
    assert.equal(foreign.status, 403);
    const renter = await request('/api/owner/short-stays', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(stay) }, 'renter');
    assert.equal(renter.status, 403);
    const guest = await fetch(`${baseUrl}/api/owner/short-stays`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(stay) });
    assert.equal(guest.status, 401);
    const invalidStatus = await request(`/api/owner/short-stays/${owner.shortStays[0].id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Paid' }) });
    assert.equal(invalidStatus.status, 400);
    const missing = await request('/api/owner/short-stays/not-owned', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Cancelled' }) });
    assert.equal(missing.status, 403);
  });

  it('18. A three-unit free owner pays the same 5% and cannot read or change another owner\'s stay', async () => {
    const signup = await fetch(`${baseUrl}/api/owners/onboard`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId: 'owner-free-stays', displayName: 'Free condo owner', propertyName: 'Three condo units', propertyType: 'Condo', initialUnitsCount: 3, email: 'free-stays@example.test', password: 'secure-example-pass' }),
    });
    assert.equal(signup.status, 201);
    const cookie = signup.headers.get('set-cookie').split(';')[0];
    const ownFetch = (path, options = {}) => fetch(`${baseUrl}${path}`, { ...options, headers: { ...options.headers, Cookie: cookie } });
    const freeState = await (await ownFetch('/api/owner/owner-free-stays/workspace')).json();
    assert.equal(freeState.subscription.monthlyFeePhp, 0);
    assert.deepEqual(freeState.shortStays, []);
    const created = await ownFetch('/api/owner/short-stays', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unitId: freeState.units[0].id, guestName: 'Free plan guest', checkInDate: '2026-11-01', checkOutDate: '2026-11-04', rentTotalPhp: 1500, source: 'SilidSmart' }),
    });
    assert.equal(created.status, 201);
    const state = await created.json();
    assert.equal(state.shortStays[0].commissionPhp, 75);
    assert.equal(state.subscription.monthlyFeePhp, 0);
    const otherOwner = await (await request('/api/owner/owner-1/workspace')).json();
    assert.equal(otherOwner.shortStays.some((stay) => stay.id === state.shortStays[0].id), false);
    const blocked = await request(`/api/owner/short-stays/${state.shortStays[0].id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Cancelled' }),
    });
    assert.equal(blocked.status, 403);
    const cancelled = await ownFetch(`/api/owner/short-stays/${state.shortStays[0].id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Cancelled' }),
    });
    assert.equal((await cancelled.json()).shortStays[0].commissionPhp, 0);
    const restored = await ownFetch(`/api/owner/short-stays/${state.shortStays[0].id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Completed' }),
    });
    assert.equal((await restored.json()).shortStays[0].commissionPhp, 75);
  });
});
