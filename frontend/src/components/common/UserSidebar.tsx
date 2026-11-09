import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Mail, Shield, User, X } from 'lucide-react';
import { getMe, type MeResponse } from '../../services/api';

interface UserSidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function UserSidebar({ open, onClose }: UserSidebarProps) {
  const navigate = useNavigate();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState('');

  // Load profile once when the drawer first opens.
  useEffect(() => {
    if (!open || me) return;
    getMe()
      .then(setMe)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to load profile.');
      });
  }, [open, me]);

  // Close on Escape for a nice keyboard experience.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function handleLogout() {
    localStorage.removeItem('servicefinder_access_token');
    localStorage.removeItem('servicefinder_refresh_token');
    navigate('/login', { replace: true });
  }

  const initial = me?.email?.[0]?.toUpperCase() ?? '?';
  const isAdmin = me?.role === 'admin';

  return (
    <>
      {open && <div className="user-sidebar-backdrop" onClick={onClose} />}
      <aside
        className={`user-sidebar ${open ? 'open' : ''}`}
        aria-hidden={!open}
      >
        <button className="user-sidebar-close" onClick={onClose} aria-label="Close menu">
          <X size={18} />
        </button>

        <div className="user-profile">
          <div className="user-avatar" aria-hidden="true">{initial}</div>
          {me ? (
            <>
              <h3 className="user-name">{me.email?.split('@')[0]}</h3>
              <p className="user-email">
                <Mail size={13} /> {me.email}
              </p>
              <span className={`user-role ${isAdmin ? 'admin' : 'user'}`}>
                {isAdmin ? <Shield size={12} /> : <User size={12} />}
                {me.role}
              </span>
            </>
          ) : error ? (
            <p className="user-error">{error}</p>
          ) : (
            <p className="user-loading">Loading profile…</p>
          )}
        </div>

        <div className="user-sidebar-actions">
          <button className="user-logout" onClick={handleLogout}>
            <LogOut size={16} /> Log out
          </button>
          {isAdmin && (
            <button
              className="user-admin-link"
              onClick={() => navigate('/admin/dashboard')}
            >
              Admin dashboard →
            </button>
          )}
        </div>
      </aside>
    </>
  );
}