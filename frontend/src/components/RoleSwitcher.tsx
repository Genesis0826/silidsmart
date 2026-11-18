import { useState } from 'react';
import type { UserRole, AuthUser } from '../types';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface RoleSwitcherProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onResetData: () => void;
  currentUser: AuthUser | null;
  onOpenAuthModal: (role?: UserRole) => void;
  onLogout: () => void;
}

export const RoleSwitcher = ({
  currentRole,
  onRoleChange,
  onResetData,
  currentUser,
  onOpenAuthModal,
  onLogout,
}: RoleSwitcherProps) => {
  const [showGuide, setShowGuide] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <header
      style={{
        backgroundColor: 'var(--brand-navy)',
        color: '#FFFFFF',
        position: 'sticky',
        top: 0,
        zIndex: 900,
        borderBottom: '1px solid var(--brand-navy-dark)',
      }}
    >
      {/* 1. Top Utility & Mandatory Prototype Notice Strip */}
      <div
        style={{
          backgroundColor: 'var(--brand-navy-dark)',
          color: '#C9D8EE',
          padding: '5px 0',
          fontSize: '0.73rem',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
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
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px 10px' }}>
            <span
              className="mono-num"
              style={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                color: '#FFFFFF',
                padding: '1px 6px',
                borderRadius: '2px',
                fontSize: '0.68rem',
                fontWeight: 600,
              }}
            >
              NOTICE
            </span>
            <strong style={{ color: '#FFFFFF', fontWeight: 600 }}>
              Concept prototype - sample properties only
            </strong>
            <span className="role-switcher-tagline" style={{ color: 'rgba(255,255,255,0.25)' }}>·</span>
            <span className="role-switcher-tagline">UST Sampaloc Dorm, Condo, Apartment & Boarding House Index</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px 16px' }}>
            <span className="mono-num" style={{ fontWeight: 600, color: '#FFFFFF', fontSize: '0.72rem' }}>
              PHP (₱)
            </span>
            <button
              onClick={() => setShowGuide(!showGuide)}
              style={{
                color: 'var(--booking-yellow)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.73rem',
                fontWeight: 600,
              }}
            >
              <span>{showGuide ? 'Close Guide' : 'How It Works'}</span>
              {showGuide ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            <button
              onClick={onResetData}
              style={{
                color: '#C9D8EE',
                fontSize: '0.73rem',
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
              }}
              title="Reset SQLite database to initial seed state"
            >
              Reset Seed Data
            </button>
          </div>
        </div>
      </div>

      {/* 2. Collapsible System Architecture & Workflow Drawer */}
      {showGuide && (
        <div
          className="anim-view-enter"
          style={{
            backgroundColor: '#002252',
            color: '#E2E8F0',
            padding: '14px 0',
            fontSize: '0.8rem',
            borderBottom: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <div className="container">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: '12px',
              }}
            >
              <div style={{ padding: '8px 12px', borderLeft: '2px solid var(--booking-yellow)' }}>
                <div className="mono-num" style={{ fontSize: '0.68rem', color: 'var(--booking-yellow)', fontWeight: 700 }}>
                  01 / RENTER DIRECTORY
                </div>
                <div style={{ fontWeight: 700, color: '#FFFFFF', margin: '2px 0' }}>Free Public Search</div>
                <div style={{ fontSize: '0.74rem', color: '#C9D8EE', lineHeight: 1.4 }}>
                  Filter vacant rooms by monthly budget, district, and ID status, or compare up to 3 units side-by-side.
                </div>
              </div>

              <div style={{ padding: '8px 12px', borderLeft: '2px solid var(--booking-yellow)' }}>
                <div className="mono-num" style={{ fontSize: '0.68rem', color: 'var(--booking-yellow)', fontWeight: 700 }}>
                  02 / VACANCY SYNC
                </div>
                <div style={{ fontWeight: 700, color: '#FFFFFF', margin: '2px 0' }}>Single-Entry Inventory</div>
                <div style={{ fontSize: '0.74rem', color: '#C9D8EE', lineHeight: 1.4 }}>
                  Marking a room Occupied in the Landlord view delists it from public search and creates a private rent record.
                </div>
              </div>

              <div style={{ padding: '8px 12px', borderLeft: '2px solid var(--booking-yellow)' }}>
                <div className="mono-num" style={{ fontSize: '0.68rem', color: 'var(--booking-yellow)', fontWeight: 700 }}>
                  03 / PRIVACY WALL
                </div>
                <div style={{ fontWeight: 700, color: '#FFFFFF', margin: '2px 0' }}>Isolated Tenant Ledger</div>
                <div style={{ fontSize: '0.74rem', color: '#C9D8EE', lineHeight: 1.4 }}>
                  Tenant names, contact numbers, and rent balances stay strictly inside the private landlord workspace.
                </div>
              </div>

              <div style={{ padding: '8px 12px', borderLeft: '2px solid var(--booking-yellow)' }}>
                <div className="mono-num" style={{ fontSize: '0.68rem', color: 'var(--booking-yellow)', fontWeight: 700 }}>
                  04 / GOVERNANCE
                </div>
                <div style={{ fontWeight: 700, color: '#FFFFFF', margin: '2px 0' }}>ID Review & Moderation</div>
                <div style={{ fontSize: '0.74rem', color: '#C9D8EE', lineHeight: 1.4 }}>
                  Review landlord government IDs, resolve renter discrepancy flags, and audit public payload redaction.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Masthead (Editorial Typography + Clean Text-Only Segmented Switcher) */}
      <div
        className="container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '62px',
          paddingTop: '10px',
          paddingBottom: '10px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* Left: Editorial Wordmark */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
          <span
            className="editorial-heading"
            style={{
              fontSize: '1.55rem',
              fontWeight: 600,
              color: '#FFFFFF',
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            SilidSmart<span className="mono-num" style={{ fontSize: '0.95rem', color: 'var(--booking-yellow)', fontWeight: 600 }}>.ph</span>
          </span>
          <span
            className="role-switcher-tagline"
            style={{
              fontSize: '0.75rem',
              color: '#B8D4FE',
              borderLeft: '1px solid rgba(255,255,255,0.2)',
              paddingLeft: '12px',
            }}
          >
            Rental Inventory & Public Room Index
          </span>
        </div>

        {/* Center: Clean Text-First Segmented Workspace Switcher (Zero Icon Soup) */}
        <nav aria-label="Workspace perspective" className="role-switcher-nav">
          {(
            [
              { id: 'renter', label: 'Renter Directory' },
              { id: 'owner', label: 'Landlord Workspace' },
              { id: 'admin', label: 'Platform Governance' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => onRoleChange(tab.id)}
              className="role-switcher-tab"
              style={{
                fontWeight: currentRole === tab.id ? 700 : 500,
                color: currentRole === tab.id ? 'var(--brand-navy)' : '#D9E6F7',
                backgroundColor: currentRole === tab.id ? '#FFFFFF' : 'transparent',
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Right: Session Account Control */}
        <div className="role-switcher-actions">
          {currentUser ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid rgba(255, 255, 255, 0.28)',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#FFFFFF',
                }}
              >
                <span
                  className="mono-num"
                  style={{
                    padding: '2px 6px',
                    borderRadius: '2px',
                    backgroundColor: 'var(--booking-yellow)',
                    color: '#111827',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                  }}
                >
                  {currentUser.avatarInitials}
                </span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#FFFFFF' }}>
                  {currentUser.name}
                </span>
                <ChevronDown size={13} color="#C9D8EE" />
              </button>

              {userMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 6px)',
                    width: '220px',
                    backgroundColor: '#FFFFFF',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-medium)',
                    boxShadow: 'var(--shadow-dropdown)',
                    padding: '6px 0',
                    zIndex: 1000,
                  }}
                >
                  <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Active Session</div>
                    <div className="mono-num" style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--brand-navy)', wordBreak: 'break-all' }}>
                      {currentUser.email}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      onOpenAuthModal();
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      fontSize: '0.8rem',
                      color: 'var(--text-primary)',
                      textAlign: 'left',
                      fontWeight: 500,
                    }}
                  >
                    Switch Account / Role
                  </button>

                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      onLogout();
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      fontSize: '0.8rem',
                      color: '#B42318',
                      textAlign: 'left',
                      fontWeight: 600,
                      borderTop: '1px solid var(--border-light)',
                    }}
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => onOpenAuthModal('owner')}
                style={{
                  color: '#FFFFFF',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid rgba(255,255,255,0.35)',
                }}
              >
                List a property
              </button>
              <button
                onClick={() => onOpenAuthModal('renter')}
                style={{
                  backgroundColor: '#FFFFFF',
                  color: 'var(--brand-navy)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-xs)',
                }}
              >
                Sign in
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
