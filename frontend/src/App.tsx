import { BrowserRouter, Navigate, Route, Routes , useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Home from './pages/Home';
import AdminSignIn from './pages/AdminSignIn';
import AdminDashboard from './pages/AdminDashboard';
import { getMe } from './services/api';

function ProtectedMap() {
  const accessToken = localStorage.getItem('servicefinder_access_token');
  return accessToken ? <Home /> : <Navigate to="/login" replace />;
}

function ProtectedAdmin() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'checking' | 'admin' | 'denied'>('checking');

  useEffect(() => {
    const token = localStorage.getItem('servicefinder_access_token');
    if (!token) {
      setStatus('denied');
      return;
    }
    getMe()
      .then((me) => setStatus(me.role === 'admin' ? 'admin' : 'denied'))
      .catch(() => setStatus('denied'));
  }, []);

  if (status === 'checking') {
    return (
      <main className="guide-shell">
        <div style={{ padding: 40, textAlign: 'center' }}>
          Verifying admin access…
        </div>
      </main>
    );
  }

  if (status === 'denied') {
    return <Navigate to="/admin" replace />;
  }

  return <AdminDashboard />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/dashboard" element={<ProtectedMap />} />

        {/* Admin — not linked from any public page */}
        <Route path="/admin" element={<AdminSignIn />} />
        <Route path="/admin/dashboard" element={<ProtectedAdmin />} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}