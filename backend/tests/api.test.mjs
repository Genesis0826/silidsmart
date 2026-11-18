import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createSilidSmartService, calculateBmcSubscriptionTier } from '../src/service.mjs';
import { createAppServer } from '../src/server.mjs';

describe('SilidSmart B2B2C Backend API & Privacy Guardrail Suite', () => {
  let server;
  let baseUrl;

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
    const res = await fetch(`${baseUrl}/api/public/listings`);
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.prototypeNotice, 'Concept prototype - sample properties only');
    assert.equal(body.renterFeePhp, 0);
    assert.ok(Array.isArray(body.listings));
    assert.equal(body.listings.length, 6); // 6 vacant units out of 13 total seed units

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
    const patchRes = await fetch(`${baseUrl}/api/owner/units/unit-2/occupancy`, {
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
    const pubRes = await fetch(`${baseUrl}/api/public/listings`);
    const pubBody = await pubRes.json();
    assert.equal(pubBody.listings.some((l) => l.unitId === 'unit-2'), false);
    assert.equal(pubBody.listings.length, 5);
  });

  it('4. Input validation rejects invalid payloads with 400 Bad Request', async () => {
    const badRes = await fetch(`${baseUrl}/api/owner/units/unit-2/occupancy`, {
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
    const inqRes = await fetch(`${baseUrl}/api/public/inquiries`, {
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
    const adminRes = await fetch(`${baseUrl}/api/admin/owners/owner-3/id-review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newStatus: 'ID reviewed' }),
    });
    assert.equal(adminRes.status, 200);
    const adminState = await adminRes.json();
    const owner3 = adminState.owners.find((o) => o.id === 'owner-3');
    assert.equal(owner3.idReviewStatus, 'ID reviewed');

    // Reset system back to seed state
    const resetRes = await fetch(`${baseUrl}/api/system/reset`, { method: 'POST' });
    assert.equal(resetRes.status, 200);
    const resetState = await resetRes.json();
    assert.equal(resetState.units.filter((u) => u.status === 'Vacant' && u.published).length, 6);
  });

  it('6. Assisted Owner Onboarding (/api/owners/onboard) creates owner, property, and starter vacant units', async () => {
    const onboardRes = await fetch(`${baseUrl}/api/owners/onboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerId: 'owner-test-99',
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

    const createdOwner = onboardBody.state.owners.find((o) => o.id === 'owner-test-99');
    assert.ok(createdOwner);
    assert.equal(createdOwner.idReviewStatus, 'Pending review');

    // Verify new vacant units are immediately searchable in public directory
    const pubRes = await fetch(`${baseUrl}/api/public/listings`);
    const pubBody = await pubRes.json();
    assert.equal(pubBody.listings.length, 8); // 6 seed vacant + 2 newly onboarded vacant units
  });

  it('7. Public Workspace (/api/public/workspace) isolates public B2C listings from private PII & occupied units', async () => {
    const resetRes = await fetch(`${baseUrl}/api/system/reset`, { method: 'POST' });
    assert.equal(resetRes.status, 200);

    const res = await fetch(`${baseUrl}/api/public/workspace`);
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

  it('8. Owner-Scoped Workspace (/api/owner/:ownerId/workspace) isolates each landlord portfolio and returns 404 for unknown owner', async () => {
    const res = await fetch(`${baseUrl}/api/owner/owner-1/workspace`);
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

    // Other owners in the directory should not leak contactMethod or idDocumentName
    const otherOwner = body.owners.find((o) => o.id === 'owner-2');
    assert.ok(otherOwner);
    assert.equal('idDocumentName' in otherOwner, false);
    assert.equal('contactMethod' in otherOwner, false);

    // Unknown owner returns 404
    const missingRes = await fetch(`${baseUrl}/api/owner/owner-does-not-exist/workspace`);
    assert.equal(missingRes.status, 404);
    const missingBody = await missingRes.json();
    assert.equal(missingBody.error.code, 'OWNER_NOT_FOUND');
  });
});
