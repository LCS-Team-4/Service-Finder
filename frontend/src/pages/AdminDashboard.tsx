import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMe } from '../services/api';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then((me) => setEmail(me.email ?? ''))
      .catch(() => navigate('/admin', { replace: true }))
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) {
    return (
      <main className="guide-shell">
        <div style={{ padding: 40, textAlign: 'center' }}>
          Loading admin dashboard…
        </div>
      </main>
    );
  }

  return (
    <main className="guide-shell">
      <div style={{ padding: 40, maxWidth: 800, margin: '0 auto' }}>
        <h1>Admin Dashboard — Coming Soon</h1>
        <p>Signed in as: <strong>{email}</strong></p>
        <p>This is a skeleton. We'll build the real admin tools here.</p>
        <button
          onClick={() => {
            localStorage.removeItem('servicefinder_access_token');
            localStorage.removeItem('servicefinder_refresh_token');
            navigate('/admin', { replace: true });
          }}
        >
          Sign out
        </button>
      </div>
    </main>
  );
}