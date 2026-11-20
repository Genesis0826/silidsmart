import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import type { Property, Unit, Owner, Inquiry, AuthUser } from '../types';
import { 
  Search, MapPin, Check, ShieldCheck, Flag, 
  Send, X, User, SlidersHorizontal, LayoutList, LayoutGrid, ChevronRight, Building2, Scale
} from 'lucide-react';

import type { MapScope } from './RentalMap';
const RentalMap = lazy(() => import('./RentalMap').then((module) => ({ default: module.RentalMap })));

const FALLBACK_LISTING_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><rect width="800" height="500" fill="#E9EFF5"/><rect x="48" y="48" width="704" height="404" rx="8" fill="#F8FAFC" stroke="#C5D2E0" stroke-width="2"/><text x="400" y="242" text-anchor="middle" font-family="sans-serif" font-size="22" font-weight="600" fill="#00224F">SilidSmart Sample Property</text><text x="400" y="276" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#5B6978">Photo preview unavailable in offline environment</text></svg>'
  );

function OccupiedNotice({ unit }: { unit: Unit }) {
  if (unit.status !== 'Occupied') return null;
  return <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '8px 0' }}>
    <strong>Occupied — unavailable now.</strong><br />
    {unit.expectedAvailableFrom ? <>Expected available from <time dateTime={unit.expectedAvailableFrom} style={{ whiteSpace: 'nowrap' }}>{unit.expectedAvailableFrom}</time> (owner estimate).</> : 'Expected availability has not been provided.'}
    {' '}Availability must be confirmed by the owner.
  </p>;
}

interface CustomerViewProps {
  properties: Property[];
  units: Unit[];
  owners: Owner[];
  inquiries: Inquiry[];
  onSubmitInquiry: (inquiry: Omit<Inquiry, 'id' | 'status' | 'submittedAt'>) => Promise<boolean> | void;
  onSubmitReport: (
    unitId: string,
    propertyName: string,
    unitLabel: string,
    reason: string,
    details: string
  ) => Promise<boolean> | void;
  currentUser?: AuthUser | null;
  onOpenAuthModal?: () => void;
}

export const CustomerView = ({
  properties,
  units,
  owners,
  inquiries,
  onSubmitInquiry,
  onSubmitReport,
  currentUser,
  onOpenAuthModal,
}: CustomerViewProps) => {
  const [activeTab, setActiveTab] = useState<'listings' | 'myInquiries'>('listings');
  const [mapScope, setMapScope] = useState<MapScope>('ust');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sortBy, setSortBy] = useState<'recommended' | 'priceAsc' | 'priceDesc'>('recommended');
  const [availabilityMode, setAvailabilityMode] = useState<'available' | 'all'>('available');

  // Search & Faceted Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState<string>('All');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [maxPrice, setMaxPrice] = useState<number>(30000);
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(false);
  const [selectedAmenityFilter, setSelectedAmenityFilter] = useState<string>('All');

  // Modals
  const [selectedListing, setSelectedListing] = useState<{ property: Property; unit: Unit; owner: Owner } | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('Outdated availability');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSuccessBanner, setReportSuccessBanner] = useState<string | null>(null);

  // Side-by-Side Unit Comparison State (BMC Value Prop: "Renters compare price, rules, amenities, location, and owner identity check status")
  const [compareUnitIds, setCompareUnitIds] = useState<string[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  // Close topmost open modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isReportModalOpen) {
        setIsReportModalOpen(false);
      } else if (isCompareModalOpen) {
        setIsCompareModalOpen(false);
      } else if (selectedListing) {
        setSelectedListing(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isReportModalOpen, isCompareModalOpen, selectedListing]);

  const toggleCompareUnit = (unitId: string) => {
    setCompareUnitIds((prev) => {
      if (prev.includes(unitId)) {
        return prev.filter((id) => id !== unitId);
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), unitId];
      }
      return [...prev, unitId];
    });
  };

  // Inquiry Form state
  const [customInquiryName, setCustomInquiryName] = useState<string | null>(null);
  const [customInquiryContact, setCustomInquiryContact] = useState<string | null>(null);
  const inquiryName = customInquiryName !== null ? customInquiryName : (currentUser?.name || '');
  const inquiryContact = customInquiryContact !== null ? customInquiryContact : (currentUser?.phone || currentUser?.email || '');
  const setInquiryName = (val: string) => setCustomInquiryName(val);
  const setInquiryContact = (val: string) => setCustomInquiryContact(val);

  const [inquiryDate, setInquiryDate] = useState(() =>
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  );
  const [inquiryMessage, setInquiryMessage] = useState(
    'Good day! I would like to schedule an in-person viewing for this unit. Please let me know your available time.'
  );
  const [inquirySuccessBanner, setInquirySuccessBanner] = useState<string | null>(null);

  // Filter options
  const areaOptions = useMemo(() => {
    const areas = Array.from(new Set(properties.filter((p) => p.mapScope === mapScope).map((p) => p.area))) as string[];
    return ['All', ...areas];
  }, [properties, mapScope]);

  // Only public unit fields are loaded; tenant/ledger records never enter this view.
  const allPublishedJoined = useMemo(() => {
    return units
      .filter((unit) => unit.published)
      .map((unit) => {
        const property = properties.find((p) => p.id === unit.propertyId);
        const owner = owners.find((o) => o.id === property?.ownerId);
        return { unit, property, owner };
      })
      .filter((item): item is { unit: Unit; property: Property; owner: Owner } => Boolean(item.property && item.owner && item.property.mapScope === mapScope));
  }, [units, properties, owners, mapScope]);

  // Filtered & sorted listings
  const availableListings = useMemo(() => {
    const filtered = allPublishedJoined.filter((item) => {
      if (availabilityMode === 'available' && item.unit.status !== 'Vacant') return false;
      if (item.property.mapScope !== mapScope) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.property.name.toLowerCase().includes(q);
        const matchArea = item.property.area.toLowerCase().includes(q);
        const matchUnit = item.unit.unitLabel.toLowerCase().includes(q);
        const matchDesc = item.unit.description.toLowerCase().includes(q);
        const matchAmenity = item.property.amenities.some((a) => a.toLowerCase().includes(q));
        if (!matchName && !matchArea && !matchUnit && !matchDesc && !matchAmenity) return false;
      }

      if (selectedArea !== 'All' && item.property.area !== selectedArea) return false;
      if (selectedType !== 'All' && item.property.type !== selectedType) return false;
      if (item.unit.monthlyRent > maxPrice) return false;
      if (verifiedOnly && item.owner.idReviewStatus !== 'ID reviewed') return false;
      if (
        selectedAmenityFilter !== 'All' &&
        !item.property.amenities.some((a) => a.toLowerCase().includes(selectedAmenityFilter.toLowerCase()))
      ) {
        return false;
      }

      return true;
    });

    if (sortBy === 'priceAsc') {
      return [...filtered].sort((a, b) => a.unit.monthlyRent - b.unit.monthlyRent);
    }
    if (sortBy === 'priceDesc') {
      return [...filtered].sort((a, b) => b.unit.monthlyRent - a.unit.monthlyRent);
    }
    return filtered;
  }, [allPublishedJoined, mapScope, searchQuery, selectedArea, selectedType, maxPrice, verifiedOnly, selectedAmenityFilter, sortBy, availabilityMode]);

  const resetAllFilters = () => {
    setSearchQuery('');
    setSelectedArea('All');
    setSelectedType('All');
    setMaxPrice(30000);
    setVerifiedOnly(false);
    setSelectedAmenityFilter('All');
    setAvailabilityMode('available');
  };

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListing || selectedListing.unit.status !== 'Vacant') return;
    if (!inquiryName.trim() || !inquiryContact.trim()) return;

    const targetName = selectedListing.property.name;
    const targetUnit = selectedListing.unit.unitLabel;

    const result = await onSubmitInquiry({
      unitId: selectedListing.unit.id,
      propertyId: selectedListing.property.id,
      propertyName: targetName,
      unitLabel: targetUnit,
      renterName: inquiryName.trim(),
      renterContact: inquiryContact.trim(),
      moveInDate: inquiryDate,
      message: inquiryMessage.trim(),
    });

    if (result === false) return;

    setInquirySuccessBanner(
      `Viewing request sent for ${targetName} (${targetUnit}). Track status in "My Viewing Inquiries".`
    );
    setSelectedListing(null);
    setTimeout(() => setInquirySuccessBanner(null), 5000);
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListing) return;

    const targetName = selectedListing.property.name;
    const targetUnit = selectedListing.unit.unitLabel;

    const result = await onSubmitReport(
      selectedListing.unit.id,
      targetName,
      targetUnit,
      reportReason,
      reportDetails || 'Reported via public listing directory.'
    );

    if (result === false) return;

    setIsReportModalOpen(false);
    setSelectedListing(null);
    setReportDetails('');
    setReportSuccessBanner(
      `Report submitted for ${targetName} (${targetUnit}). Sent to Admin Moderation Queue.`
    );
    setTimeout(() => setReportSuccessBanner(null), 5000);
  };

  return (
    <div style={{ paddingBottom: '64px' }}>
      {/* 1. Editorial Navy Hero Banner */}
      <section
        style={{
          backgroundColor: 'var(--brand-navy)',
          color: '#FFFFFF',
          padding: '26px 0 44px 0',
          position: 'relative',
        }}
      >
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1
                className="editorial-heading"
                style={{ fontSize: '2.05rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '6px' }}
              >
                Find a place near UST or in Quezon City
              </h1>
              <p style={{ fontSize: '0.9rem', color: '#C9D8EE', maxWidth: '680px' }}>
                Explore rooms and apartments, compare monthly rent, and check house rules — <strong>100% free for renters</strong>.
              </p>
            </div>

            {/* Sub-mode Toggle: Search Directory vs My Inquiries (Clean text + tabular counter) */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              <button
                onClick={() => setActiveTab('listings')}
                style={{
                  padding: '7px 14px',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  backgroundColor: activeTab === 'listings' ? '#FFFFFF' : 'rgba(255,255,255,0.1)',
                  color: activeTab === 'listings' ? 'var(--brand-navy)' : '#FFFFFF',
                  border: '1px solid rgba(255,255,255,0.25)',
                }}
              >
                Rental Directory (<span className="mono-num">{availableListings.length}</span>)
              </button>

              <button
                onClick={() => currentUser?.role === 'renter' ? setActiveTab('myInquiries') : onOpenAuthModal?.()}
                style={{
                  padding: '7px 14px',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  backgroundColor: activeTab === 'myInquiries' ? 'var(--booking-yellow)' : 'rgba(255,255,255,0.1)',
                  color: activeTab === 'myInquiries' ? '#111827' : '#FFFFFF',
                  border: activeTab === 'myInquiries' ? '1px solid var(--booking-yellow)' : '1px solid rgba(255,255,255,0.25)',
                }}
              >
                Viewing Requests (<span className="mono-num">{inquiries.length}</span>)
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Signature Booking.com Yellow-Framed Overlapping Search Box */}
      <div className="container" style={{ marginTop: '-26px', marginBottom: '24px', position: 'relative', zIndex: 20 }}>
        <div className="booking-search-box">
          {/* Cell 1: Keyword / Amenity */}
          <div className="booking-search-cell">
            <Search size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <div style={{ width: '100%' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Property, Room or Amenity
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search a street, property, or amenity"
              />
            </div>
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ color: 'var(--text-muted)' }} title="Clear search">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Cell 2: District / Area */}
          <div className="booking-search-cell">
            <MapPin size={18} color="var(--action-blue)" style={{ flexShrink: 0 }} />
            <div style={{ width: '100%' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Area / District
              </div>
              <select value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)}>
                {areaOptions.map((area) => (
                  <option key={area} value={area}>
                    {area === 'All' ? 'All Districts' : area}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Cell 3: Rental Type */}
          <div className="booking-search-cell">
            <Building2 size={18} color="var(--action-blue)" style={{ flexShrink: 0 }} />
            <div style={{ width: '100%' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Property Type
              </div>
              <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
                <option value="All">All Property Types</option>
                <option value="Boarding house">Boarding house</option>
                <option value="Dorm">Dormitory</option>
                <option value="Apartment">Apartment</option>
                <option value="Condo">Condo</option>
              </select>
            </div>
          </div>

          {/* Cell 4: Max Monthly Budget */}
          <div className="booking-search-cell">
            <span style={{ fontWeight: 800, color: 'var(--brand-navy)', fontSize: '1rem', flexShrink: 0 }}>₱</span>
            <div style={{ width: '100%' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Max Monthly Rent
              </div>
              <select value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))}>
                <option value={30000}>Up to ₱30,000 / mo</option>
                <option value={20000}>Up to ₱20,000 / mo</option>
                <option value={15000}>Up to ₱15,000 / mo</option>
                <option value={8000}>Up to ₱8,000 / mo</option>
                <option value={5000}>Up to ₱5,000 / mo</option>
              </select>
            </div>
          </div>

          {/* Cell 5: Search CTA Button */}
          <button
            type="button"
            onClick={() => setActiveTab('listings')}
            className="btn btn-primary"
            style={{
              padding: '0 26px',
              fontSize: '0.95rem',
              fontWeight: 700,
              borderRadius: 'var(--radius-xs)',
            }}
          >
            Search
          </button>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="container">
        {/* Toast Feedback Banners */}
        {inquirySuccessBanner && (
          <div
            style={{
              backgroundColor: 'var(--status-vacant-bg)',
              color: 'var(--status-vacant-text)',
              border: '1px solid var(--status-vacant-border)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Check size={18} />
              <span>{inquirySuccessBanner}</span>
            </div>
            <button
              onClick={() => currentUser?.role === 'renter' ? setActiveTab('myInquiries') : onOpenAuthModal?.()}
              style={{ color: 'var(--action-blue)', fontWeight: 700, fontSize: '0.8125rem' }}
            >
              View Inquiries →
            </button>
          </div>
        )}

        {reportSuccessBanner && (
          <div
            style={{
              backgroundColor: 'var(--action-blue-light)',
              color: 'var(--brand-navy)',
              border: '1px solid var(--action-blue-border)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            <ShieldCheck size={18} />
            <span>{reportSuccessBanner}</span>
          </div>
        )}

        {activeTab === 'listings' && <>
          <div className="rental-scope-toolbar">
            <div><span className="scope-label">Explore an area</span><p>Choose an example search scope</p></div>
            <div className="scope-options" role="group" aria-label="Rental map scope">
              <button type="button" aria-pressed={mapScope === 'ust'} onClick={() => { setMapScope('ust'); setSelectedArea('All'); }}>Around UST</button>
              <button type="button" aria-pressed={mapScope === 'qc'} onClick={() => { setMapScope('qc'); setSelectedArea('All'); }}>Quezon City</button>
            </div>
          </div>
          <Suspense fallback={<p role="status">Loading rental map…</p>}><RentalMap scope={mapScope} listings={availableListings} onSelect={setSelectedListing} /></Suspense>
        </>}
        {activeTab === 'listings' ? (
          /* 3. Booking.com Asymmetric 2-Column Layout: Left Faceted Filters + Right Results List */
          <div key="listings-view" className="booking-results-layout anim-view-enter">
            {/* LEFT COLUMN: Faceted Filter Sidebar */}
            <aside className="card booking-filter-aside">
              <div
                style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--border-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#F8FAFC',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.92rem' }}>
                  <SlidersHorizontal size={15} color="var(--brand-navy)" />
                  <span>Filter by:</span>
                </div>
                <button
                  onClick={resetAllFilters}
                  style={{ fontSize: '0.76rem', color: 'var(--action-blue)', fontWeight: 600 }}
                >
                  Reset all
                </button>
              </div>

              {/* Filter Group 1: Budget Slider */}
              <div style={{ padding: '16px', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                  Your monthly budget
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--action-blue)', fontWeight: 700, marginBottom: '8px' }}>
                  ₱3,000 – ₱{maxPrice.toLocaleString()} / month
                </div>
                <input
                  type="range"
                  min={3000}
                  max={30000}
                  step={500}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--action-blue)', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  <span>₱3,000</span>
                  <span>₱15,000</span>
                  <span>₱30,000</span>
                </div>
              </div>

              {/* Filter Group 2: Owner Verification */}
              <div style={{ padding: '16px', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '10px', color: 'var(--text-primary)' }}>
                  Owner Identity Status
                </div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.82rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={verifiedOnly}
                    onChange={(e) => setVerifiedOnly(e.target.checked)}
                    style={{ marginTop: '3px', accentColor: 'var(--action-blue)' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Owner ID reviewed</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                      This does not certify property safety
                    </div>
                  </div>
                </label>
              </div>

              {/* Filter Group 3: Property Type Facets */}
              <div style={{ padding: '16px', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '10px', color: 'var(--text-primary)' }}>
                  Property Type
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(['All', 'Boarding house', 'Dorm', 'Apartment', 'Condo'] as const).map((type) => {
                    const count =
                      type === 'All'
                        ? allPublishedJoined.filter(i => availabilityMode === 'all' || i.unit.status === 'Vacant').length
                        : allPublishedJoined.filter(i => i.property.type === type && (availabilityMode === 'all' || i.unit.status === 'Vacant')).length;
                    return (
                      <label
                        key={type}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          color: selectedType === type ? 'var(--action-blue)' : 'var(--text-secondary)',
                          fontWeight: selectedType === type ? 700 : 400,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="radio"
                            name="propertyTypeFacet"
                            checked={selectedType === type}
                            onChange={() => setSelectedType(type)}
                            style={{ accentColor: 'var(--action-blue)' }}
                          />
                          <span>{type === 'All' ? 'All Types' : type}</span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{count}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Filter Group 4: Popular Room Features */}
              <div style={{ padding: '16px' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '10px', color: 'var(--text-primary)' }}>
                  Popular Room Features
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(['All', 'Wi-Fi', 'Study', 'Sub-meter', 'Kitchen'] as const).map((feat) => (
                    <label
                      key={feat}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        color: selectedAmenityFilter === feat ? 'var(--action-blue)' : 'var(--text-secondary)',
                        fontWeight: selectedAmenityFilter === feat ? 700 : 400,
                      }}
                    >
                      <input
                        type="radio"
                        name="amenityFacet"
                        checked={selectedAmenityFilter === feat}
                        onChange={() => setSelectedAmenityFilter(feat)}
                        style={{ accentColor: 'var(--action-blue)' }}
                      />
                      <span>{feat === 'All' ? 'Any feature' : `Includes ${feat}`}</span>
                    </label>
                  ))}
                </div>
              </div>
            </aside>

            {/* RIGHT COLUMN: Search Results Header + Property Cards */}
            <div>
              {/* Results Top Control Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                  marginBottom: '16px',
                  backgroundColor: '#FFFFFF',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-light)',
                }}
              >
                <div>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    {selectedArea === 'All' ? (mapScope === 'ust' ? 'Around UST' : 'Quezon City') : selectedArea}: {availableListings.length}{' '}
                    {availabilityMode === 'available' ? 'available' : 'published'} {availableListings.length === 1 ? 'unit' : 'units'}
                  </h2>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {availabilityMode === 'available' ? 'Published vacant units only. Choose All published units to view occupied listings.' : 'Published vacant and occupied units. Occupied units are unavailable now; dates are owner estimates.'}
                  </p>
                  <div role="group" aria-label="Unit availability" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                    {([{ value: 'available', label: 'Available now' }, { value: 'all', label: 'All published units' }] as const).map(mode => (
                      <button key={mode.value} type="button" aria-pressed={availabilityMode === mode.value}
                        className={`btn btn-sm ${availabilityMode === mode.value ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setAvailabilityMode(mode.value)}>{mode.label}</button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  {/* Sort Dropdown */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Sort by:</span>
                    <select
                      className="select"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'recommended' | 'priceAsc' | 'priceDesc')}
                      style={{ width: 'auto', padding: '5px 10px', fontSize: '0.8125rem', fontWeight: 600 }}
                    >
                      <option value="recommended">Top picks for renters</option>
                      <option value="priceAsc">Monthly rent (lowest first)</option>
                      <option value="priceDesc">Monthly rent (highest first)</option>
                    </select>
                  </div>

                  {/* Layout Toggle (Horizontal List vs Grid) */}
                  <div style={{ display: 'flex', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-xs)', overflow: 'hidden' }}>
                    <button
                      onClick={() => setViewMode('list')}
                      style={{
                        padding: '6px 10px',
                        backgroundColor: viewMode === 'list' ? 'var(--action-blue-light)' : '#FFFFFF',
                        color: viewMode === 'list' ? 'var(--action-blue)' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="Booking.com Horizontal List View"
                    >
                      <LayoutList size={16} />
                    </button>
                    <button
                      onClick={() => setViewMode('grid')}
                      style={{
                        padding: '6px 10px',
                        backgroundColor: viewMode === 'grid' ? 'var(--action-blue-light)' : '#FFFFFF',
                        color: viewMode === 'grid' ? 'var(--action-blue)' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        borderLeft: '1px solid var(--border-medium)',
                      }}
                      title="Compact Grid View"
                    >
                      <LayoutGrid size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Filter Chips Row (shown only when filtered) */}
              {(searchQuery.trim() ||
                selectedArea !== 'All' ||
                selectedType !== 'All' ||
                maxPrice < 30000 ||
                verifiedOnly ||
                selectedAmenityFilter !== 'All') && (
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Active filters:</span>
                  {searchQuery.trim() && (
                    <button type="button" className="filter-chip" onClick={() => setSearchQuery('')}>
                      <span>Search: "{searchQuery.trim()}"</span>
                      <X size={12} />
                    </button>
                  )}
                  {selectedArea !== 'All' && (
                    <button type="button" className="filter-chip" onClick={() => setSelectedArea('All')}>
                      <span>Area: {selectedArea}</span>
                      <X size={12} />
                    </button>
                  )}
                  {selectedType !== 'All' && (
                    <button type="button" className="filter-chip" onClick={() => setSelectedType('All')}>
                      <span>Type: {selectedType}</span>
                      <X size={12} />
                    </button>
                  )}
                  {maxPrice < 30000 && (
                    <button type="button" className="filter-chip" onClick={() => setMaxPrice(30000)}>
                      <span>Max: ₱{maxPrice.toLocaleString()}/mo</span>
                      <X size={12} />
                    </button>
                  )}
                  {verifiedOnly && (
                    <button type="button" className="filter-chip" onClick={() => setVerifiedOnly(false)}>
                      <span>Owner ID reviewed only</span>
                      <X size={12} />
                    </button>
                  )}
                  {selectedAmenityFilter !== 'All' && (
                    <button type="button" className="filter-chip" onClick={() => setSelectedAmenityFilter('All')}>
                      <span>Feature: {selectedAmenityFilter}</span>
                      <X size={12} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    style={{ fontSize: '0.75rem', color: 'var(--action-blue)', fontWeight: 700, marginLeft: '4px' }}
                  >
                    Clear all
                  </button>
                </div>
              )}

              {/* Property Results List / Grid */}
              {availableListings.length > 0 ? (
                <div
                  style={
                    viewMode === 'list'
                      ? { display: 'flex', flexDirection: 'column', gap: '16px' }
                      : { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '16px' }
                  }
                >
                  {availableListings.map(({ unit, property, owner }, idx) =>
                    viewMode === 'list' ? (
                      /* BOOKING.COM HORIZONTAL PROPERTY CARD */
                      <article
                        key={unit.id}
                        className="booking-property-card anim-stagger-item"
                        style={{ ['--stagger-i' as string]: Math.min(idx, 8) }}
                      >
                        {/* Column 1: Visual Thumbnail */}
                        <div
                          className="booking-card-thumb"
                          style={{
                            position: 'relative',
                            height: '195px',
                            borderRadius: 'var(--radius-sm)',
                            overflow: 'hidden',
                            backgroundColor: '#E2E8F0',
                            cursor: 'pointer',
                          }}
                          onClick={() => setSelectedListing({ property, unit, owner })}
                        >
                          <img
                            src={property.imageUrl || FALLBACK_LISTING_IMG}
                            alt={property.name}
                            onError={(e) => {
                              if (e.currentTarget.src !== FALLBACK_LISTING_IMG) {
                                e.currentTarget.src = FALLBACK_LISTING_IMG;
                              }
                            }}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <div style={{ position: 'absolute', top: '8px', left: '8px', display: 'flex', gap: '6px' }}>
                            <span className={`badge ${unit.status === 'Vacant' ? 'badge-vacant' : 'badge-occupied'}`} style={{ fontWeight: 700 }}>
                              {unit.status === 'Vacant' ? 'Vacant Now' : 'Occupied'}
                            </span>
                          </div>
                          <div
                            style={{
                              position: 'absolute',
                              bottom: '8px',
                              left: '8px',
                              backgroundColor: 'rgba(0, 34, 79, 0.85)',
                              color: '#FFFFFF',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                            }}
                          >
                            {property.type}
                          </div>
                        </div>

                        {/* Column 2: Middle Information & Architectural Unit Spec Box */}
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                              <h3
                                className="editorial-heading"
                                onClick={() => setSelectedListing({ property, unit, owner })}
                                style={{
                                  fontSize: '1.3rem',
                                  fontWeight: 600,
                                  color: 'var(--brand-navy)',
                                  cursor: 'pointer',
                                  margin: 0,
                                }}
                              >
                                {property.name}
                              </h3>
                              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                {property.area}
                              </span>
                            </div>

                            <div
                              style={{
                                fontSize: '0.78rem',
                                color: 'var(--text-secondary)',
                                marginTop: '2px',
                              }}
                            >
                              {property.address}
                            </div>

                            {/* Architectural Unit Specification Sub-Box */}
                            <div className="booking-unit-highlight">
                              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                                {unit.unitLabel}
                              </div>
                              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '3px 0 8px 0', lineHeight: 1.4 }}>
                                {unit.description}
                              </p>

                              {/* Clean Bordered Amenity Spec Tags (Zero AI Checkmark Clutter) */}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                {property.amenities.slice(0, 4).map((amenity, idx) => (
                                  <span
                                    key={idx}
                                    style={{
                                      fontSize: '0.7rem',
                                      fontWeight: 600,
                                      color: 'var(--text-secondary)',
                                      backgroundColor: '#FFFFFF',
                                      border: '1px solid var(--border-light)',
                                      padding: '2px 7px',
                                      borderRadius: '2px',
                                    }}
                                  >
                                    {amenity}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Mandatory Freshness Stamp */}
                          <div
                            style={{
                              marginTop: '10px',
                              paddingTop: '8px',
                              borderTop: '1px solid var(--border-light)',
                              fontSize: '0.73rem',
                              color: 'var(--text-muted)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '4px 12px',
                            }}
                          >
                            <span>
                              Availability last updated by owner:{' '}
                              <strong className="mono-num" style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                                {unit.lastUpdated}
                              </strong>
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--status-green)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              Direct Owner Listing (₱0 Fee)
                            </span>
                          </div>
                        </div>

                        {/* Column 3: Right Trust Score Badge + Pricing + Primary Blue CTA */}
                        <div className="booking-card-pricing-col">
                          {/* Top Right: Booking.com Review-Style Owner ID Verification Block */}
                          <div>
                            {owner.idReviewStatus === 'ID reviewed' ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                                <div>
                                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--brand-navy)' }}>
                                    Owner ID reviewed
                                  </div>
                                  <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', maxWidth: '145px', lineHeight: 1.25 }}>
                                    This does not certify property safety
                                  </div>
                                </div>
                                <div className="booking-trust-score" title="Government ID checked by admin">
                                  ID✓
                                </div>
                              </div>
                            ) : (
                              <span className="badge badge-pending">Pending ID review</span>
                            )}
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                              Host: {owner.displayName}
                            </div>
                          </div>

                          {/* Bottom Right: Price & CTA */}
                          <div style={{ width: '100%' }}>
                            <OccupiedNotice unit={unit} />
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              Stated monthly rate
                            </div>
                            <div className="mono-num" style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.15 }}>
                              ₱{unit.monthlyRent.toLocaleString()}
                            </div>
                            <div className="mono-num" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                              Deposit: ₱{unit.deposit.toLocaleString()} • ₱0 fee
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <button
                                onClick={() => setSelectedListing({ property, unit, owner })}
                                className="btn btn-primary"
                                style={{ width: '100%', padding: '9px 12px', fontSize: '0.84rem' }}
                              >
                                <span>{unit.status === 'Vacant' ? 'See availability' : 'View occupied unit'}</span>
                                <ChevronRight size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleCompareUnit(unit.id)}
                                className={`btn btn-sm ${compareUnitIds.includes(unit.id) ? 'btn-primary' : 'btn-secondary'}`}
                                style={{
                                  width: '100%',
                                  padding: '5px 10px',
                                  fontSize: '0.76rem',
                                  backgroundColor: compareUnitIds.includes(unit.id) ? 'var(--brand-navy)' : '#FFFFFF',
                                  color: compareUnitIds.includes(unit.id) ? '#FFFFFF' : 'var(--brand-navy)',
                                }}
                              >
                                <Scale size={13} />
                                <span>{compareUnitIds.includes(unit.id) ? '✓ In Compare' : '+ Compare Unit'}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    ) : (
                      /* COMPACT GRID CARD VIEW */
                      <article
                        key={unit.id}
                        className="card anim-stagger-item"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          overflow: 'hidden',
                          ['--stagger-i' as string]: Math.min(idx, 8),
                        }}
                      >
                        <div
                          style={{ position: 'relative', height: '165px', backgroundColor: '#E2E8F0', cursor: 'pointer' }}
                          onClick={() => setSelectedListing({ property, unit, owner })}
                        >
                          <img
                            src={property.imageUrl || FALLBACK_LISTING_IMG}
                            alt={property.name}
                            onError={(e) => {
                              if (e.currentTarget.src !== FALLBACK_LISTING_IMG) {
                                e.currentTarget.src = FALLBACK_LISTING_IMG;
                              }
                            }}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <div style={{ position: 'absolute', top: '8px', left: '8px', display: 'flex', gap: '6px' }}>
                            <span className={`badge ${unit.status === 'Vacant' ? 'badge-vacant' : 'badge-occupied'}`} style={{ fontWeight: 700 }}>
                              {unit.status === 'Vacant' ? 'Vacant Now' : 'Occupied'}
                            </span>
                            <span className="badge badge-info">{property.type}</span>
                          </div>
                        </div>

                        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1, gap: '10px' }}>
                          <OccupiedNotice unit={unit} />
                          <div>
                            <h3
                              className="editorial-heading"
                              onClick={() => setSelectedListing({ property, unit, owner })}
                              style={{
                                fontSize: '1.15rem',
                                fontWeight: 600,
                                color: 'var(--brand-navy)',
                                cursor: 'pointer',
                                margin: 0,
                              }}
                            >
                              {property.name}
                            </h3>
                            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              <MapPin size={13} color="var(--action-blue)" /> {property.area}
                            </p>
                          </div>

                          <div className="booking-unit-highlight" style={{ margin: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                              {unit.unitLabel}
                            </div>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginTop: '3px' }}>
                              {unit.description}
                            </p>
                          </div>

                          <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-light)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                              <div>
                                {owner.idReviewStatus === 'ID reviewed' ? (
                                  <>
                                    <span className="badge badge-verified">
                                      <ShieldCheck size={12} /> Owner ID reviewed
                                    </span>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                      This does not certify property safety
                                    </div>
                                  </>
                                ) : (
                                  <span className="badge badge-pending">Pending ID review</span>
                                )}
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div className="mono-num" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--brand-navy)' }}>
                                  ₱{unit.monthlyRent.toLocaleString()}<span style={{ fontSize: '0.72rem', fontWeight: 500 }}>/mo</span>
                                </div>
                              </div>
                            </div>

                            <div className="mono-num" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                              Availability last updated by owner: {unit.lastUpdated}
                            </div>

                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                onClick={() => setSelectedListing({ property, unit, owner })}
                                className="btn btn-primary"
                                style={{ flex: 1 }}
                              >
                                <span>See availability</span>
                                <ChevronRight size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleCompareUnit(unit.id)}
                                className="btn btn-secondary btn-sm"
                                style={{
                                  backgroundColor: compareUnitIds.includes(unit.id) ? 'var(--brand-navy)' : '#FFFFFF',
                                  color: compareUnitIds.includes(unit.id) ? '#FFFFFF' : 'var(--brand-navy)',
                                }}
                                title="Compare unit side-by-side"
                              >
                                <Scale size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    )
                  )}
                </div>
              ) : (
                <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>
                    No vacant rooms match your active filters
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Try expanding your monthly rent range or resetting your property filters.
                  </p>
                  <button onClick={resetAllFilters} className="btn btn-primary">
                    Reset all filters
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* MY VIEWING INQUIRIES TAB */
          <div key="inquiries-view" className="card anim-view-enter" style={{ padding: '24px' }}>
            <div style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-light)', paddingBottom: '14px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--brand-navy)' }}>
                My Viewing Inquiries & Reservations Status
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                When a property owner approves or declines your viewing schedule in the Owner Portal, the status updates here in real time.
              </p>
            </div>

            {inquiries.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {inquiries.map((inq) => (
                  <div
                    key={inq.id}
                    style={{
                      padding: '16px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-light)',
                      borderLeft:
                        inq.status === 'Approved'
                          ? '4px solid var(--status-green)'
                          : inq.status === 'Declined'
                          ? '4px solid #C5221F'
                          : '4px solid var(--action-blue)',
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
                        <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--brand-navy)' }}>
                          {inq.propertyName} — {inq.unitLabel}
                        </span>
                        <span
                          className={`badge ${
                            inq.status === 'Approved'
                              ? 'badge-vacant'
                              : inq.status === 'Declined'
                              ? 'badge-danger'
                              : 'badge-pending'
                          }`}
                        >
                          {inq.status}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Target Move-in / Viewing Date: <strong>{inq.moveInDate}</strong> • Submitted: {inq.submittedAt}
                      </p>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        "{inq.message}"
                      </p>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Renter Contact:</div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {inq.renterName} ({inq.renterContact})
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                You have not submitted any viewing inquiries yet.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Listing Detail & Viewing Inquiry Modal */}
      {selectedListing && (
        <div className="modal-overlay" onClick={() => setSelectedListing(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span className={`badge ${selectedListing.unit.status === 'Vacant' ? 'badge-vacant' : 'badge-occupied'}`}>{selectedListing.unit.status}</span>
                  <span
                    className="badge"
                    style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#FFFFFF', border: 'none' }}
                  >
                    {selectedListing.property.type}
                  </span>
                </div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                  {selectedListing.property.name} — {selectedListing.unit.unitLabel}
                </h2>
              </div>
              <button
                onClick={() => setSelectedListing(null)}
                style={{ color: '#FFFFFF', padding: '4px' }}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ height: '210px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', backgroundColor: '#E2E8F0' }}>
                <img
                  src={selectedListing.property.imageUrl || FALLBACK_LISTING_IMG}
                  alt={selectedListing.property.name}
                  onError={(e) => {
                    if (e.currentTarget.src !== FALLBACK_LISTING_IMG) {
                      e.currentTarget.src = FALLBACK_LISTING_IMG;
                    }
                  }}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>

              {/* Price & Deposit Banner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'var(--action-blue-light)',
                  padding: '14px 18px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--action-blue-border)',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--brand-navy)', textTransform: 'uppercase' }}>
                    Stated Monthly Rent
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--brand-navy)' }}>
                    ₱{selectedListing.unit.monthlyRent.toLocaleString()}{' '}
                    <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>/ month</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Security Deposit
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    ₱{selectedListing.unit.deposit.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Location & Description */}
              <div className="responsive-2col" style={{ gap: '16px' }}>
                <div>
                  <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Address & District
                  </h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                    <MapPin size={15} color="var(--action-blue)" /> {selectedListing.property.address}
                  </p>
                </div>
                <div>
                  <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Direct Landlord Contact
                  </h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                    {selectedListing.property.contactMethod}
                  </p>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Room / Unit Details
                </h4>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {selectedListing.unit.description}
                </p>
              </div>

              {/* Amenities & House Rules */}
              <div className="responsive-2col" style={{ gap: '16px' }}>
                <div>
                  <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Included Amenities
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {selectedListing.property.amenities.map((item, i) => (
                      <div key={i} style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Check size={14} color="var(--status-green)" /> {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    House Rules
                  </h4>
                  <ul style={{ paddingLeft: '18px', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {selectedListing.property.rules.map((rule, i) => (
                      <li key={i}>{rule}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Mandatory Owner Verification & Freshness Card */}
              <div
                style={{
                  padding: '12px 16px',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: '#F8FAFC',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Managed by <strong>{selectedListing.owner.displayName}</strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Availability last updated by owner: <strong>{selectedListing.unit.lastUpdated}</strong>
                  </div>
                </div>

                {selectedListing.owner.idReviewStatus === 'ID reviewed' ? (
                  <div style={{ textAlign: 'right' }}>
                    <span className="badge badge-verified">
                      <ShieldCheck size={13} /> Owner ID reviewed
                    </span>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      This does not certify property safety
                    </div>
                  </div>
                ) : (
                  <span className="badge badge-pending">Pending ID review</span>
                )}
              </div>

              {/* Viewing requests remain limited to currently vacant, published units. */}
              {selectedListing.unit.status === 'Vacant' ? (
              <form onSubmit={handleInquirySubmit} style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--brand-navy)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Send size={16} color="var(--action-blue)" /> Schedule a Viewing / Send Inquiry (₱0 Fee)
                </h3>

                {currentUser ? (
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--action-blue-light)',
                      borderRadius: 'var(--radius-xs)',
                      border: '1px solid var(--action-blue-border)',
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.8rem',
                      color: 'var(--brand-navy)',
                    }}
                  >
                    <User size={14} color="var(--action-blue)" />
                    <span>
                      Inquiring as signed-in user: <strong>{currentUser.name}</strong>
                    </span>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#F8FAFC',
                      borderRadius: 'var(--radius-xs)',
                      border: '1px solid var(--border-light)',
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <span>Browsing as Guest (100% Free).</span>
                    {onOpenAuthModal && (
                      <button
                        type="button"
                        onClick={onOpenAuthModal}
                        style={{ color: 'var(--action-blue)', fontWeight: 700, fontSize: '0.8rem' }}
                      >
                        Sign in to auto-fill details →
                      </button>
                    )}
                  </div>
                )}

                <div className="responsive-2col" style={{ marginBottom: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Your Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      className="input"
                      value={inquiryName}
                      onChange={(e) => setInquiryName(e.target.value)}
                      placeholder="e.g. Juan Dela Cruz"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Mobile / Viber / Email *
                    </label>
                    <input
                      type="text"
                      required
                      className="input"
                      value={inquiryContact}
                      onChange={(e) => setInquiryContact(e.target.value)}
                      placeholder="e.g. 0917-000-0000"
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Preferred Viewing / Move-in Date
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={inquiryDate}
                    onChange={(e) => setInquiryDate(e.target.value)}
                  />
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Message to Landlord
                  </label>
                  <textarea
                    rows={2}
                    className="textarea"
                    value={inquiryMessage}
                    onChange={(e) => setInquiryMessage(e.target.value)}
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                    paddingTop: '12px',
                    paddingBottom: '6px',
                    borderTop: '1px solid var(--border-light)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setIsReportModalOpen(true)}
                    style={{ color: '#C5221F', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Flag size={13} /> Flag outdated or inaccurate listing
                  </button>

                  <button type="submit" className="btn btn-primary">
                    <Send size={15} /> Submit Viewing Request
                  </button>
                </div>
              </form>
              ) : (
                <section aria-label="Occupied unit availability" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                  <OccupiedNotice unit={selectedListing.unit} />
                  <p>Viewing requests are unavailable while this unit is occupied. An expected date does not reserve the unit.</p>
                  <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: '12px' }} onClick={() => setIsReportModalOpen(true)}>Flag inaccurate listing</button>
                </section>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Report Listing Discrepancy Modal */}
      {isReportModalOpen && selectedListing && (
        <div className="modal-overlay" onClick={() => setIsReportModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ backgroundColor: '#991B1B' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                <Flag size={17} /> Report Listing Discrepancy
              </h3>
              <button onClick={() => setIsReportModalOpen(false)} style={{ color: '#FFFFFF' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleReportSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Flagging <strong>{selectedListing.property.name} ({selectedListing.unit.unitLabel})</strong> for platform administrator review.
                </p>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px' }}>
                    Discrepancy Reason:
                  </label>
                  <select
                    className="select"
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                  >
                    <option value="Outdated availability">Unit is already occupied / outdated vacancy</option>
                    <option value="Price discrepancy">Stated rent does not match owner quote</option>
                    <option value="Inaccurate rules or amenities">House rules or amenities inaccurate</option>
                    <option value="Unreachable owner">Owner contact unreachable</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px' }}>
                    Observation Details:
                  </label>
                  <textarea
                    rows={3}
                    required
                    className="textarea"
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Provide brief details for the moderation team..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setIsReportModalOpen(false)} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger btn-sm">
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Booking.com Prussian Blue Comparison Dock */}
      {compareUnitIds.length > 0 && !isCompareModalOpen && !selectedListing && !isReportModalOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 80,
            backgroundColor: 'var(--brand-navy)',
            color: '#FFFFFF',
            padding: '12px 20px',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 12px 32px rgba(0, 34, 79, 0.35)',
            border: '2px solid var(--booking-yellow)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
            maxWidth: '92vw',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Scale size={18} color="var(--booking-yellow)" />
            <span style={{ fontWeight: 800, fontSize: '0.88rem' }}>
              Compare Units ({compareUnitIds.length}/3):
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {compareUnitIds.map((id) => {
              const item = allPublishedJoined.find((x) => x.unit.id === id);
              if (!item) return null;
              return (
                <div
                  key={id}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.14)',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '0.78rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>
                    {item.property.name.split(' ')[0]} • <strong>{item.unit.unitLabel}</strong> (₱{item.unit.monthlyRent.toLocaleString()})
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleCompareUnit(id)}
                    style={{ color: '#FFFFFF', opacity: 0.8 }}
                    title="Remove from comparison"
                  >
                    <X size={13} />
                  </button>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setCompareUnitIds([])}
              style={{ color: '#D9E6F7', fontSize: '0.78rem', fontWeight: 600 }}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setIsCompareModalOpen(true)}
              className="btn btn-sm"
              style={{
                backgroundColor: 'var(--booking-yellow)',
                color: '#1A1A1A',
                fontWeight: 800,
                border: 'none',
                padding: '7px 14px',
              }}
            >
              Compare Side-by-Side →
            </button>
          </div>
        </div>
      )}

      {/* Side-by-Side Room & Apartment Comparison Modal (BMC Value Proposition #2) */}
      {isCompareModalOpen && compareUnitIds.length > 0 && (
        <div className="modal-overlay" onClick={() => setIsCompareModalOpen(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: '940px', width: '95%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Scale size={18} color="var(--booking-yellow)" />
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                    Side-by-Side Room & Apartment Comparison
                  </h2>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#D9E6F7', margin: '2px 0 0 0' }}>
                  Compare stated monthly rent, house rules, amenities, district location, and owner identity check status.
                </p>
              </div>
              <button onClick={() => setIsCompareModalOpen(false)} style={{ color: '#FFFFFF' }}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-light)' }}>
                    <th style={{ padding: '12px', width: '180px', color: 'var(--text-muted)', fontWeight: 700 }}>
                      Comparison Dimension
                    </th>
                    {compareUnitIds.map((id) => {
                      const item = allPublishedJoined.find((x) => x.unit.id === id);
                      if (!item) return null;
                      return (
                        <th key={id} style={{ padding: '12px', verticalAlign: 'top', minWidth: '220px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                            <div>
                              <span className="badge badge-info" style={{ marginBottom: '4px' }}>
                                {item.property.type}
                              </span>
                              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--brand-navy)' }}>
                                {item.property.name}
                              </div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--action-blue)' }}>
                                {item.unit.unitLabel}
                              </div>
                            </div>
                            <button
                              onClick={() => toggleCompareUnit(id)}
                              style={{ color: 'var(--text-muted)' }}
                              title="Remove unit"
                            >
                              <X size={15} />
                            </button>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {/* Row 1: Monthly Rent & Deposit */}
                  <tr style={{ borderBottom: '1px solid var(--border-light)', backgroundColor: 'var(--action-blue-light)' }}>
                    <td style={{ padding: '12px', fontWeight: 700, color: 'var(--brand-navy)' }}>Stated Monthly Rent</td>
                    {compareUnitIds.map((id) => {
                      const item = allPublishedJoined.find((x) => x.unit.id === id);
                      if (!item) return null;
                      return (
                        <td key={id} style={{ padding: '12px' }}>
                          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--brand-navy)' }}>
                            ₱{item.unit.monthlyRent.toLocaleString()}{' '}
                            <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>/ mo</span>
                          </div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                            Deposit: ₱{item.unit.deposit.toLocaleString()} • Renter Fee: ₱0
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Row 2: Owner Identity Check Status */}
                  <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Owner Identity Check
                    </td>
                    {compareUnitIds.map((id) => {
                      const item = allPublishedJoined.find((x) => x.unit.id === id);
                      if (!item) return null;
                      return (
                        <td key={id} style={{ padding: '12px' }}>
                          {item.owner.idReviewStatus === 'ID reviewed' ? (
                            <div>
                              <span className="badge badge-verified">
                                <ShieldCheck size={12} /> Owner ID reviewed
                              </span>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                                This does not certify property safety
                              </div>
                            </div>
                          ) : (
                            <span className="badge badge-pending">{item.owner.idReviewStatus}</span>
                          )}
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Host: {item.owner.displayName}
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Row 3: District & Address */}
                  <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Location & District</td>
                    {compareUnitIds.map((id) => {
                      const item = allPublishedJoined.find((x) => x.unit.id === id);
                      if (!item) return null;
                      return (
                        <td key={id} style={{ padding: '12px' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.property.area}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{item.property.address}</div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Row 4: Amenities */}
                  <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Included Amenities</td>
                    {compareUnitIds.map((id) => {
                      const item = allPublishedJoined.find((x) => x.unit.id === id);
                      if (!item) return null;
                      return (
                        <td key={id} style={{ padding: '12px', verticalAlign: 'top' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {item.property.amenities.map((am, i) => (
                              <span key={i} style={{ fontSize: '0.78rem', color: 'var(--status-green)', fontWeight: 600 }}>
                                ✓ {am}
                              </span>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Row 5: House Rules */}
                  <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>House Rules</td>
                    {compareUnitIds.map((id) => {
                      const item = allPublishedJoined.find((x) => x.unit.id === id);
                      if (!item) return null;
                      return (
                        <td key={id} style={{ padding: '12px', verticalAlign: 'top' }}>
                          <ul style={{ paddingLeft: '16px', margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                            {item.property.rules.map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Row 6: Freshness & Action */}
                  <tr>
                    <td style={{ padding: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Availability & Action</td>
                    {compareUnitIds.map((id) => {
                      const item = allPublishedJoined.find((x) => x.unit.id === id);
                      if (!item) return null;
                      return (
                        <td key={id} style={{ padding: '12px' }}>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                            Availability last updated by owner: <strong>{item.unit.lastUpdated}</strong>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setIsCompareModalOpen(false);
                              setSelectedListing(item);
                            }}
                            className="btn btn-primary btn-sm"
                            style={{ width: '100%' }}
                          >
                            Schedule Viewing →
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
