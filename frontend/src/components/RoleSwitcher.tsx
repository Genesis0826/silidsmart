import { useState } from 'react';
import type { UserRole, AuthUser } from '../types';
import { ChevronDown } from 'lucide-react';

interface RoleSwitcherProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onResetData: () => void;
  currentUser: AuthUser | null;
  onOpenAuthModal: (role?: UserRole) => void;
  onLogout: () => void;
}

export const RoleSwitcher = ({ currentRole, onRoleChange, onResetData, currentUser, onOpenAuthModal, onLogout }: RoleSwitcherProps) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const workspaceLabel = currentUser?.role === 'owner' ? 'My properties' : 'Administration';
  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <a href="/" className="site-wordmark editorial-heading">SilidSmart<span>.ph</span></a>
        <nav aria-label="Main navigation" className="role-switcher-nav">
          <button className="role-switcher-tab" aria-current={currentRole === 'renter' ? 'page' : undefined} onClick={() => onRoleChange('renter')}>Find a rental</button>
          {currentUser && currentUser.role !== 'renter' && (
            <button className="role-switcher-tab" aria-current={currentRole === currentUser.role ? 'page' : undefined} onClick={() => onRoleChange(currentUser.role)}>{workspaceLabel}</button>
          )}
        </nav>
        <div className="role-switcher-actions">
          {currentUser ? (
            <div className="account-control">
              <button className="account-trigger" aria-expanded={userMenuOpen} onClick={() => setUserMenuOpen(!userMenuOpen)}>{currentUser.name} <ChevronDown size={14} /></button>
              {userMenuOpen && <div className="account-menu">
                <div><strong>{currentUser.name}</strong><small>{currentUser.role === 'owner' ? 'Landlord' : currentUser.role === 'admin' ? 'Administrator' : 'Renter'}</small></div>
                {currentUser.role === 'admin' && <button onClick={() => { setUserMenuOpen(false); onResetData(); }}>Reset example data</button>}
                <button onClick={() => { setUserMenuOpen(false); onLogout(); }}>Sign out</button>
              </div>}
            </div>
          ) : <>
            <button className="header-property-button" onClick={() => onOpenAuthModal('owner')}>List a property</button>
            <button className="header-signin-button" onClick={() => onOpenAuthModal('renter')}>Sign in</button>
          </>}
        </div>
      </div>
    </header>
  );
};
