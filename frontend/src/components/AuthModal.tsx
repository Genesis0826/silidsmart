import { useState, useEffect } from 'react';
import type { AuthUser, UserRole } from '../types';
import { 
  X, LogIn, UserPlus, Home, User, Mail, 
  Lock, CheckCircle, Eye, EyeOff, KeyRound, Building
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: AuthUser) => void;
  onOnboardOwner?: (payload: {
    ownerId: string;
    displayName: string;
    contactMethod: string;
    idDocumentName: string;
    propertyName: string;
    initialUnitsCount: number;
  }) => Promise<boolean> | void;
  initialRole?: UserRole;
  demoUsers: AuthUser[];
}

export const AuthModal = ({
  isOpen,
  onClose,
  onLogin,
  onOnboardOwner,
  initialRole = 'renter',
  demoUsers,
}: AuthModalProps) => {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  
  // Login form state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Signup form state
  const [selectedSignupRole, setSelectedSignupRole] = useState<UserRole | null>(null);
  const signupRole: UserRole = selectedSignupRole ?? (initialRole === 'owner' ? 'owner' : 'renter');
  const setSignupRole = (role: UserRole) => setSelectedSignupRole(role);

  const [fullName, setFullName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [propertyName, setPropertyName] = useState('');
  const [managedUnits, setManagedUnits] = useState<number>(6);
  const [governmentIdType, setGovernmentIdType] = useState('Government Postal ID');

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // BMC Tier calculation
  const getBmcPlan = (unitCount: number) => {
    if (unitCount <= 0) return { name: 'Invalid Count', price: 0 };
    if (unitCount <= 10) return { name: 'Basic Tier (1–10 Units)', price: 99 };
    if (unitCount <= 25) return { name: 'Standard Tier (11–25 Units)', price: 199 };
    if (unitCount <= 50) return { name: 'Growth Tier (26–50 Units)', price: 349 };
    return { name: 'Enterprise Tier (>50 Units)', price: 'Custom Quote' };
  };

  const currentPlan = getBmcPlan(managedUnits);

  const handleQuickLogin = (user: AuthUser) => {
    onLogin(user);
    onClose();
  };

  const handleFormLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!identifier.trim()) {
      setLoginError('Please enter your email or mobile phone number.');
      return;
    }

    // Check if matches demo user email or phone
    const foundUser = demoUsers.find(
      (u) => 
        u.email.toLowerCase() === identifier.trim().toLowerCase() ||
        (u.phone && u.phone.replace(/[^0-9]/g, '').includes(identifier.trim().replace(/[^0-9]/g, '')))
    );

    if (foundUser) {
      onLogin(foundUser);
      onClose();
    } else {
      // Mock successful login with entered credentials
      const roleFromInput = identifier.includes('admin') ? 'admin' : identifier.includes('owner') ? 'owner' : 'renter';
      const newUser: AuthUser = {
        id: `user-${Date.now()}`,
        name: identifier.split('@')[0] || 'User',
        email: identifier.includes('@') ? identifier : `${identifier}@sample.ph`,
        phone: identifier.startsWith('09') ? identifier : undefined,
        role: roleFromInput,
        avatarInitials: identifier.substring(0, 2).toUpperCase(),
        ownerId: roleFromInput === 'owner' ? 'owner-1' : undefined,
        managedUnitsCount: roleFromInput === 'owner' ? 6 : undefined,
      };
      onLogin(newUser);
      onClose();
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    setLoginError(null);

    const initials = fullName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    const newOwnerId = `owner-custom-${Date.now()}`;
    const createdUser: AuthUser = {
      id: `user-${Date.now()}`,
      name: fullName.trim(),
      email: signupEmail || `${fullName.toLowerCase().replace(/\s+/g, '.')}@sample.ph`,
      phone: signupPhone || '0917-000-0000',
      role: signupRole,
      avatarInitials: initials || 'US',
      ownerId: signupRole === 'owner' ? newOwnerId : undefined,
      managedUnitsCount: signupRole === 'owner' ? managedUnits : undefined,
    };

    if (signupRole === 'owner' && onOnboardOwner) {
      const ok = await onOnboardOwner({
        ownerId: newOwnerId,
        displayName: fullName.trim(),
        contactMethod: `${signupPhone || '0917-000-0000'} / ${signupEmail || 'owner@silidsmart.ph'}`,
        idDocumentName: `${governmentIdType.replace(/\s+/g, '_')}.pdf`,
        propertyName: propertyName.trim() || `${fullName.trim()} Residences`,
        initialUnitsCount: managedUnits,
      });
      if (ok === false) {
        setLoginError('Unable to complete owner onboarding in SQLite backend. Verify server connection and retry.');
        return;
      }
    }

    onLogin(createdUser);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '6px', backgroundColor: 'var(--action-blue)', border: '1px solid var(--booking-yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF' }}>
              <Building size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#FFFFFF' }}>SilidSmart.ph Account</h3>
              <p style={{ margin: 0, fontSize: '0.76rem', color: '#D9E6F7' }}>
                B2B2C Rental Management & Room Directory Portal
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: '#FFFFFF', padding: '4px' }} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>

        {/* Tab Selection */}
        <div style={{ padding: '0 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: '16px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('login')}
            style={{
              padding: '12px 4px',
              fontSize: '0.875rem',
              fontWeight: activeTab === 'login' ? 700 : 500,
              color: activeTab === 'login' ? 'var(--primary-teal)' : 'var(--text-muted)',
              borderBottom: activeTab === 'login' ? '2px solid var(--primary-teal)' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <LogIn size={16} />
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('signup')}
            style={{
              padding: '12px 4px',
              fontSize: '0.875rem',
              fontWeight: activeTab === 'signup' ? 700 : 500,
              color: activeTab === 'signup' ? 'var(--primary-teal)' : 'var(--text-muted)',
              borderBottom: activeTab === 'signup' ? '2px solid var(--primary-teal)' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <UserPlus size={16} />
            Create Account
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ padding: '24px' }}>
          {activeTab === 'login' ? (
            <div>
              {/* Quick Demo Logins Section */}
              <div style={{ marginBottom: '20px', padding: '14px', backgroundColor: '#F8FAFC', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--brand-navy)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  <KeyRound size={14} color="var(--action-blue)" />
                  <span>Quick Verification Accounts (1-Click Sign In)</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {demoUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleQuickLogin(u)}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        textAlign: 'left',
                        fontSize: '0.8125rem',
                        transition: 'border-color 0.15s, background-color 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{u.name}</span>
                        <span className={`badge ${u.role === 'owner' ? 'badge-info' : u.role === 'admin' ? 'badge-neutral' : 'badge-vacant'}`}>
                          {u.role === 'owner' ? `Landlord (${u.managedUnitsCount || 6} Units)` : u.role === 'admin' ? 'Admin' : 'Renter (Free)'}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--primary-teal)', fontWeight: 600 }}>
                        Select →
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0', gap: '12px' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-light)' }}></div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Or enter credentials
                </span>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-light)' }}></div>
              </div>

              {loginError && (
                <div style={{ padding: '8px 12px', backgroundColor: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 'var(--radius-sm)', color: '#991B1B', fontSize: '0.8125rem', marginBottom: '14px' }}>
                  {loginError}
                </div>
              )}

              {/* Credentials Form */}
              <form onSubmit={handleFormLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Email or Mobile Number
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="input"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="e.g. maria.santos@silidsmart.ph or 0917-555-0192"
                      style={{ paddingLeft: '36px' }}
                    />
                    <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Password
                    </label>
                    <span style={{ fontSize: '0.75rem', color: 'var(--primary-teal)', cursor: 'pointer' }}>
                      Forgot?
                    </span>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{ paddingLeft: '36px', paddingRight: '36px' }}
                    />
                    <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: '10px', top: '10px', color: 'var(--text-muted)' }}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: '6px', width: '100%' }}>
                  <LogIn size={16} />
                  Sign In to SilidSmart
                </button>
              </form>
            </div>
          ) : (
            <div>
              {/* Account Role Selector */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  I want to join SilidSmart as:
                </label>
                <div className="responsive-2col" style={{ gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setSignupRole('renter')}
                    style={{
                      padding: '12px',
                      borderRadius: 'var(--radius-md)',
                      border: signupRole === 'renter' ? '2px solid var(--primary-teal)' : '1px solid var(--border-medium)',
                      backgroundColor: signupRole === 'renter' ? 'var(--primary-teal-light)' : '#FFFFFF',
                      textAlign: 'left',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                      <User size={16} color="var(--primary-teal)" />
                      Renter / Tenant
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      100% Free search, viewing requests, zero booking fees
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSignupRole('owner')}
                    style={{
                      padding: '12px',
                      borderRadius: 'var(--radius-md)',
                      border: signupRole === 'owner' ? '2px solid var(--primary-teal)' : '1px solid var(--border-medium)',
                      backgroundColor: signupRole === 'owner' ? 'var(--primary-teal-light)' : '#FFFFFF',
                      textAlign: 'left',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                      <Home size={16} color="var(--primary-teal)" />
                      Property Owner
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Manage inventory, tenants & rent from ₱99/mo
                    </span>
                  </button>
                </div>
              </div>

              {/* Registration Form */}
              <form onSubmit={handleSignupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Full Legal Name
                  </label>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder="e.g. Maria Clara Santos"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>

                <div className="responsive-2col" style={{ gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      className="input"
                      placeholder="you@email.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Mobile Number
                    </label>
                    <input
                      type="tel"
                      required
                      className="input"
                      placeholder="0917-000-0000"
                      value={signupPhone}
                      onChange={(e) => setSignupPhone(e.target.value)}
                    />
                  </div>
                </div>

                {signupRole === 'owner' && (
                  <div style={{ padding: '14px', backgroundColor: '#F8FAFC', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Primary Property Name
                      </label>
                      <input
                        type="text"
                        required
                        className="input"
                        placeholder="e.g. Green Valley Dormitory"
                        value={propertyName}
                        onChange={(e) => setPropertyName(e.target.value)}
                      />
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          Total Rooms or Apartment Units Managed
                        </label>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          1 room/apt = 1 count
                        </span>
                      </div>
                      <input
                        type="number"
                        min="1"
                        max="200"
                        className="input"
                        value={managedUnits}
                        onChange={(e) => setManagedUnits(Math.max(1, parseInt(e.target.value) || 1))}
                      />
                    </div>

                    {/* Dynamic BMC Plan Box */}
                    <div style={{ padding: '10px 12px', backgroundColor: 'var(--primary-teal-light)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--primary-teal-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--primary-teal)' }}>
                            Estimated Subscription
                          </span>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                            {currentPlan.name}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary-teal)' }}>
                            {typeof currentPlan.price === 'number' ? `₱${currentPlan.price}` : currentPlan.price}
                          </span>
                          {typeof currentPlan.price === 'number' && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}> / mo</span>
                          )}
                        </div>
                      </div>
                      <p style={{ margin: '6px 0 0 0', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        "The monthly fee depends on the total rooms or apartment units managed." Renters browse 100% free with 0% booking commission.
                      </p>
                    </div>

                    {/* Government ID Verification Requirement */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Government ID for Trust Review
                      </label>
                      <select
                        className="select"
                        value={governmentIdType}
                        onChange={(e) => setGovernmentIdType(e.target.value)}
                      >
                        <option value="Government Postal ID">Government Postal ID</option>
                        <option value="Unified Multi-Purpose ID (UMID)">Unified Multi-Purpose ID (UMID)</option>
                        <option value="Philippine National ID (PhilSys)">Philippine National ID (PhilSys)</option>
                        <option value="Driver's License">Driver's License</option>
                        <option value="Philippine Passport">Philippine Passport</option>
                      </select>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                        Platform Notice: ID review deters fake accounts. Public listings state: <em>"Owner ID reviewed" — "This does not certify property safety"</em>.
                      </span>
                    </div>
                  </div>
                )}

                {loginError && (
                  <div style={{ padding: '8px 12px', backgroundColor: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 'var(--radius-sm)', color: '#991B1B', fontSize: '0.8125rem' }}>
                    {loginError}
                  </div>
                )}

                <button type="submit" className="btn btn-primary" style={{ marginTop: '8px', width: '100%' }}>
                  <CheckCircle size={16} />
                  {signupRole === 'owner' ? 'Register Property & Onboard' : 'Create Free Renter Account'}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ justifyContent: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Concept prototype - sample properties only • SilidSmart Stage 1 Architecture
          </span>
        </div>
      </div>
    </div>
  );
};
