import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  UserRole,
  Property,
  Unit,
  Tenant,
  RentRecord,
  Inquiry,
  ListingReport,
  SystemEvent,
  Owner,
  IDReviewStatus,
  RentPaymentStatus,
  AuthUser,
} from './types';
import { initialUsers } from './seedData';
import { RoleSwitcher } from './components/RoleSwitcher';
import { CustomerView } from './components/CustomerView';
import { OwnerView } from './components/OwnerView';
import { AdminView } from './components/AdminView';
import { AuthModal } from './components/AuthModal';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

interface PublicWorkspacePayload {
  owners: Owner[];
  properties: Property[];
  units: Unit[];
  inquiries: Inquiry[];
}

interface OwnerWorkspacePayload {
  owner: Owner;
  owners: Owner[];
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
  rentRecords: RentRecord[];
  inquiries: Inquiry[];
}

interface BootstrapPayload {
  owners: Owner[];
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
  rentRecords: RentRecord[];
  inquiries: Inquiry[];
  listingReports: ListingReport[];
  systemEvents: SystemEvent[];
}

function getWorkspaceUrl(role: UserRole, ownerId: string): string {
  if (role === 'renter') return '/api/public/workspace';
  if (role === 'owner') return `/api/owner/${encodeURIComponent(ownerId)}/workspace`;
  return '/api/bootstrap';
}

export function App() {
  // Authentication & session state (starts as guest renter browsing free public directory)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalInitialRole, setAuthModalInitialRole] = useState<UserRole>('renter');

  // Active perspective role
  const [currentRole, setCurrentRole] = useState<UserRole>('renter');
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('owner-1');

  // SQLite API connectivity & loading/error states (Zero silent seed fallback)
  const [apiConnected, setApiConnected] = useState<boolean>(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [errorInfo, setErrorInfo] = useState<{ key: string; message: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState<boolean>(false);

  // Authoritative SQLite-backed state scoped to active role
  const [owners, setOwners] = useState<Owner[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [rentRecords, setRentRecords] = useState<RentRecord[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [listingReports, setListingReports] = useState<ListingReport[]>([]);
  const [systemEvents, setSystemEvents] = useState<SystemEvent[]>([]);

  const requestSeqRef = useRef(0);
  const activeOwner = owners.find((o) => o.id === selectedOwnerId) || owners[0] || null;
  const workspaceKey = currentRole === 'owner' ? `owner:${selectedOwnerId}` : currentRole;
  const loadError = errorInfo?.key === workspaceKey ? errorInfo.message : null;
  const hasLoadedRole = loadedKey === workspaceKey;
  const isLoading = !hasLoadedRole && !loadError;

  const loadWorkspace = useCallback(async (role: UserRole, ownerId: string): Promise<boolean> => {
    const seq = ++requestSeqRef.current;
    const targetKey = role === 'owner' ? `owner:${ownerId}` : role;

    try {
      const res = await fetch(getWorkspaceUrl(role, ownerId));
      const payload = await res.json().catch(() => null);

      if (seq !== requestSeqRef.current) return false;

      if (!res.ok || !payload) {
        const msg =
          payload?.error?.message ||
          `Backend API returned HTTP ${res.status} while loading ${role} workspace.`;
        setApiConnected(res.status < 500);
        setErrorInfo({ key: targetKey, message: msg });
        return false;
      }

      if (role === 'renter') {
        const data = payload as PublicWorkspacePayload;
        setOwners(data.owners);
        setProperties(data.properties);
        setUnits(data.units);
        setInquiries(data.inquiries);
        // Explicitly clear private role tables on public renter view
        setTenants([]);
        setRentRecords([]);
        setListingReports([]);
        setSystemEvents([]);
      } else if (role === 'owner') {
        const data = payload as OwnerWorkspacePayload;
        setOwners(data.owners);
        setProperties(data.properties);
        setUnits(data.units);
        setTenants(data.tenants);
        setRentRecords(data.rentRecords);
        setInquiries(data.inquiries);
        setListingReports([]);
        setSystemEvents([]);
      } else {
        const data = payload as BootstrapPayload;
        setOwners(data.owners);
        setProperties(data.properties);
        setUnits(data.units);
        setTenants(data.tenants);
        setRentRecords(data.rentRecords);
        setInquiries(data.inquiries);
        setListingReports(data.listingReports);
        setSystemEvents(data.systemEvents);
      }

      setErrorInfo(null);
      setApiConnected(true);
      setLoadedKey(targetKey);
      return true;
    } catch {
      if (seq !== requestSeqRef.current) return false;
      setApiConnected(false);
      setErrorInfo({
        key: targetKey,
        message:
          'Unable to reach the SilidSmart SQLite backend API. Verify the backend server is running on port 4000 and retry.',
      });
      return false;
    }
  }, []);

  // Re-fetch role-scoped workspace whenever active perspective or selected landlord changes
  useEffect(() => {
    let cancelled = false;
    const targetKey = currentRole === 'owner' ? `owner:${selectedOwnerId}` : currentRole;
    const seq = ++requestSeqRef.current;

    fetch(getWorkspaceUrl(currentRole, selectedOwnerId))
      .then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (cancelled || seq !== requestSeqRef.current) return;

        if (!res.ok || !payload) {
          const msg =
            payload?.error?.message ||
            `Backend API returned HTTP ${res.status} while loading ${currentRole} workspace.`;
          setApiConnected(res.status < 500);
          setErrorInfo({ key: targetKey, message: msg });
          return;
        }

        if (currentRole === 'renter') {
          const data = payload as PublicWorkspacePayload;
          setOwners(data.owners);
          setProperties(data.properties);
          setUnits(data.units);
          setInquiries(data.inquiries);
          setTenants([]);
          setRentRecords([]);
          setListingReports([]);
          setSystemEvents([]);
        } else if (currentRole === 'owner') {
          const data = payload as OwnerWorkspacePayload;
          setOwners(data.owners);
          setProperties(data.properties);
          setUnits(data.units);
          setTenants(data.tenants);
          setRentRecords(data.rentRecords);
          setInquiries(data.inquiries);
          setListingReports([]);
          setSystemEvents([]);
        } else {
          const data = payload as BootstrapPayload;
          setOwners(data.owners);
          setProperties(data.properties);
          setUnits(data.units);
          setTenants(data.tenants);
          setRentRecords(data.rentRecords);
          setInquiries(data.inquiries);
          setListingReports(data.listingReports);
          setSystemEvents(data.systemEvents);
        }

        setErrorInfo(null);
        setApiConnected(true);
        setLoadedKey(targetKey);
      })
      .catch(() => {
        if (cancelled || seq !== requestSeqRef.current) return;
        setApiConnected(false);
        setErrorInfo({
          key: targetKey,
          message:
            'Unable to reach the SilidSmart SQLite backend API. Verify the backend server is running on port 4000 and retry.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [currentRole, selectedOwnerId]);

  const handleRoleChange = (nextRole: UserRole) => {
    setActionError(null);
    setErrorInfo(null);
    setCurrentRole(nextRole);
  };

  const executeMutation = useCallback(
    async <T = unknown>(
      url: string,
      options: RequestInit,
      nextRoleOverride?: UserRole,
      nextOwnerOverride?: string
    ): Promise<{ ok: boolean; data: T | null }> => {
      setActionError(null);
      setIsMutating(true);
      try {
        const res = await fetch(url, options);
        const data = (await res.json().catch(() => null)) as (T & {
          error?: { message?: string };
          onboardedOwnerId?: string;
        }) | null;

        if (!res.ok) {
          const message = data?.error?.message || `Action failed (HTTP ${res.status}).`;
          setActionError(message);
          if (res.status >= 500) setApiConnected(false);
          return { ok: false, data: null };
        }

        const refreshRole = nextRoleOverride ?? currentRole;
        const refreshOwner = nextOwnerOverride ?? data?.onboardedOwnerId ?? selectedOwnerId;
        await loadWorkspace(refreshRole, refreshOwner);
        return { ok: true, data };
      } catch {
        setApiConnected(false);
        setActionError('Network error: Unable to save changes to the SilidSmart backend.');
        return { ok: false, data: null };
      } finally {
        setIsMutating(false);
      }
    },
    [currentRole, selectedOwnerId, loadWorkspace]
  );

  // Auth Handlers
  const handleOpenAuthModal = (role: UserRole = 'renter') => {
    setAuthModalInitialRole(role);
    setIsAuthModalOpen(true);
  };

  const handleLogin = (user: AuthUser) => {
    setActionError(null);
    setErrorInfo(null);
    setCurrentUser(user);
    if (user.ownerId) {
      setSelectedOwnerId(user.ownerId);
    }
    setCurrentRole(user.role);
  };

  const handleOnboardOwner = async (payload: {
    ownerId: string;
    displayName: string;
    contactMethod: string;
    idDocumentName: string;
    propertyName: string;
    initialUnitsCount: number;
  }): Promise<boolean> => {
    const result = await executeMutation<{ onboardedOwnerId?: string }>(
      '/api/owners/onboard',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      'owner',
      payload.ownerId
    );
    if (result.ok) {
      const targetId = result.data?.onboardedOwnerId || payload.ownerId;
      setSelectedOwnerId(targetId);
      setCurrentRole('owner');
    }
    return result.ok;
  };

  const handleLogout = () => {
    setActionError(null);
    setErrorInfo(null);
    setCurrentUser(null);
    setCurrentRole('renter');
  };

  // 1. Owner toggles room occupancy (with optional incoming tenant details)
  const handleToggleOccupancy = async (
    unitId: string,
    newStatus: 'Vacant' | 'Occupied',
    tenantDetails?: { tenantName?: string; tenantContact?: string; moveInDate?: string }
  ): Promise<boolean> => {
    const result = await executeMutation(`/api/owner/units/${encodeURIComponent(unitId)}/occupancy`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newStatus,
        tenantName: tenantDetails?.tenantName,
        tenantContact: tenantDetails?.tenantContact,
        moveInDate: tenantDetails?.moveInDate,
      }),
    });
    return result.ok;
  };

  // 2. Owner adds a new room/unit
  const handleAddUnit = async (unitData: Omit<Unit, 'id' | 'lastUpdated'>): Promise<boolean> => {
    const result = await executeMutation('/api/owner/units', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(unitData),
    });
    return result.ok;
  };

  // 3. Owner updates tenant rent payment status
  const handleUpdateRentStatus = async (recordId: string, newStatus: RentPaymentStatus): Promise<boolean> => {
    const result = await executeMutation(`/api/owner/rent-records/${encodeURIComponent(recordId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentStatus: newStatus }),
    });
    return result.ok;
  };

  // 4. Renter submits viewing inquiry
  const handleSubmitInquiry = async (
    inquiryData: Omit<Inquiry, 'id' | 'status' | 'submittedAt'>
  ): Promise<boolean> => {
    const result = await executeMutation('/api/public/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inquiryData),
    });
    return result.ok;
  };

  // 5. Owner responds to viewing inquiry (Approve / Decline)
  const handleRespondInquiry = async (
    inquiryId: string,
    action: 'Approved' | 'Declined'
  ): Promise<boolean> => {
    const result = await executeMutation(`/api/owner/inquiries/${encodeURIComponent(inquiryId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    return result.ok;
  };

  // 6. Renter reports a listing discrepancy
  const handleSubmitReport = async (
    unitId: string,
    propertyName: string,
    unitLabel: string,
    reason: string,
    details: string
  ): Promise<boolean> => {
    const result = await executeMutation('/api/public/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unitId, propertyName, unitLabel, reason, details }),
    });
    return result.ok;
  };

  // 7. Admin reviews and updates owner ID check status
  const handleReviewOwnerId = async (ownerId: string, newStatus: IDReviewStatus): Promise<boolean> => {
    const result = await executeMutation(`/api/admin/owners/${encodeURIComponent(ownerId)}/id-review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newStatus }),
    });
    return result.ok;
  };

  // 8. Admin marks a report as resolved
  const handleResolveReport = async (reportId: string): Promise<boolean> => {
    const result = await executeMutation(`/api/admin/reports/${encodeURIComponent(reportId)}/resolve`, {
      method: 'PATCH',
    });
    return result.ok;
  };

  // 9. Admin toggles listing publication state
  const handleTogglePublishUnit = async (unitId: string, published: boolean): Promise<boolean> => {
    const result = await executeMutation(`/api/admin/units/${encodeURIComponent(unitId)}/publish`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published }),
    });
    return result.ok;
  };

  // 10. Reset data to initial seed in SQLite database
  const handleResetData = async () => {
    setSelectedOwnerId('owner-1');
    await executeMutation('/api/system/reset', { method: 'POST' }, currentRole, 'owner-1');
  };

  return (
    <div className="app-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Persistent Navigation Header with Role Switcher & Auth */}
      <RoleSwitcher
        currentRole={currentRole}
        onRoleChange={handleRoleChange}
        onResetData={() => void handleResetData()}
        currentUser={currentUser}
        onOpenAuthModal={handleOpenAuthModal}
        onLogout={handleLogout}
      />

      {/* Role-specific Owner Context Switcher */}
      {currentRole === 'owner' && activeOwner && !loadError && (
        <div
          style={{
            backgroundColor: 'var(--action-blue-light)',
            borderBottom: '1px solid var(--action-blue-border)',
            padding: '8px 0',
            fontSize: '0.8125rem',
          }}
        >
          <div
            className="container"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px 10px', maxWidth: '100%' }}>
              <span style={{ fontWeight: 700, color: 'var(--brand-navy)' }}>Simulating Landlord Account:</span>
              <select
                value={selectedOwnerId}
                onChange={(e) => {
                  setActionError(null);
                  setErrorInfo(null);
                  setSelectedOwnerId(e.target.value);
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid var(--action-blue-border)',
                  fontWeight: 700,
                  color: 'var(--brand-navy)',
                  backgroundColor: '#FFFFFF',
                  fontSize: '0.8125rem',
                  maxWidth: '100%',
                }}
              >
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.displayName} ({o.idReviewStatus})
                  </option>
                ))}
              </select>
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
              Currently managing:{' '}
              <strong style={{ color: 'var(--brand-navy)' }}>
                {properties
                  .filter((p) => p.ownerId === activeOwner.id)
                  .map((p) => p.name)
                  .join(', ') || 'No properties'}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Explicit Action Error Banner (HTTP 4xx/5xx or network error) */}
      {actionError && (
        <div className="container" style={{ paddingTop: '14px' }}>
          <div className="api-error-banner" role="alert">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} />
              <span>
                <strong>Action Error:</strong> {actionError}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setActionError(null)}
              aria-label="Dismiss error"
            >
              <X size={13} /> Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main View Rendered According to Role & API Readiness */}
      <main style={{ flex: 1 }}>
        {loadError && !isLoading && (
          <div className="container">
            <div className="api-state-panel" role="alert">
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--status-overdue-bg)',
                  color: 'var(--status-overdue-text)',
                  border: '1px solid #F2B8B5',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '12px',
                }}
              >
                <AlertTriangle size={22} />
              </div>
              <h2
                className="editorial-heading"
                style={{ fontSize: '1.35rem', color: 'var(--brand-navy)', marginBottom: '8px' }}
              >
                Backend Service Unavailable
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '18px' }}>
                {loadError}
              </p>
              <div
                className="mono-num"
                style={{
                  fontSize: '0.76rem',
                  color: 'var(--text-muted)',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-xs)',
                  padding: '8px 12px',
                  marginBottom: '18px',
                }}
              >
                Expected API proxy target: http://localhost:4000 (no mock fallback substituted)
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setErrorInfo(null);
                  void loadWorkspace(currentRole, selectedOwnerId);
                }}
              >
                <RefreshCw size={15} /> Retry Connection
              </button>
            </div>
          </div>
        )}

        {!loadError && isLoading && !hasLoadedRole && (
          <div className="container">
            <div className="api-state-panel" role="status" aria-live="polite">
              <RefreshCw size={26} className="spin-icon" style={{ color: 'var(--action-blue)', marginBottom: '12px' }} />
              <h2
                className="editorial-heading"
                style={{ fontSize: '1.25rem', color: 'var(--brand-navy)', marginBottom: '6px' }}
              >
                Loading {currentRole === 'renter' ? 'Public Directory' : currentRole === 'owner' ? 'Owner Workspace' : 'Platform Governance'}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Fetching role-scoped records from the SilidSmart SQLite database...
              </p>
            </div>
          </div>
        )}

        {!loadError && hasLoadedRole && currentRole === 'renter' && (
          <CustomerView
            properties={properties}
            units={units}
            owners={owners}
            inquiries={inquiries}
            onSubmitInquiry={handleSubmitInquiry}
            onSubmitReport={handleSubmitReport}
            currentUser={currentUser}
            onOpenAuthModal={() => handleOpenAuthModal('renter')}
          />
        )}

        {!loadError && hasLoadedRole && currentRole === 'owner' && activeOwner && (
          <OwnerView
            owner={activeOwner}
            properties={properties}
            units={units}
            tenants={tenants}
            rentRecords={rentRecords}
            inquiries={inquiries}
            onToggleOccupancy={handleToggleOccupancy}
            onAddUnit={handleAddUnit}
            onUpdateRentStatus={handleUpdateRentStatus}
            onRespondInquiry={handleRespondInquiry}
          />
        )}

        {!loadError && hasLoadedRole && currentRole === 'admin' && (
          <AdminView
            owners={owners}
            properties={properties}
            units={units}
            tenants={tenants}
            rentRecords={rentRecords}
            listingReports={listingReports}
            systemEvents={systemEvents}
            onReviewOwnerId={handleReviewOwnerId}
            onResolveReport={handleResolveReport}
            onTogglePublishUnit={handleTogglePublishUnit}
          />
        )}
      </main>

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLogin={handleLogin}
        onOnboardOwner={handleOnboardOwner}
        initialRole={authModalInitialRole}
        demoUsers={initialUsers}
      />

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border-light)',
          backgroundColor: '#FFFFFF',
          padding: '24px 0',
          marginTop: 'auto',
          fontSize: '0.8125rem',
          color: 'var(--text-muted)',
        }}
      >
        <div
          className="container"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <strong style={{ color: 'var(--brand-navy)' }}>SilidSmart.ph</strong> • Small Rental Operations & Public Room Directory
            <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
              Concept prototype - sample properties only • 100% Free Renter Discovery • Monthly flat subscriptions for owners
            </div>
          </div>
          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              className={`badge mono-num ${
                isLoading || isMutating ? 'badge-due' : apiConnected ? 'badge-paid' : 'badge-overdue'
              }`}
            >
              {isLoading || isMutating
                ? 'SQLite API: Syncing...'
                : apiConnected
                ? 'SQLite Persistence: Active'
                : 'SQLite API: Disconnected'}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
