import http from 'node:http';
import { URL } from 'node:url';
import { createSilidSmartService, ValidationError, NotFoundError } from './service.mjs';
import { AccessError } from './auth.mjs';
import { paymentReadiness, quoteProposedPayment } from './payments.mjs';

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new ValidationError('PAYLOAD_TOO_LARGE', 'Request body exceeds 1MB limit.'));
      }
    });
    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new ValidationError('INVALID_JSON', 'Request body must be valid JSON.'));
      }
    });
    req.on('error', reject);
  });
}

export function createAppServer(service = createSilidSmartService(), { allowLegacyCommissionWrites = false } = {}) {
  return http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method || 'GET';

    try {
      // Cookie sessions determine identity; client role/owner fields grant no access.
      if (method !== 'GET' && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {
        throw new AccessError(403, 'CROSS_ORIGIN_DENIED', 'Use the application to submit this request.');
      }
      const user = service.auth.getUser(req);
      const requireRole = (role) => {
        if (!user) throw new AccessError(401, 'SIGN_IN_REQUIRED', 'Please sign in to continue.');
        if (user.role !== role) throw new AccessError(403, 'ROLE_FORBIDDEN', 'Your account cannot access this workspace.');
      };
      const ownerWorkspace = () => service.getOwnerWorkspace(user.ownerId);
      const assertOwned = (collection, id) => {
        if (!ownerWorkspace()[collection].some((item) => item.id === id)) {
          throw new AccessError(403, 'PORTFOLIO_FORBIDDEN', 'This record is outside your portfolio.');
        }
      };
      if (method === 'GET' && pathname === '/api/auth/session') {
        sendJson(res, 200, { user }); return;
      }
      if (method === 'POST' && pathname === '/api/auth/login') {
        const body = await readJsonBody(req);
        const signedIn = service.auth.login(body.identifier, body.password);
        service.auth.startSession(signedIn, req, res);
        sendJson(res, 200, { user: signedIn }); return;
      }
      if (method === 'POST' && pathname === '/api/auth/register') {
        const body = await readJsonBody(req);
        const registered = service.auth.register({ name: body.name, email: body.email, phone: body.phone, password: body.password });
        service.auth.startSession(registered, req, res);
        sendJson(res, 201, { user: registered }); return;
      }
      if (method === 'POST' && pathname === '/api/auth/logout') {
        service.auth.endSession(req, res); sendJson(res, 200, { ok: true }); return;
      }
      if (pathname === '/api/bootstrap' || pathname.startsWith('/api/admin/') || pathname.startsWith('/api/system/')) requireRole('admin');
      if (pathname.startsWith('/api/owner/')) requireRole('owner');
      if (method === 'POST' && (pathname === '/api/public/inquiries' || pathname === '/api/public/reports')) requireRole('renter');
      if (!allowLegacyCommissionWrites && method !== 'GET'
        && (/^\/api\/owner\/commission-statements(?:\/|$)/.test(pathname) || /^\/api\/admin\/commission-(statements|remittances)(?:\/|$)/.test(pathname))) {
        const error = new ValidationError('LEGACY_COMMISSION_READ_ONLY', 'Earlier manual commission statements are archived. No new statement or settlement is permitted under the proposed online model.');
        error.status = 409;
        throw error;
      }
      if (method === 'GET' && pathname === '/api/owner/payment-readiness') {
        sendJson(res, 200, paymentReadiness()); return;
      }
      if (method === 'POST' && pathname === '/api/owner/payment-quotes') {
        sendJson(res, 200, quoteProposedPayment(await readJsonBody(req), ValidationError)); return;
      }
      // Health Check
      if (method === 'GET' && pathname === '/api/health') {
        sendJson(res, 200, { status: 'ok', service: 'silidsmart-b2b2c-api', storage: 'sqlite' });
        return;
      }

      // Public B2C Endpoint (Zero Tenant PII Leakage)
      if (method === 'GET' && pathname === '/api/public/listings') {
        sendJson(res, 200, service.getPublicListings(parsedUrl.searchParams.get('availability') || 'available'));
        return;
      }

      // Public B2C Workspace State (Zero Tenant PII, Zero Ledger Data, Vacant Units Only)
      if (method === 'GET' && pathname === '/api/public/workspace') {
        sendJson(res, 200, service.getPublicWorkspace(user?.role === 'renter' ? user.id : null, parsedUrl.searchParams.get('availability') || 'available'));
        return;
      }

      // Multi-Role Admin Workspace Bootstrap State
      if (method === 'GET' && pathname === '/api/bootstrap') {
        sendJson(res, 200, service.getBootstrapState());
        return;
      }

      // Owner-Scoped Workspace State (Strict Landlord Isolation)
      const ownerWorkspaceMatch = pathname.match(/^\/api\/owner\/([^/]+)\/workspace$/);
      if (method === 'GET' && ownerWorkspaceMatch) {
        const ownerId = decodeURIComponent(ownerWorkspaceMatch[1]);
        if (ownerId !== user.ownerId) throw new AccessError(403, 'PORTFOLIO_FORBIDDEN', 'This is not your portfolio.');
        sendJson(res, 200, service.getOwnerWorkspace(ownerId));
        return;
      }

      // Owner Subscription Tier Summary
      const ownerTierMatch = pathname.match(/^\/api\/owner\/([^/]+)\/subscription$/);
      if (method === 'GET' && ownerTierMatch) {
        const ownerId = decodeURIComponent(ownerTierMatch[1]);
        if (ownerId !== user.ownerId) throw new AccessError(403, 'PORTFOLIO_FORBIDDEN', 'This is not your portfolio.');
        sendJson(res, 200, service.getOwnerSubscriptionSummary(ownerId));
        return;
      }

      // 1. Toggle Unit Occupancy (Real-time B2B -> B2C Vacancy Sync)
      const occupancyMatch = pathname.match(/^\/api\/owner\/units\/([^/]+)\/occupancy$/);
      if (method === 'PATCH' && occupancyMatch) {
        const unitId = decodeURIComponent(occupancyMatch[1]);
        assertOwned('units', unitId);
        const body = await readJsonBody(req);
        service.toggleUnitOccupancy({
          unitId,
          newStatus: body.newStatus,
          tenantName: body.tenantName,
          tenantContact: body.tenantContact,
          moveInDate: body.moveInDate,
        });
        sendJson(res, 200, ownerWorkspace());
        return;
      }

      // 2. Add New Room / Unit
      const directoryMatch = pathname.match(/^\/api\/owner\/units\/([^/]+)\/directory$/);
      if (method === 'PATCH' && directoryMatch) {
        const unitId = decodeURIComponent(directoryMatch[1]);
        assertOwned('units', unitId);
        const body = await readJsonBody(req);
        service.updateUnitDirectory({ unitId, published: body.published, expectedAvailableFrom: body.expectedAvailableFrom });
        sendJson(res, 200, ownerWorkspace());
        return;
      }
      if (method === 'POST' && pathname === '/api/owner/utility-records') {
        const body = await readJsonBody(req);
        assertOwned('units', body.unitId);
        service.addUtilityRecord(body);
        sendJson(res, 201, ownerWorkspace());
        return;
      }
      const utilityMatch = pathname.match(/^\/api\/owner\/utility-records\/([^/]+)$/);
      if (method === 'PATCH' && utilityMatch) {
        const recordId = decodeURIComponent(utilityMatch[1]);
        assertOwned('utilityRecords', recordId);
        service.updateUtilityRecord(recordId, await readJsonBody(req));
        sendJson(res, 200, ownerWorkspace());
        return;
      }

      if (method === 'POST' && pathname === '/api/owner/units') {
        const body = await readJsonBody(req);
        assertOwned('properties', body.propertyId);
        service.addUnit(body);
        sendJson(res, 201, ownerWorkspace());
        return;
      }

      // Manual platform-fee collection records. No provider or funds movement.
      if (method === 'POST' && pathname === '/api/owner/commission-statements') {
        const body = await readJsonBody(req);
        service.issueCommissionStatement(user.ownerId, body.billingMonth);
        sendJson(res, 201, ownerWorkspace()); return;
      }
      const remittanceMatch = pathname.match(/^\/api\/owner\/commission-statements\/([^/]+)\/remittances$/);
      if (method === 'POST' && remittanceMatch) {
        const id = decodeURIComponent(remittanceMatch[1]);
        assertOwned('commissionStatements', id);
        service.submitCommissionRemittance(id, await readJsonBody(req));
        sendJson(res, 201, ownerWorkspace()); return;
      }
      const reviewRemittanceMatch = pathname.match(/^\/api\/admin\/commission-remittances\/([^/]+)$/);
      if (method === 'PATCH' && reviewRemittanceMatch) {
        service.reviewCommissionRemittance(decodeURIComponent(reviewRemittanceMatch[1]), await readJsonBody(req), user.id);
        sendJson(res, 200, service.getBootstrapState()); return;
      }
      const voidStatementMatch = pathname.match(/^\/api\/admin\/commission-statements\/([^/]+)\/void$/);
      if (method === 'POST' && voidStatementMatch) {
        const body = await readJsonBody(req);
        service.voidCommissionStatement(decodeURIComponent(voidStatementMatch[1]), body.reason);
        sendJson(res, 200, service.getBootstrapState()); return;
      }

      // Private manual short-stay ledger; these routes do not process payments.
      if (method === 'POST' && pathname === '/api/owner/short-stays') {
        const body = await readJsonBody(req);
        assertOwned('units', body.unitId);
        service.recordShortStay(body);
        sendJson(res, 201, ownerWorkspace());
        return;
      }
      const shortStayMatch = pathname.match(/^\/api\/owner\/short-stays\/([^/]+)$/);
      if (method === 'PATCH' && shortStayMatch) {
        const recordId = decodeURIComponent(shortStayMatch[1]);
        assertOwned('shortStays', recordId);
        const body = await readJsonBody(req);
        service.updateShortStayStatus({ recordId, status: body.status });
        sendJson(res, 200, ownerWorkspace());
        return;
      }

      // 3. Update Rent Payment Status
      const rentMatch = pathname.match(/^\/api\/owner\/rent-records\/([^/]+)$/);
      if (method === 'PATCH' && rentMatch) {
        const recordId = decodeURIComponent(rentMatch[1]);
        assertOwned('rentRecords', recordId);
        const body = await readJsonBody(req);
        service.updateRentStatus({
          recordId,
          paymentStatus: body.paymentStatus,
        });
        sendJson(res, 200, ownerWorkspace());
        return;
      }

      // 4. Renter Submits Viewing Inquiry
      if (method === 'POST' && pathname === '/api/public/inquiries') {
        const body = await readJsonBody(req);
        service.submitInquiry({ ...body, renterId: user.id });
        sendJson(res, 201, service.getPublicWorkspace(user.id));
        return;
      }

      // 5. Owner Responds to Viewing Inquiry
      const inquiryMatch = pathname.match(/^\/api\/owner\/inquiries\/([^/]+)$/);
      if (method === 'PATCH' && inquiryMatch) {
        const inquiryId = decodeURIComponent(inquiryMatch[1]);
        assertOwned('inquiries', inquiryId);
        const body = await readJsonBody(req);
        service.respondInquiry({
          inquiryId,
          action: body.action,
        });
        sendJson(res, 200, ownerWorkspace());
        return;
      }

      // 6. Renter Submits Listing Discrepancy Report
      if (method === 'POST' && pathname === '/api/public/reports') {
        const body = await readJsonBody(req);
        service.submitReport(body);
        sendJson(res, 201, { ok: true });
        return;
      }

      // 7. Admin Reviews Owner Government ID
      const idReviewMatch = pathname.match(/^\/api\/admin\/owners\/([^/]+)\/id-review$/);
      if (method === 'PATCH' && idReviewMatch) {
        const ownerId = decodeURIComponent(idReviewMatch[1]);
        const body = await readJsonBody(req);
        const state = service.reviewOwnerId({
          ownerId,
          newStatus: body.newStatus,
        });
        sendJson(res, 200, state);
        return;
      }

      // 8. Admin Resolves Listing Report
      const resolveReportMatch = pathname.match(/^\/api\/admin\/reports\/([^/]+)\/resolve$/);
      if (method === 'PATCH' && resolveReportMatch) {
        const reportId = decodeURIComponent(resolveReportMatch[1]);
        const state = service.resolveReport({ reportId });
        sendJson(res, 200, state);
        return;
      }

      // 9. Admin Toggles Unit Publish Status
      const publishMatch = pathname.match(/^\/api\/admin\/units\/([^/]+)\/publish$/);
      if (method === 'PATCH' && publishMatch) {
        const unitId = decodeURIComponent(publishMatch[1]);
        const body = await readJsonBody(req);
        const state = service.togglePublishUnit({
          unitId,
          published: body.published,
        });
        sendJson(res, 200, state);
        return;
      }

      // 10. Reset Database to Canonical BMC Seed
      if (method === 'POST' && pathname === '/api/system/reset') {
        const state = service.resetDatabase();
        sendJson(res, 200, state);
        return;
      }

      // 11. Onboard New Landlord + Property + Starter Units
      if (method === 'POST' && pathname === '/api/owners/onboard') {
        const body = await readJsonBody(req);
        // Validate account fields before creating a portfolio; never accept a supplied role.
        if (!body.email || !body.password) throw new ValidationError('ACCOUNT_REQUIRED', 'Email and password are required.');
        const result = service.onboardOwner({ ...body, account: { name: body.displayName, email: body.email, phone: body.phone, password: body.password } });
        const signedIn = result.user;
        service.auth.startSession(signedIn, req, res);
        sendJson(res, 201, { onboardedOwnerId: result.onboardedOwnerId, user: signedIn });
        return;
      }

      sendJson(res, 404, {
        error: {
          code: 'ROUTE_NOT_FOUND',
          message: `Route ${method} ${pathname} does not exist.`,
          details: {},
        },
      });
    } catch (err) {
      if (err instanceof ValidationError || err instanceof NotFoundError || err instanceof AccessError) {
        sendJson(res, err.status, {
          error: {
            code: err.code,
            message: err.message,
            details: err.details || {},
          },
        });
        return;
      }

      console.error('[SilidSmart API Error]', err);
      sendJson(res, 500, {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected server error occurred.',
          details: {},
        },
      });
    }
  });
}

// Start HTTP server if executed directly
const isMain = process.argv[1] && process.argv[1].endsWith('server.mjs');
if (isMain) {
  const port = Number(process.env.PORT || 4000);
  const server = createAppServer();
  server.listen(port, () => {
    console.log(`SilidSmart B2B2C Backend API running on http://localhost:${port}`);
  });
}
