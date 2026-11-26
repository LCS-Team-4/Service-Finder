import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MapPinned, Shield } from 'lucide-react';
import { getMe, type MeResponse } from '../../services/api';

export default function RoleSwitcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    getMe().then(setMe).catch(() => setMe(null));
  }, []);

  if (!me || me.role !== 'admin') return null;

  const isOnAdmin = location.pathname.startsWith('/admin');

  return (
    <div className="role-switcher">
      <button
  className={!isOnAdmin ? 'active' : ''}
  onClick={() => navigate('/dashboard')}
>
  <MapPinned size={14} /> View Map
</button>
    </div>
  );
}