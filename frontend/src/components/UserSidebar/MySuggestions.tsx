import { useEffect, useState } from 'react';
import { Loader, ChevronDown, ChevronUp } from 'lucide-react';

interface Suggestion {
  id: string;
  name: string;
  type: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  review_note?: string;
}

export function MySuggestions() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('servicefinder_access_token');
    fetch(`${import.meta.env.VITE_API_BASE_URL}/services/my-suggestions`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : Promise.reject('Failed to load'))
      .then(data => { setSuggestions(data); setLoading(false); })
      .catch(() => { setError('Could not load suggestions'); setLoading(false); });
  }, []);

  if (loading) return <div className="p-4"><Loader size={16} className="animate-spin" /></div>;
  if (error) return <div className="p-4 text-sm text-red-600">{error}</div>;
  if (suggestions.length === 0) return <div className="p-4 text-sm italic">No suggestions yet.</div>;

  const visible = showAll ? suggestions : suggestions.slice(0, 5);

  return (
    <div className="my-suggestions-panel" style={{ padding: '1rem', borderTop: '1px solid #ccc' }}>
      <h3 className="text-sm font-bold mb-2">My Suggestions</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {visible.map(s => (
          <li key={s.id} style={{ marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid #eee' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-sm font-semibold">{s.name}</span>
              <span style={{
                fontSize: '0.7rem',
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: s.status === 'approved' ? '#d4edda' : s.status === 'rejected' ? '#f8d7da' : '#fff3cd',
                color: s.status === 'approved' ? '#155724' : s.status === 'rejected' ? '#721c24' : '#856404',
              }}>
                {s.status.toUpperCase()}
              </span>
            </div>
            {s.status === 'rejected' && s.review_note && (
              <p style={{ fontSize: '0.75rem', color: '#721c24', marginTop: '0.25rem', fontStyle: 'italic' }}>
                Reason: {s.review_note}
              </p>
            )}
            <small style={{ color: '#666', fontSize: '0.7rem' }}>
              Submitted {new Date(s.created_at).toLocaleDateString()}
            </small>
          </li>
        ))}
      </ul>
      {suggestions.length > 5 && (
        <button
          onClick={() => setShowAll(!showAll)}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'blue', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          {showAll ? <><ChevronUp size={14} /> Show less</> : <><ChevronDown size={14} /> See all ({suggestions.length})</>}
        </button>
      )}
    </div>
  );
}