import { useState, useEffect, useMemo } from 'react';
import type { Property, Unit, Tenant, RentRecord, Inquiry, Owner, RentPaymentStatus, ShortStay, ShortStayInput } from '../types';
import {
  Plus, Shield, BarChart3, Download, Search,
  Check, X, FileText, Info, RefreshCw, Rows3, Rows4, QrCode, Share2, Copy, UserCheck
} from 'lucide-react';
import { downloadCsv } from '../utils/exportCsv';
import { ownerPlan } from '../utils/pricing';
import { ShortStayLedger } from './ShortStayLedger';

interface OwnerViewProps {
  owner: Owner;
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
  rentRecords: RentRecord[];
  inquiries: Inquiry[];
  shortStays: ShortStay[];
  onRecordShortStay: (stay: ShortStayInput) => Promise<boolean>;
  onUpdateShortStay: (id: string, status: ShortStay['status']) => Promise<boolean>;
  onToggleOccupancy: (
    unitId: string,
    newStatus: 'Vacant' | 'Occupied',
    tenantDetails?: { tenantName?: string; tenantContact?: string; moveInDate?: string }
  ) => Promise<boolean> | void;
  onAddUnit: (unit: Omit<Unit, 'id' | 'lastUpdated'>) => Promise<boolean> | void;
  onUpdateRentStatus: (recordId: string, newStatus: RentPaymentStatus) => Promise<boolean> | void;
  onRespondInquiry: (inquiryId: string, action: 'Approved' | 'Declined') => Promise<boolean> | void;
}

export const OwnerView = ({
  owner,
  properties,
  units,
  tenants,
  rentRecords,
  inquiries,
  shortStays,
  onRecordShortStay,
  onUpdateShortStay,
  onToggleOccupancy,
  onAddUnit,
  onUpdateRentStatus,
  onRespondInquiry,
}: OwnerViewProps) => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'analytics' | 'tenants' | 'ledger' | 'inquiries' | 'outreach' | 'plans' | 'shortStays'>('inventory');
  const [tableDensity, setTableDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [copiedPostToast, setCopiedPostToast] = useState<string | null>(null);

  // Operational filter states
  const [unitStatusFilter, setUnitStatusFilter] = useState<'All' | 'Vacant' | 'Occupied'>('All');
  const [unitSearchQuery, setUnitSearchQuery] = useState('');
  const [tenantSearchQuery, setTenantSearchQuery] = useState('');
  const [rentStatusFilter, setRentStatusFilter] = useState<'All' | RentPaymentStatus>('All');
  const [inquiryStatusFilter, setInquiryStatusFilter] = useState<'All' | 'Pending' | 'Approved' | 'Declined'>('All');

  // Add Unit Modal state
  const [isAddUnitOpen, setIsAddUnitOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [newUnitLabel, setNewUnitLabel] = useState('');
  const [newRent, setNewRent] = useState<number>(3500);
  const [newDeposit, setNewDeposit] = useState<number>(3500);
  const [newDescription, setNewDescription] = useState('');

  // Assign Tenant Modal state (when marking occupied)
  const [occupancyModalUnit, setOccupancyModalUnit] = useState<Unit | null>(null);
  const [newTenantName, setNewTenantName] = useState('');
  const [newTenantContact, setNewTenantContact] = useState('');
  const [newTenantDate, setNewTenantDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Close open OwnerView modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (occupancyModalUnit) {
        setOccupancyModalUnit(null);
      } else if (isAddUnitOpen) {
        setIsAddUnitOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [occupancyModalUnit, isAddUnitOpen]);

  // Filter records belonging to this owner's properties
  const ownerProperties = properties.filter((p) => p.ownerId === owner.id);
  const effectivePropertyId = ownerProperties.some((p) => p.id === selectedPropertyId)
    ? selectedPropertyId
    : ownerProperties[0]?.id || '';
  const ownerPropertyIds = ownerProperties.map((p) => p.id);
  const ownerUnits = units.filter((u) => ownerPropertyIds.includes(u.propertyId));
  const ownerTenants = tenants.filter((t) => ownerUnits.some((u) => u.id === t.unitId));
  const ownerRentRecords = rentRecords.filter((r) => ownerUnits.some((u) => u.id === r.unitId));
  const ownerInquiries = inquiries.filter((inq) => ownerPropertyIds.includes(inq.propertyId));

  const totalUnits = ownerUnits.length;
  const occupiedUnits = ownerUnits.filter((u) => u.status === 'Occupied').length;
  const vacantUnits = ownerUnits.filter((u) => u.status === 'Vacant').length;
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
  const pendingInquiriesCount = ownerInquiries.filter((i) => i.status === 'Pending').length;
  const overdueRecordsCount = ownerRentRecords.filter((r) => r.paymentStatus === 'Overdue').length;

  // Live portfolio financial & operational analytics (derived strictly from SQLite workspace state)
  const portfolioAnalytics = useMemo(() => {
    const potentialMonthlyGross = ownerUnits.reduce((sum, u) => sum + u.monthlyRent, 0);
    const occupiedMonthlyValue = ownerUnits
      .filter((u) => u.status === 'Occupied')
      .reduce((sum, u) => sum + u.monthlyRent, 0);
    const vacantOpportunityGap = ownerUnits
      .filter((u) => u.status === 'Vacant')
      .reduce((sum, u) => sum + u.monthlyRent, 0);
    const avgMonthlyRent = totalUnits > 0 ? Math.round(potentialMonthlyGross / totalUnits) : 0;

    const totalBilled = ownerRentRecords.reduce((sum, r) => sum + r.amountDue, 0);
    const totalPaid = ownerRentRecords
      .filter((r) => r.paymentStatus === 'Paid')
      .reduce((sum, r) => sum + r.amountDue, 0);
    const totalDue = ownerRentRecords
      .filter((r) => r.paymentStatus === 'Due')
      .reduce((sum, r) => sum + r.amountDue, 0);
    const totalOverdue = ownerRentRecords
      .filter((r) => r.paymentStatus === 'Overdue')
      .reduce((sum, r) => sum + r.amountDue, 0);
    const collectionRate = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 0;

    const byProperty = ownerProperties.map((prop) => {
      const pUnits = ownerUnits.filter((u) => u.propertyId === prop.id);
      const pUnitIds = new Set(pUnits.map((u) => u.id));
      const pOccupied = pUnits.filter((u) => u.status === 'Occupied').length;
      const pVacant = pUnits.filter((u) => u.status === 'Vacant').length;
      const pOccPct = pUnits.length > 0 ? Math.round((pOccupied / pUnits.length) * 100) : 0;
      const pPotential = pUnits.reduce((s, u) => s + u.monthlyRent, 0);
      const pAvgRent = pUnits.length > 0 ? Math.round(pPotential / pUnits.length) : 0;
      const pPaid = ownerRentRecords
        .filter((r) => pUnitIds.has(r.unitId) && r.paymentStatus === 'Paid')
        .reduce((s, r) => s + r.amountDue, 0);
      const pInquiries = ownerInquiries.filter((i) => i.propertyId === prop.id).length;

      return {
        property: prop,
        totalCount: pUnits.length,
        occupiedCount: pOccupied,
        vacantCount: pVacant,
        occupancyPct: pOccPct,
        potentialRent: pPotential,
        avgRent: pAvgRent,
        collectedCash: pPaid,
        inquiriesCount: pInquiries,
      };
    });

    const approvedInq = ownerInquiries.filter((i) => i.status === 'Approved').length;
    const declinedInq = ownerInquiries.filter((i) => i.status === 'Declined').length;
    const totalInq = ownerInquiries.length;
    const approvalRatePct = totalInq > 0 ? Math.round((approvedInq / totalInq) * 100) : 0;

    return {
      potentialMonthlyGross,
      occupiedMonthlyValue,
      vacantOpportunityGap,
      avgMonthlyRent,
      totalBilled,
      totalPaid,
      totalDue,
      totalOverdue,
      collectionRate,
      byProperty,
      inquiryFunnel: {
        total: totalInq,
        approved: approvedInq,
        pending: pendingInquiriesCount,
        declined: declinedInq,
        approvalRatePct,
      },
    };
  }, [ownerProperties, ownerUnits, ownerRentRecords, ownerInquiries, totalUnits, pendingInquiriesCount]);

  // Filtered views for operational tables
  const filteredOwnerUnits = useMemo(() => {
    const q = unitSearchQuery.trim().toLowerCase();
    return ownerUnits.filter((u) => {
      if (unitStatusFilter !== 'All' && u.status !== unitStatusFilter) return false;
      if (!q) return true;
      const prop = ownerProperties.find((p) => p.id === u.propertyId);
      return (
        u.unitLabel.toLowerCase().includes(q) ||
        (prop?.name.toLowerCase().includes(q) ?? false) ||
        (prop?.area.toLowerCase().includes(q) ?? false)
      );
    });
  }, [ownerUnits, ownerProperties, unitStatusFilter, unitSearchQuery]);

  const filteredOwnerTenants = useMemo(() => {
    const q = tenantSearchQuery.trim().toLowerCase();
    if (!q) return ownerTenants;
    return ownerTenants.filter((t) => {
      const unit = ownerUnits.find((u) => u.id === t.unitId);
      return (
        t.name.toLowerCase().includes(q) ||
        t.contact.toLowerCase().includes(q) ||
        (unit?.unitLabel.toLowerCase().includes(q) ?? false)
      );
    });
  }, [ownerTenants, ownerUnits, tenantSearchQuery]);

  const filteredRentRecords = useMemo(() => {
    if (rentStatusFilter === 'All') return ownerRentRecords;
    return ownerRentRecords.filter((r) => r.paymentStatus === rentStatusFilter);
  }, [ownerRentRecords, rentStatusFilter]);

  const filteredInquiries = useMemo(() => {
    if (inquiryStatusFilter === 'All') return ownerInquiries;
    return ownerInquiries.filter((i) => i.status === inquiryStatusFilter);
  }, [ownerInquiries, inquiryStatusFilter]);

  // Determine pricing tier from unit count
  const plan = ownerPlan(totalUnits);
  const currentTier = `${plan.name} • ${plan.price === null ? 'Custom quote' : `₱${plan.price}/mo`}`;

  const cellPad = tableDensity === 'compact' ? '8px 12px' : '14px 16px';

  const handleAddUnitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitLabel.trim() || !effectivePropertyId) return;

    const ok = await onAddUnit({
      propertyId: effectivePropertyId,
      unitLabel: newUnitLabel.trim(),
      monthlyRent: newRent,
      deposit: newDeposit,
      status: 'Vacant',
      published: true,
      description: newDescription || 'Standard comfortable rental space with basic fixtures.',
    });

    if (ok === false) return;

    setIsAddUnitOpen(false);
    setNewUnitLabel('');
    setNewDescription('');
  };

  const handleConfirmOccupied = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!occupancyModalUnit) return;
    const ok = await onToggleOccupancy(occupancyModalUnit.id, 'Occupied', {
      tenantName: newTenantName,
      tenantContact: newTenantContact,
      moveInDate: newTenantDate,
    });
    if (ok === false) return;
    setOccupancyModalUnit(null);
    setNewTenantName('');
    setNewTenantContact('');
  };

  return (
    <div style={{ padding: '24px 0 64px 0' }}>
      <div className="container">
        {/* 1. Un-boxed Editorial Portfolio Header on Canvas (Anti-AI Rule: No redundant card wrapper or colored top border) */}
        <div
          style={{
            paddingBottom: '18px',
            marginBottom: '20px',
            borderBottom: '1px solid var(--border-medium)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div style={{ minWidth: 0, maxWidth: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 className="editorial-heading" style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--brand-navy)', margin: 0 }}>
                Landlord Operations: {owner.displayName}
              </h1>
              {owner.idReviewStatus === 'ID reviewed' ? (
                <span className="badge badge-verified">
                  <Shield size={13} /> Owner ID reviewed
                </span>
              ) : (
                <span className="badge badge-pending">{owner.idReviewStatus}</span>
              )}
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Update occupancy once in this private workspace — public search listings sync automatically.{' '}
              {owner.idReviewStatus === 'ID reviewed' && (
                <span style={{ color: 'var(--text-muted)' }}>• This does not certify property safety</span>
              )}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px', maxWidth: '100%' }}>
            <button
              onClick={() => setActiveTab('plans')}
              className="btn btn-secondary btn-sm mono-num"
              style={{ maxWidth: '100%', whiteSpace: 'normal', textAlign: 'left' }}
              title="View BMC Subscription Plan"
            >
              <FileText size={14} />
              <span>{currentTier}</span>
            </button>

            <button onClick={() => setIsAddUnitOpen(true)} className="btn btn-primary">
              <Plus size={16} />
              <span>Add Room / Unit</span>
            </button>
          </div>
        </div>

        {/* 2. Unified Architectural Ledger Strip (Anti-AI Rule: Single hairline-divided ledger instead of 4 floating KPI cards) */}
        <div className="ledger-kpi-strip" style={{ marginBottom: '24px' }}>
          <div className="ledger-kpi-cell">
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Managed Inventory
            </div>
            <div className="mono-num" style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--brand-navy)', marginTop: '4px' }}>
              {totalUnits} <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>units</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              1 room or 1 apartment = 1 count
            </div>
          </div>

          <div className="ledger-kpi-cell">
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Public Vacancies
            </div>
            <div className="mono-num" style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--status-green)', marginTop: '4px' }}>
              {vacantUnits} <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>listed</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--status-green)', fontWeight: 600, marginTop: '4px' }}>
              Published on Renter Directory
            </div>
          </div>

          <div className="ledger-kpi-cell">
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Occupied Units & Rate
            </div>
            <div className="mono-num" style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
              {occupiedUnits} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--action-blue)' }}>({occupancyRate}%)</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Delisted from public search
            </div>
          </div>

          <div className="ledger-kpi-cell">
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Inquiries & Rent Due
            </div>
            <div className="mono-num" style={{ fontSize: '1.65rem', fontWeight: 700, color: pendingInquiriesCount > 0 ? 'var(--action-blue)' : 'var(--text-primary)', marginTop: '4px' }}>
              {pendingInquiriesCount} <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>pending</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: overdueRecordsCount > 0 ? '#C5221F' : 'var(--text-muted)', fontWeight: 600, marginTop: '4px' }}>
              {overdueRecordsCount} overdue rent record(s)
            </div>
          </div>
        </div>

        {/* 3. Asymmetric 2-Column Landlord SaaS Workspace (Left Sidebar + Main Content) */}
        <div className="saas-workspace-layout">
          {/* LEFT NAVIGATION SIDEBAR */}
          <aside>
            <nav className="saas-sidebar-nav" aria-label="Owner workspace navigation">
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: 'var(--brand-navy)',
                  color: '#FFFFFF',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Property Operations
              </div>

              <button
                onClick={() => setActiveTab('inventory')}
                className={`saas-nav-item ${activeTab === 'inventory' ? 'active' : ''}`}
              >
                <span>Units & Vacancy Sync</span>
                <span className="mono-num" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{totalUnits}</span>
              </button>

              <button
                onClick={() => setActiveTab('analytics')}
                className={`saas-nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <BarChart3 size={14} /> Analytics & Yield
                </span>
                <span className="mono-num" style={{ fontSize: '0.75rem', color: 'var(--action-blue)', fontWeight: 700 }}>
                  {portfolioAnalytics.collectionRate}%
                </span>
              </button>

              <button
                onClick={() => setActiveTab('tenants')}
                className={`saas-nav-item ${activeTab === 'tenants' ? 'active' : ''}`}
              >
                <span>Private Tenant Roster</span>
                <span className="mono-num" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{ownerTenants.length}</span>
              </button>

              <button
                onClick={() => setActiveTab('ledger')}
                className={`saas-nav-item ${activeTab === 'ledger' ? 'active' : ''}`}
              >
                <span>Rent Payment Ledger</span>
                {overdueRecordsCount > 0 && <span className="badge badge-danger mono-num">{overdueRecordsCount}</span>}
              </button>

              <button
                onClick={() => setActiveTab('inquiries')}
                className={`saas-nav-item ${activeTab === 'inquiries' ? 'active' : ''}`}
              >
                <span>Viewing Inquiries</span>
                {pendingInquiriesCount > 0 && <span className="badge badge-verified mono-num">{pendingInquiriesCount}</span>}
              </button>

              <button onClick={() => setActiveTab('shortStays')}
                className={`saas-nav-item ${activeTab === 'shortStays' ? 'active' : ''}`}>
                <span>Short Stays & Commission</span>
              </button>

              <button
                onClick={() => setActiveTab('outreach')}
                className={`saas-nav-item ${activeTab === 'outreach' ? 'active' : ''}`}
              >
                <span>QR Poster & FB Share</span>
              </button>

              <button
                onClick={() => setActiveTab('plans')}
                className={`saas-nav-item ${activeTab === 'plans' ? 'active' : ''}`}
              >
                <span>Subscription & Tiers</span>
              </button>
            </nav>

            {/* Quick B2B2C Sync Notice Box */}
            <div
              className="card"
              style={{
                marginTop: '16px',
                padding: '14px',
                backgroundColor: 'var(--action-blue-light)',
                borderColor: 'var(--action-blue-border)',
                fontSize: '0.78rem',
                color: 'var(--brand-navy)',
              }}
            >
              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <RefreshCw size={14} color="var(--action-blue)" />
                <span>Automated Public Sync</span>
              </div>
              <p style={{ lineHeight: 1.4, color: 'var(--text-secondary)' }}>
                Marking a unit <strong>Occupied</strong> hides it from the public directory immediately. Marking it <strong>Vacant</strong> publishes it with today's timestamp.
              </p>
            </div>
          </aside>

          {/* MAIN WORKSPACE CONTENT */}
          <div key={activeTab} className="anim-view-enter">
            {/* TAB 1: UNIT INVENTORY & VACANCY SYNC */}
            {activeTab === 'inventory' && (
              <div className="card" style={{ overflow: 'hidden' }}>
                <div
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                    backgroundColor: '#F8FAFC',
                  }}
                >
                  <div>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--brand-navy)', margin: 0 }}>
                      Room & Apartment Unit Inventory
                    </h2>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Toggle occupancy status here — changes sync immediately to the Customer Public Directory.
                    </p>
                  </div>

                  {/* Table Density Control (from SaaS UI Research) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Row density:</span>
                    <div style={{ display: 'flex', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-xs)', overflow: 'hidden' }}>
                      <button
                        onClick={() => setTableDensity('comfortable')}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: tableDensity === 'comfortable' ? 'var(--action-blue-light)' : '#FFFFFF',
                          color: tableDensity === 'comfortable' ? 'var(--action-blue)' : 'var(--text-muted)',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Rows3 size={13} /> Comfortable
                      </button>
                      <button
                        onClick={() => setTableDensity('compact')}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: tableDensity === 'compact' ? 'var(--action-blue-light)' : '#FFFFFF',
                          color: tableDensity === 'compact' ? 'var(--action-blue)' : 'var(--text-muted)',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          borderLeft: '1px solid var(--border-medium)',
                        }}
                      >
                        <Rows4 size={13} /> Compact
                      </button>
                    </div>
                  </div>
                </div>

                <div className="ops-toolbar">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {(['All', 'Vacant', 'Occupied'] as const).map((status) => {
                      const count =
                        status === 'All' ? totalUnits : status === 'Vacant' ? vacantUnits : occupiedUnits;
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setUnitStatusFilter(status)}
                          className={`btn btn-sm ${unitStatusFilter === status ? 'btn-primary' : 'btn-secondary'}`}
                        >
                          {status} (<span className="mono-num">{count}</span>)
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ position: 'relative', minWidth: '210px', flex: '0 1 260px' }}>
                    <Search
                      size={14}
                      color="var(--text-muted)"
                      style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
                    />
                    <input
                      type="text"
                      className="input"
                      value={unitSearchQuery}
                      onChange={(e) => setUnitSearchQuery(e.target.value)}
                      placeholder="Filter unit, property, or street..."
                      style={{ paddingLeft: '30px', paddingTop: '5px', paddingBottom: '5px', fontSize: '0.8rem' }}
                    />
                  </div>
                </div>

                <div style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-light)', backgroundColor: '#F8FAFC', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: cellPad, fontWeight: 700 }}>Property & Unit</th>
                        <th style={{ padding: cellPad, fontWeight: 700 }}>Monthly Rent</th>
                        <th style={{ padding: cellPad, fontWeight: 700 }}>Occupancy</th>
                        <th style={{ padding: cellPad, fontWeight: 700 }}>Public Directory State</th>
                        <th style={{ padding: cellPad, fontWeight: 700 }}>Last Updated</th>
                        <th style={{ padding: cellPad, fontWeight: 700, textAlign: 'right' }}>One-Click Sync Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOwnerUnits.map((unit) => {
                        const prop = properties.find((p) => p.id === unit.propertyId);
                        return (
                          <tr key={unit.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <td style={{ padding: cellPad }}>
                              <div style={{ fontWeight: 700, color: 'var(--brand-navy)' }}>{unit.unitLabel}</div>
                              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                {prop?.name} ({prop?.type})
                              </div>
                            </td>
                            <td style={{ padding: cellPad }}>
                              <div className="mono-num" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                ₱{unit.monthlyRent.toLocaleString()}/mo
                              </div>
                              <div className="mono-num" style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                Deposit: ₱{unit.deposit.toLocaleString()}
                              </div>
                            </td>
                            <td style={{ padding: cellPad }}>
                              <span className={`badge ${unit.status === 'Vacant' ? 'badge-vacant' : 'badge-occupied'}`}>
                                {unit.status}
                              </span>
                            </td>
                            <td style={{ padding: cellPad }}>
                              {unit.status === 'Vacant' && unit.published ? (
                                <span style={{ color: 'var(--status-green)', fontWeight: 600, fontSize: '0.8rem' }}>
                                  ● Published & Searchable
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                  ○ Delisted (Hidden from public)
                                </span>
                              )}
                            </td>
                            <td className="mono-num" style={{ padding: cellPad, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                              {unit.lastUpdated}
                            </td>
                            <td style={{ padding: cellPad, textAlign: 'right' }}>
                              {unit.status === 'Vacant' ? (
                                <button
                                  onClick={() => setOccupancyModalUnit(unit)}
                                  className="btn btn-secondary btn-sm"
                                >
                                  Mark as Occupied
                                </button>
                              ) : (
                                <button
                                  onClick={() => onToggleOccupancy(unit.id, 'Vacant')}
                                  className="btn btn-primary btn-sm"
                                >
                                  Mark Vacant & Publish
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredOwnerUnits.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No rooms match this status or keyword filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Summary Operational Footer */}
                <div
                  style={{
                    padding: '12px 20px',
                    borderTop: '1px solid var(--border-light)',
                    backgroundColor: '#F8FAFC',
                    display: 'flex',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px 20px',
                    fontSize: '0.78rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span>
                    Showing <strong className="mono-num">{filteredOwnerUnits.length}</strong> of{' '}
                    <strong className="mono-num">{totalUnits}</strong> units
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                    <span>
                      Gross Potential:{' '}
                      <strong className="mono-num" style={{ color: 'var(--brand-navy)' }}>
                        ₱{portfolioAnalytics.potentialMonthlyGross.toLocaleString()}/mo
                      </strong>
                    </span>
                    <span>
                      Avg Unit Rent:{' '}
                      <strong className="mono-num" style={{ color: 'var(--text-primary)' }}>
                        ₱{portfolioAnalytics.avgMonthlyRent.toLocaleString()}/mo
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: PORTFOLIO ANALYTICS & YIELD */}
            {activeTab === 'analytics' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Financial & Collection Health Card */}
                <div className="card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                    <div>
                      <h2 style={{ fontSize: '1.08rem', fontWeight: 800, color: 'var(--brand-navy)', margin: 0 }}>
                        Monthly Portfolio Cashflow & Collection Health
                      </h2>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Metrics from your managed units and manual monthly rent ledger. Monthly rent has no commission; short-stay fees are tracked separately.
                      </p>
                    </div>
                    <span className="badge badge-paid mono-num">Collection Rate: {portfolioAnalytics.collectionRate}%</span>
                  </div>

                  <div className="ledger-kpi-strip" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', marginBottom: '16px' }}>
                    <div className="ledger-kpi-cell" style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Gross Potential / Mo
                      </div>
                      <div className="mono-num" style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--brand-navy)', marginTop: '2px' }}>
                        ₱{portfolioAnalytics.potentialMonthlyGross.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>100% occupancy target</div>
                    </div>

                    <div className="ledger-kpi-cell" style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Collected This Cycle
                      </div>
                      <div className="mono-num" style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--status-green)', marginTop: '2px' }}>
                        ₱{portfolioAnalytics.totalPaid.toLocaleString()}
                      </div>
                      <div className="mono-num" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        of ₱{portfolioAnalytics.totalBilled.toLocaleString()} billed
                      </div>
                    </div>

                    <div className="ledger-kpi-cell" style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Pending / Overdue
                      </div>
                      <div className="mono-num" style={{ fontSize: '1.3rem', fontWeight: 700, color: portfolioAnalytics.totalOverdue > 0 ? '#C5221F' : '#B06000', marginTop: '2px' }}>
                        ₱{(portfolioAnalytics.totalDue + portfolioAnalytics.totalOverdue).toLocaleString()}
                      </div>
                      <div className="mono-num" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        ₱{portfolioAnalytics.totalOverdue.toLocaleString()} overdue
                      </div>
                    </div>

                    <div className="ledger-kpi-cell" style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Vacancy Revenue Gap
                      </div>
                      <div className="mono-num" style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--action-blue)', marginTop: '2px' }}>
                        ₱{portfolioAnalytics.vacantOpportunityGap.toLocaleString()}
                      </div>
                      <div className="mono-num" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        across {vacantUnits} vacant unit(s)
                      </div>
                    </div>
                  </div>

                  {/* Animated Segmented Collection Bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '6px', fontWeight: 600 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Billing Cycle Collection Distribution</span>
                      <span className="mono-num" style={{ color: 'var(--brand-navy)' }}>
                        Total Billed: ₱{portfolioAnalytics.totalBilled.toLocaleString()}
                      </span>
                    </div>
                    <div className="bar-track" style={{ height: '10px' }}>
                      {portfolioAnalytics.totalBilled > 0 && (
                        <>
                          <div
                            className="bar-fill"
                            style={{
                              width: `${(portfolioAnalytics.totalPaid / portfolioAnalytics.totalBilled) * 100}%`,
                              backgroundColor: 'var(--status-green)',
                            }}
                            title={`Paid: ₱${portfolioAnalytics.totalPaid.toLocaleString()}`}
                          />
                          <div
                            className="bar-fill"
                            style={{
                              width: `${(portfolioAnalytics.totalDue / portfolioAnalytics.totalBilled) * 100}%`,
                              backgroundColor: '#D97706',
                            }}
                            title={`Due: ₱${portfolioAnalytics.totalDue.toLocaleString()}`}
                          />
                          <div
                            className="bar-fill"
                            style={{
                              width: `${(portfolioAnalytics.totalOverdue / portfolioAnalytics.totalBilled) * 100}%`,
                              backgroundColor: '#C5221F',
                            }}
                            title={`Overdue: ₱${portfolioAnalytics.totalOverdue.toLocaleString()}`}
                          />
                        </>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '8px', fontSize: '0.75rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '9px', height: '9px', borderRadius: '2px', backgroundColor: 'var(--status-green)' }} />
                        Paid: <strong className="mono-num">₱{portfolioAnalytics.totalPaid.toLocaleString()}</strong>
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '9px', height: '9px', borderRadius: '2px', backgroundColor: '#D97706' }} />
                        Due: <strong className="mono-num">₱{portfolioAnalytics.totalDue.toLocaleString()}</strong>
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '9px', height: '9px', borderRadius: '2px', backgroundColor: '#C5221F' }} />
                        Overdue: <strong className="mono-num">₱{portfolioAnalytics.totalOverdue.toLocaleString()}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Property-by-Property Occupancy & Yield Table */}
                <div className="card" style={{ overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-light)', backgroundColor: '#F8FAFC' }}>
                    <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--brand-navy)', margin: 0 }}>
                      Property-by-Property Occupancy & Yield Performance
                    </h3>
                  </div>
                  <div style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-light)', backgroundColor: '#F8FAFC', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '11px 16px', fontWeight: 700 }}>Property & Area</th>
                          <th style={{ padding: '11px 16px', fontWeight: 700 }}>Occupancy Rate</th>
                          <th style={{ padding: '11px 16px', fontWeight: 700 }}>Avg Rent</th>
                          <th style={{ padding: '11px 16px', fontWeight: 700 }}>Potential / Mo</th>
                          <th style={{ padding: '11px 16px', fontWeight: 700 }}>Collected</th>
                          <th style={{ padding: '11px 16px', fontWeight: 700, textAlign: 'right' }}>Inquiries</th>
                        </tr>
                      </thead>
                      <tbody>
                        {portfolioAnalytics.byProperty.map((row) => (
                          <tr key={row.property.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ fontWeight: 700, color: 'var(--brand-navy)' }}>{row.property.name}</div>
                              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                {row.property.type} • {row.property.area}
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px', minWidth: '150px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '4px' }}>
                                <span className="mono-num" style={{ fontWeight: 700 }}>
                                  {row.occupiedCount}/{row.totalCount} occupied
                                </span>
                                <span className="mono-num" style={{ color: 'var(--action-blue)', fontWeight: 700 }}>
                                  {row.occupancyPct}%
                                </span>
                              </div>
                              <div className="bar-track">
                                <div
                                  className="bar-fill"
                                  style={{
                                    width: `${row.occupancyPct}%`,
                                    backgroundColor: row.occupancyPct >= 75 ? 'var(--status-green)' : 'var(--action-blue)',
                                  }}
                                />
                              </div>
                            </td>
                            <td className="mono-num" style={{ padding: '12px 16px', fontWeight: 600 }}>
                              ₱{row.avgRent.toLocaleString()}
                            </td>
                            <td className="mono-num" style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--brand-navy)' }}>
                              ₱{row.potentialRent.toLocaleString()}
                            </td>
                            <td className="mono-num" style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--status-green)' }}>
                              ₱{row.collectedCash.toLocaleString()}
                            </td>
                            <td className="mono-num" style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>
                              {row.inquiriesCount}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Inquiry Demand Funnel */}
                <div className="card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--brand-navy)', margin: 0 }}>
                      Renter Viewing Demand Funnel
                    </h3>
                    <span className="badge badge-info mono-num">
                      Approval Rate: {portfolioAnalytics.inquiryFunnel.approvalRatePct}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      {
                        label: 'Approved Viewings',
                        count: portfolioAnalytics.inquiryFunnel.approved,
                        color: 'var(--status-green)',
                      },
                      {
                        label: 'Pending Landlord Response',
                        count: portfolioAnalytics.inquiryFunnel.pending,
                        color: 'var(--action-blue)',
                      },
                      {
                        label: 'Declined Requests',
                        count: portfolioAnalytics.inquiryFunnel.declined,
                        color: '#C5221F',
                      },
                    ].map((step) => {
                      const pct =
                        portfolioAnalytics.inquiryFunnel.total > 0
                          ? Math.round((step.count / portfolioAnalytics.inquiryFunnel.total) * 100)
                          : 0;
                      return (
                        <div key={step.label}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{step.label}</span>
                            <span className="mono-num" style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>
                              {step.count} / {portfolioAnalytics.inquiryFunnel.total} ({pct}%)
                            </span>
                          </div>
                          <div className="bar-track">
                            <div className="bar-fill" style={{ width: `${pct}%`, backgroundColor: step.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: PRIVATE TENANT ROSTER */}
            {activeTab === 'tenants' && (
              <div>
                <div
                  className="card"
                  style={{
                    padding: '14px 18px',
                    marginBottom: '16px',
                    backgroundColor: 'var(--action-blue-light)',
                    borderColor: 'var(--action-blue-border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <Shield size={20} color="var(--brand-navy)" style={{ flexShrink: 0 }} />
                  <div style={{ fontSize: '0.82rem', color: 'var(--brand-navy)' }}>
                    <strong>Strict B2B Privacy Isolation:</strong> Tenant legal names, mobile numbers, move-in dates, and internal notes are stored exclusively in this private landlord database and are <strong>never exposed on public listings</strong>.
                  </div>
                </div>

                <div className="card" style={{ overflow: 'hidden' }}>
                  <div
                    style={{
                      padding: '16px 20px',
                      borderBottom: '1px solid var(--border-light)',
                      backgroundColor: '#F8FAFC',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--brand-navy)', margin: 0 }}>
                      Private Tenant Records (<span className="mono-num">{filteredOwnerTenants.length}</span>)
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ position: 'relative', minWidth: '190px' }}>
                        <Search
                          size={14}
                          color="var(--text-muted)"
                          style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
                        />
                        <input
                          type="text"
                          className="input"
                          value={tenantSearchQuery}
                          onChange={(e) => setTenantSearchQuery(e.target.value)}
                          placeholder="Search tenant or room..."
                          style={{ paddingLeft: '30px', paddingTop: '5px', paddingBottom: '5px', fontSize: '0.8rem' }}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() =>
                          downloadCsv(
                            `silidsmart-${owner.id}-tenants.csv`,
                            ['Tenant Name', 'Property', 'Unit', 'Contact', 'Move-In Date', 'Notes'],
                            filteredOwnerTenants.map((t) => {
                              const unit = units.find((u) => u.id === t.unitId);
                              const prop = properties.find((p) => p.id === unit?.propertyId);
                              return [t.name, prop?.name || '', unit?.unitLabel || '', t.contact, t.moveInDate, t.notes || ''];
                            })
                          )
                        }
                      >
                        <Download size={14} /> Export CSV
                      </button>
                    </div>
                  </div>

                  <div style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-light)', backgroundColor: '#F8FAFC', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: cellPad, fontWeight: 700 }}>Tenant Name</th>
                          <th style={{ padding: cellPad, fontWeight: 700 }}>Assigned Unit</th>
                          <th style={{ padding: cellPad, fontWeight: 700 }}>Private Contact</th>
                          <th style={{ padding: cellPad, fontWeight: 700 }}>Move-In Date</th>
                          <th style={{ padding: cellPad, fontWeight: 700 }}>Landlord Notes</th>
                          <th style={{ padding: cellPad, fontWeight: 700 }}>Visibility</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOwnerTenants.map((tenant) => {
                          const unit = units.find((u) => u.id === tenant.unitId);
                          const prop = properties.find((p) => p.id === unit?.propertyId);
                          return (
                            <tr key={tenant.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                              <td style={{ padding: cellPad, fontWeight: 700, color: 'var(--text-primary)' }}>
                                {tenant.name}
                              </td>
                              <td style={{ padding: cellPad }}>
                                <div style={{ fontWeight: 600, color: 'var(--brand-navy)' }}>{unit?.unitLabel}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{prop?.name}</div>
                              </td>
                              <td className="mono-num" style={{ padding: cellPad, color: 'var(--text-secondary)' }}>{tenant.contact}</td>
                              <td className="mono-num" style={{ padding: cellPad, color: 'var(--text-muted)' }}>{tenant.moveInDate}</td>
                              <td style={{ padding: cellPad, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                {tenant.notes || 'Standard lease agreement'}
                              </td>
                              <td style={{ padding: cellPad }}>
                                <span className="badge badge-verified">Private Only</span>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredOwnerTenants.length === 0 && (
                          <tr>
                            <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                              No private tenant records match "{tenantSearchQuery}".
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: RENT PAYMENT LEDGER */}
            {activeTab === 'ledger' && (
              <div className="card" style={{ overflow: 'hidden' }}>
                <div
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border-light)',
                    backgroundColor: '#F8FAFC',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--brand-navy)', margin: 0 }}>
                      Monthly Rent Payment Ledger
                    </h2>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Record monthly rent payment statuses manually. Monthly rent has no platform commission. SilidSmart does not collect or verify payments.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      downloadCsv(
                        `silidsmart-${owner.id}-rent-ledger.csv`,
                        ['Month', 'Tenant', 'Unit', 'Amount Due (PHP)', 'Payment Status', 'Recorded Date'],
                        filteredRentRecords.map((rec) => {
                          const unit = units.find((u) => u.id === rec.unitId);
                          return [rec.month, rec.tenantName, unit?.unitLabel || '', rec.amountDue, rec.paymentStatus, rec.recordedDate];
                        })
                      )
                    }
                  >
                    <Download size={14} /> Export Ledger CSV
                  </button>
                </div>

                {/* Operational Collection Summary + Status Filter */}
                <div className="ops-toolbar">
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {(['All', 'Paid', 'Due', 'Overdue'] as const).map((status) => {
                      const count =
                        status === 'All'
                          ? ownerRentRecords.length
                          : ownerRentRecords.filter((r) => r.paymentStatus === status).length;
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setRentStatusFilter(status)}
                          className={`btn btn-sm ${rentStatusFilter === status ? 'btn-primary' : 'btn-secondary'}`}
                        >
                          {status} (<span className="mono-num">{count}</span>)
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '14px', fontSize: '0.78rem' }}>
                    <span>
                      Collected:{' '}
                      <strong className="mono-num" style={{ color: 'var(--status-green)' }}>
                        ₱{portfolioAnalytics.totalPaid.toLocaleString()}
                      </strong>
                    </span>
                    <span>
                      Pending:{' '}
                      <strong className="mono-num" style={{ color: '#B06000' }}>
                        ₱{portfolioAnalytics.totalDue.toLocaleString()}
                      </strong>
                    </span>
                    <span>
                      Overdue:{' '}
                      <strong className="mono-num" style={{ color: '#C5221F' }}>
                        ₱{portfolioAnalytics.totalOverdue.toLocaleString()}
                      </strong>
                    </span>
                  </div>
                </div>

                <div style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-light)', backgroundColor: '#F8FAFC', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: cellPad, fontWeight: 700 }}>Billing Month</th>
                        <th style={{ padding: cellPad, fontWeight: 700 }}>Tenant & Unit</th>
                        <th style={{ padding: cellPad, fontWeight: 700 }}>Amount Due</th>
                        <th style={{ padding: cellPad, fontWeight: 700 }}>Status</th>
                        <th style={{ padding: cellPad, fontWeight: 700 }}>Recorded Date</th>
                        <th style={{ padding: cellPad, fontWeight: 700, textAlign: 'right' }}>Update Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRentRecords.map((rec) => {
                        const unit = units.find((u) => u.id === rec.unitId);
                        return (
                          <tr key={rec.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <td style={{ padding: cellPad, fontWeight: 700 }}>{rec.month}</td>
                            <td style={{ padding: cellPad }}>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{rec.tenantName}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{unit?.unitLabel}</div>
                            </td>
                            <td style={{ padding: cellPad, fontWeight: 800, color: 'var(--brand-navy)' }}>
                              ₱{rec.amountDue.toLocaleString()}
                            </td>
                            <td style={{ padding: cellPad }}>
                              <span
                                className={`badge ${
                                  rec.paymentStatus === 'Paid'
                                    ? 'badge-paid'
                                    : rec.paymentStatus === 'Due'
                                    ? 'badge-due'
                                    : 'badge-overdue'
                                }`}
                              >
                                {rec.paymentStatus}
                              </span>
                            </td>
                            <td style={{ padding: cellPad, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                              {rec.recordedDate}
                            </td>
                            <td style={{ padding: cellPad, textAlign: 'right' }}>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                {(['Paid', 'Due', 'Overdue'] as const).map((statusOption) => (
                                  <button
                                    key={statusOption}
                                    onClick={() => onUpdateRentStatus(rec.id, statusOption)}
                                    disabled={rec.paymentStatus === statusOption}
                                    className={`btn btn-sm ${
                                      rec.paymentStatus === statusOption ? 'btn-primary' : 'btn-secondary'
                                    }`}
                                    style={{
                                      padding: '4px 10px',
                                      fontSize: '0.74rem',
                                      opacity: rec.paymentStatus === statusOption ? 1 : 0.75,
                                    }}
                                  >
                                    {statusOption}
                                  </button>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: VIEWING INQUIRIES QUEUE */}
            {activeTab === 'inquiries' && (
              <div className="card" style={{ padding: '20px' }}>
                <div
                  style={{
                    marginBottom: '16px',
                    borderBottom: '1px solid var(--border-light)',
                    paddingBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--brand-navy)', margin: 0 }}>
                      Renter Viewing Inquiries & Schedule Requests
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Approve or decline viewing requests sent by prospective tenants from the public directory.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {(['All', 'Pending', 'Approved', 'Declined'] as const).map((status) => {
                      const count =
                        status === 'All'
                          ? ownerInquiries.length
                          : ownerInquiries.filter((i) => i.status === status).length;
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setInquiryStatusFilter(status)}
                          className={`btn btn-sm ${inquiryStatusFilter === status ? 'btn-primary' : 'btn-secondary'}`}
                        >
                          {status} (<span className="mono-num">{count}</span>)
                        </button>
                      );
                    })}
                  </div>
                </div>

                {filteredInquiries.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {filteredInquiries.map((inq) => (
                      <div
                        key={inq.id}
                        style={{
                          padding: '16px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-light)',
                          backgroundColor: '#FFFFFF',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '12px',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 800, color: 'var(--brand-navy)' }}>
                              {inq.propertyName} — {inq.unitLabel}
                            </span>
                            <span
                              className={`badge ${
                                inq.status === 'Approved'
                                  ? 'badge-paid'
                                  : inq.status === 'Declined'
                                  ? 'badge-overdue'
                                  : 'badge-due'
                              }`}
                            >
                              {inq.status}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                            Prospective Renter: {inq.renterName} • Contact: {inq.renterContact}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Requested Date: <strong>{inq.moveInDate}</strong> • "{inq.message}"
                          </div>
                        </div>

                         <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                           <button
                             onClick={() => onRespondInquiry(inq.id, 'Approved')}
                             className="btn btn-primary btn-sm"
                             disabled={inq.status === 'Approved'}
                           >
                             <Check size={14} /> Approve Viewing
                           </button>
                           {units.find((u) => u.id === inq.unitId)?.status === 'Vacant' && inq.status !== 'Declined' && (
                             <button
                               onClick={() => {
                                 if (inq.status !== 'Approved') {
                                   onRespondInquiry(inq.id, 'Approved');
                                 }
                                 onToggleOccupancy(inq.unitId, 'Occupied', {
                                   tenantName: inq.renterName,
                                   tenantContact: inq.renterContact,
                                   moveInDate: inq.moveInDate,
                                 });
                               }}
                               className="btn btn-secondary btn-sm"
                               style={{
                                 borderColor: 'var(--status-green)',
                                 color: 'var(--status-green)',
                                 fontWeight: 700,
                               }}
                               title="Approve inquiry, assign renter to private tenant roster, create rent ledger, and delist unit from public directory"
                             >
                               <UserCheck size={14} /> Move In & Mark Occupied
                             </button>
                           )}
                           <button
                             onClick={() => onRespondInquiry(inq.id, 'Declined')}
                             className="btn btn-danger btn-sm"
                             disabled={inq.status === 'Declined'}
                           >
                             <X size={14} /> Decline
                           </button>
                         </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No viewing inquiries received yet for your properties.
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: BMC OUTREACH CHANNELS — PROPERTY QR POSTER & FACEBOOK GROUP SHARE */}
            {activeTab === 'outreach' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="card" style={{ padding: '20px' }}>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--brand-navy)', margin: '0 0 4px 0' }}>
                    Property QR Posters & Community Group Outreach
                  </h2>
                  <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Per the SilidSmart Business Model Canvas, landlords reach renters through <strong>searchable mobile web directory</strong>,{' '}
                    <strong>Facebook and community groups</strong>, and <strong>owner referrals and property QR posters</strong>.
                  </p>
                </div>

                {copiedPostToast && (
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--status-vacant-bg)',
                      border: '1px solid var(--status-vacant-border)',
                      color: 'var(--status-vacant-text)',
                      fontWeight: 700,
                      fontSize: '0.84rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Check size={16} />
                    <span>{copiedPostToast}</span>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '20px' }}>
                  {ownerProperties.map((prop) => {
                    const propUnits = ownerUnits.filter((u) => u.propertyId === prop.id);
                    const propVacantUnits = propUnits.filter((u) => u.status === 'Vacant' && u.published);
                    const minRent =
                      propUnits.length > 0 ? Math.min(...propUnits.map((u) => u.monthlyRent)) : 3500;
                    const latestUpdate = propUnits[0]?.lastUpdated || newTenantDate;

                    const fbPostText = [
                      `🏠 [VACANCY ALERT] ${prop.name} (${prop.type}) — ${prop.area}`,
                      `📍 Address: ${prop.address}`,
                      `✅ Live Vacant Units: ${propVacantUnits.length} available (Starting at ₱${minRent.toLocaleString()}/mo)`,
                      ...propVacantUnits.map(
                        (u) => `   • ${u.unitLabel}: ₱${u.monthlyRent.toLocaleString()}/mo (Deposit: ₱${u.deposit.toLocaleString()}) — ${u.description}`
                      ),
                      `✨ Amenities: ${prop.amenities.join(' • ')}`,
                      `📋 House Rules: ${prop.rules.join(' | ')}`,
                      owner.idReviewStatus === 'ID reviewed'
                        ? `🛡️ Trust Status: Owner ID reviewed (This does not certify property safety)`
                        : `🛡️ Trust Status: ${owner.idReviewStatus}`,
                      `🕒 Availability last updated by owner: ${latestUpdate}`,
                      `📞 Direct Inquiry (₱0 Renter Fee): ${prop.contactMethod} | Browse on SilidSmart.ph`,
                    ].join('\n');

                    return (
                      <div key={prop.id} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Printable Property QR Poster Preview */}
                        <div
                          style={{
                            border: '2px solid var(--brand-navy)',
                            borderRadius: 'var(--radius-md)',
                            overflow: 'hidden',
                            backgroundColor: '#FFFFFF',
                          }}
                        >
                          <div
                            style={{
                              backgroundColor: 'var(--brand-navy)',
                              color: '#FFFFFF',
                              padding: '12px 16px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              borderBottom: '3px solid var(--booking-yellow)',
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--booking-yellow)', textTransform: 'uppercase' }}>
                                SilidSmart.ph Official Gate Poster
                              </div>
                              <div style={{ fontSize: '1.05rem', fontWeight: 800 }}>{prop.name}</div>
                            </div>
                            <span className="badge badge-vacant" style={{ fontSize: '0.75rem' }}>
                              {propVacantUnits.length} Vacant Now
                            </span>
                          </div>

                          <div style={{ padding: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                            {/* Deterministic SVG QR Code Representation */}
                            <div
                              style={{
                                width: '96px',
                                height: '96px',
                                padding: '6px',
                                border: '2px solid var(--brand-navy)',
                                borderRadius: '6px',
                                flexShrink: 0,
                                backgroundColor: '#FFFFFF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              title={`Scan to view ${prop.name} live vacancies`}
                            >
                              <QrCode size={76} color="var(--brand-navy)" />
                            </div>

                            <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ fontWeight: 800, color: 'var(--brand-navy)', fontSize: '0.92rem' }}>
                                Starting at ₱{minRent.toLocaleString()} / month
                              </div>
                              <div style={{ color: 'var(--text-secondary)' }}>{prop.address}</div>
                              {owner.idReviewStatus === 'ID reviewed' && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--status-green)', fontWeight: 700 }}>
                                  ✓ Owner ID reviewed{' '}
                                  <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                                    (This does not certify property safety)
                                  </span>
                                </div>
                              )}
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                Availability last updated by owner: {latestUpdate}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Facebook / Community Group Share Box */}
                        <div>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: '4px 10px',
                              marginBottom: '6px',
                            }}
                          >
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--brand-navy)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Share2 size={14} color="var(--action-blue)" style={{ flexShrink: 0 }} />
                              <span>FB & Community Group Vacancy Post</span>
                            </span>
                            <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>
                              Auto-synced
                            </span>
                          </div>
                          <textarea
                            readOnly
                            rows={6}
                            className="textarea"
                            value={fbPostText}
                            style={{ fontSize: '0.75rem', fontFamily: 'monospace', backgroundColor: '#F8FAFC' }}
                          />
                          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (navigator.clipboard) {
                                  navigator.clipboard.writeText(fbPostText).catch(() => {});
                                }
                                setCopiedPostToast(`Copied Facebook group announcement for ${prop.name}!`);
                                setTimeout(() => setCopiedPostToast(null), 4000);
                              }}
                              className="btn btn-primary btn-sm"
                              style={{ flex: 1 }}
                            >
                              <Copy size={14} /> Copy Post for Facebook Group
                            </button>
                            <button
                              type="button"
                              onClick={() => window.print()}
                              className="btn btn-secondary btn-sm"
                            >
                              <QrCode size={14} /> Print QR Poster
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 6: BMC SUBSCRIPTION PLAN & TIER BREAKDOWN */}
            {activeTab === 'shortStays' && (
              <ShortStayLedger units={ownerUnits} properties={ownerProperties} stays={shortStays}
                onRecord={onRecordShortStay} onUpdateStatus={onUpdateShortStay} />
            )}
            {activeTab === 'plans' && (
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ marginBottom: '20px' }}>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--brand-navy)', margin: '0 0 6px 0' }}>
                    Owner Monthly Subscription Tiers
                  </h2>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                    Free monthly access for 1–4 units; paid plans start at 5 units. All plans use a separate 5% owner-paid fee on completed short stays sourced through SilidSmart. Renters browse and inquire free.
                  </p>
                </div>

                {/* Counting Rule Highlight */}
                <div
                  style={{
                    padding: '14px 18px',
                    backgroundColor: 'var(--action-blue-light)',
                    border: '1px solid var(--action-blue-border)',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <Info size={18} color="var(--brand-navy)" />
                    <div style={{ fontSize: '0.85rem', color: 'var(--brand-navy)' }}>
                      <strong>Standard Counting Rule:</strong> 1 room or 1 apartment = 1 count. You currently manage{' '}
                      <strong>{totalUnits} units</strong>.
                    </div>
                  </div>
                  <span className="badge badge-paid" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
                    Active Plan: {currentTier}
                  </span>
                </div>

                <p style={{ marginBottom: '16px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Proposed prices. No subscription or commission is collected in this prototype. Short-stay rent excludes refundable deposits, taxes, and other charges; cancelled stays have no commission. Payment and stay completion are owner-reported.
                </p>
                {/* Capacity-based plans share the same core tools. */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  {[
                    {
                      title: 'Free', range: '1–4 rooms / units', price: '₱0', period: '/ month',
                      active: totalUnits <= 4,
                      features: ['Up to 4 rooms or units', 'Core owner management tools', '5% on SilidSmart short stays'],
                    },
                    {
                      title: 'Tier 1: Starter',
                      range: '5–10 rooms / units',
                      price: '₱99',
                      period: '/ month',
                      active: totalUnits >= 5 && totalUnits <= 10,
                      features: ['5 to 10 rooms or units', 'Core owner management tools', '5% on SilidSmart short stays'],
                    },
                    {
                      title: 'Tier 2: Growth',
                      range: '11–25 rooms / units',
                      price: '₱199',
                      period: '/ month',
                      active: totalUnits >= 11 && totalUnits <= 25,
                      features: ['11 to 25 rooms or units', 'Core owner management tools', '5% on SilidSmart short stays'],
                    },
                    {
                      title: 'Tier 3: Scale',
                      range: '26–50 rooms / units',
                      price: '₱349',
                      period: '/ month',
                      active: totalUnits >= 26 && totalUnits <= 50,
                      features: ['26 to 50 rooms or units', 'Core owner management tools', '5% on SilidSmart short stays'],
                    },
                    {
                      title: 'Enterprise Dorm',
                      range: '>50 rooms / units',
                      price: 'Custom Quote',
                      period: '',
                      active: totalUnits > 50,
                      features: ['More than 50 units', 'Monthly price by agreement', '5% on SilidSmart short stays'],
                    },
                  ].map((tier, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '18px',
                        borderRadius: 'var(--radius-md)',
                        border: tier.active ? '2px solid var(--action-blue)' : '1px solid var(--border-light)',
                        backgroundColor: tier.active ? 'var(--action-blue-light)' : '#FFFFFF',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--brand-navy)' }}>{tier.title}</span>
                          {tier.active && <span className="badge badge-verified">Current Tier</span>}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px' }}>{tier.range}</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>
                          {tier.price}
                          <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-muted)' }}>{tier.period}</span>
                        </div>
                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {tier.features.map((f, i) => (
                            <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Check size={13} color="var(--status-green)" /> {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Add Room / Unit */}
      {isAddUnitOpen && (
        <div className="modal-overlay" onClick={() => setIsAddUnitOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                Add New Room or Apartment Unit
              </h3>
              <button onClick={() => setIsAddUnitOpen(false)} style={{ color: '#FFFFFF' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddUnitSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px' }}>
                    Select Property
                  </label>
                  <select
                    className="select"
                    value={effectivePropertyId}
                    onChange={(e) => setSelectedPropertyId(e.target.value)}
                    disabled={ownerProperties.length === 0}
                  >
                    {ownerProperties.length === 0 ? (
                      <option value="">No registered property found</option>
                    ) : (
                      ownerProperties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.type})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px' }}>
                    Room / Unit Label (1 room or 1 apartment = 1 count) *
                  </label>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder="e.g. Room 105 or Unit 3B"
                    value={newUnitLabel}
                    onChange={(e) => setNewUnitLabel(e.target.value)}
                  />
                </div>

                <div className="responsive-2col">
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px' }}>
                      Monthly Rent (₱)
                    </label>
                    <input
                      type="number"
                      required
                      className="input"
                      value={newRent}
                      onChange={(e) => setNewRent(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px' }}>
                      Required Deposit (₱)
                    </label>
                    <input
                      type="number"
                      required
                      className="input"
                      value={newDeposit}
                      onChange={(e) => setNewDeposit(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px' }}>
                    Public Unit Description
                  </label>
                  <textarea
                    rows={3}
                    className="textarea"
                    placeholder="Describe fixtures, ventilation, bed setup, or sub-meter details..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setIsAddUnitOpen(false)} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Save & Publish Vacant Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Mark Unit as Occupied */}
      {occupancyModalUnit && (
        <div className="modal-overlay" onClick={() => setOccupancyModalUnit(null)}>
          <div className="modal-content" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                Mark {occupancyModalUnit.unitLabel} as Occupied
              </h3>
              <button onClick={() => setOccupancyModalUnit(null)} style={{ color: '#FFFFFF' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleConfirmOccupied}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Confirming occupancy will <strong>immediately delist {occupancyModalUnit.unitLabel}</strong> from public renter search results.
                </p>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px' }}>
                    Incoming Tenant Name (Private Record)
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Carlo Mendoza"
                    value={newTenantName}
                    onChange={(e) => setNewTenantName(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px' }}>
                    Tenant Contact (Private Record)
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. 0917-555-9000"
                    value={newTenantContact}
                    onChange={(e) => setNewTenantContact(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px' }}>
                    Move-in Date
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={newTenantDate}
                    onChange={(e) => setNewTenantDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setOccupancyModalUnit(null)} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Confirm Occupied & Delist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
