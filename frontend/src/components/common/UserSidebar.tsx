import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Mail, Shield, User, X, PlusCircle, Loader2 } from 'lucide-react';
import { getMe, getMySuggestions, type MeResponse, type UserSuggestion } from '../../services/api';

interface UserSidebarProps {
  open: boolean;
  onClose: () => void;
  onSuggest: () => void;
}

export default function UserSidebar({ open, onClose, onSuggest }: UserSidebarProps) {
  const navigate = useNavigate();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Fetch profile and suggestions when the drawer opens
  useEffect(() => {
    if (!open) return;

    // Fetch profile if we don't have it yet
    if (!me) {
      getMe()
        .then(setMe)
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Unable to load profile.');
        });
    }

    // Fetch user's suggestions
    setLoadingSuggestions(true);
    getMySuggestions()
      .then(setSuggestions)
      .catch(console.error)
      .finally(() => setLoadingSuggestions(false));
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
      <aside className={`user-sidebar ${open ? 'open' : ''}`}>
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

        {/* User's Suggestions List */}
        <div className="user-suggestions">
          <h4 className="user-section-title">My Suggestions</h4>
          {loadingSuggestions ? (
            <div style={{ textAlign: 'center', padding: '10px' }}><Loader2 className="spin" size={16} /></div>
          ) : suggestions.length === 0 ? (
            <p className="user-empty-text">You haven't suggested any services yet.</p>
          ) : (
            <ul className="user-suggestion-list">
              {suggestions.map(s => (
                <li key={s.id} className="user-suggestion-item">
                  <span className="suggestion-name">{s.name}</span>
                  <span className={`suggestion-status ${s.status}`}>
                    {s.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="user-sidebar-actions">
          <button
            className="user-admin-link"
            onClick={() => {
              onClose();
              onSuggest();
            }}
          >
            <PlusCircle size={16} /> Suggest a Service
          </button>

          {isAdmin && (
            <button
              className="user-admin-link"
              onClick={() => navigate('/admin/dashboard')}
            >
              Admin dashboard →
            </button>
          )}

          <button className="user-logout" onClick={handleLogout}>
            <LogOut size={16} /> Log out
          </button>
        </div>
      </aside>
    </>
  );
}