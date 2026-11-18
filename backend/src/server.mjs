import http from 'node:http';
import { URL } from 'node:url';
import { createSilidSmartService, ValidationError, NotFoundError } from './service.mjs';

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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

export function createAppServer(service = createSilidSmartService()) {
  return http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
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
      // Health Check
      if (method === 'GET' && pathname === '/api/health') {
        sendJson(res, 200, { status: 'ok', service: 'silidsmart-b2b2c-api', storage: 'sqlite' });
        return;
      }

      // Public B2C Endpoint (Zero Tenant PII Leakage)
      if (method === 'GET' && pathname === '/api/public/listings') {
        sendJson(res, 200, service.getPublicListings());
        return;
      }

      // Public B2C Workspace State (Zero Tenant PII, Zero Ledger Data, Vacant Units Only)
      if (method === 'GET' && pathname === '/api/public/workspace') {
        sendJson(res, 200, service.getPublicWorkspace());
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
        sendJson(res, 200, service.getOwnerWorkspace(ownerId));
        return;
      }

      // Owner Subscription Tier Summary
      const ownerTierMatch = pathname.match(/^\/api\/owner\/([^/]+)\/subscription$/);
      if (method === 'GET' && ownerTierMatch) {
        const ownerId = decodeURIComponent(ownerTierMatch[1]);
        sendJson(res, 200, service.getOwnerSubscriptionSummary(ownerId));
        return;
      }

      // 1. Toggle Unit Occupancy (Real-time B2B -> B2C Vacancy Sync)
      const occupancyMatch = pathname.match(/^\/api\/owner\/units\/([^/]+)\/occupancy$/);
      if (method === 'PATCH' && occupancyMatch) {
        const unitId = decodeURIComponent(occupancyMatch[1]);
        const body = await readJsonBody(req);
        const state = service.toggleUnitOccupancy({
          unitId,
          newStatus: body.newStatus,
          tenantName: body.tenantName,
          tenantContact: body.tenantContact,
          moveInDate: body.moveInDate,
        });
        sendJson(res, 200, state);
        return;
      }

      // 2. Add New Room / Unit
      if (method === 'POST' && pathname === '/api/owner/units') {
        const body = await readJsonBody(req);
        const state = service.addUnit(body);
        sendJson(res, 201, state);
        return;
      }

      // 3. Update Rent Payment Status
      const rentMatch = pathname.match(/^\/api\/owner\/rent-records\/([^/]+)$/);
      if (method === 'PATCH' && rentMatch) {
        const recordId = decodeURIComponent(rentMatch[1]);
        const body = await readJsonBody(req);
        const state = service.updateRentStatus({
          recordId,
          paymentStatus: body.paymentStatus,
        });
        sendJson(res, 200, state);
        return;
      }

      // 4. Renter Submits Viewing Inquiry
      if (method === 'POST' && pathname === '/api/public/inquiries') {
        const body = await readJsonBody(req);
        const state = service.submitInquiry(body);
        sendJson(res, 201, state);
        return;
      }

      // 5. Owner Responds to Viewing Inquiry
      const inquiryMatch = pathname.match(/^\/api\/owner\/inquiries\/([^/]+)$/);
      if (method === 'PATCH' && inquiryMatch) {
        const inquiryId = decodeURIComponent(inquiryMatch[1]);
        const body = await readJsonBody(req);
        const state = service.respondInquiry({
          inquiryId,
          action: body.action,
        });
        sendJson(res, 200, state);
        return;
      }

      // 6. Renter Submits Listing Discrepancy Report
      if (method === 'POST' && pathname === '/api/public/reports') {
        const body = await readJsonBody(req);
        const state = service.submitReport(body);
        sendJson(res, 201, state);
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
        const result = service.onboardOwner(body);
        sendJson(res, 201, result);
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
      if (err instanceof ValidationError || err instanceof NotFoundError) {
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
