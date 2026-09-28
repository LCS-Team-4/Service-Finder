import { LocateFixed, Search } from 'lucide-react';

interface GuideSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  onLocate: () => void;
  tracking: boolean;
  radiusKm: number | null;
  onRadiusChange: (radius: number | null) => void;
}

const RADIUS_OPTIONS: Array<{ label: string; value: number | null }> = [
  { label: '1 km', value: 1 },
  { label: '2 km', value: 2 },
  { label: '5 km', value: 5 },
  { label: '10 km', value: 10 },
  { label: '25 km', value: 25 },
  { label: '50 km', value: 50 },
  { label: 'All', value: null },
];

export default function GuideSearch({
  query,
  onQueryChange,
  onSearch,
  onLocate,
  tracking,
  radiusKm,
  onRadiusChange,
}: GuideSearchProps) {
  return (
    <section className="search-panel">
      <span className="glass">
        <Search size={19} />
      </span>
      <input
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && onSearch()}
        placeholder="Search for a place or service..."
      />
      <div className="radius-picker">
        <select
          value={radiusKm === null ? 'all' : String(radiusKm)}
          onChange={(event) => {
            const value = event.target.value;
            onRadiusChange(value === 'all' ? null : Number(value));
          }}
          aria-label="Filter radius"
        >
          {RADIUS_OPTIONS.map((option) => (
            <option
              key={option.label}
              value={option.value === null ? 'all' : String(option.value)}
            >
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <button className="search-button" onClick={onSearch}>
        Search
      </button>
      <button
        className={`locate${tracking ? ' active' : ''}`}
        title={tracking ? 'Stop live location' : 'Show my live location'}
        onClick={onLocate}
      >
        <LocateFixed size={17} />
      </button>
    </section>
  );
}

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
        <section className="search-panel">
      <span className="glass">
        <Search size={19} />
      </span>
      <input
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && onSearch()}
        placeholder="Search for a place or service..."
      />
      <button className="search-button" onClick={onSearch}>
        Search
      </button>
      <button
        className={`locate${tracking ? ' active' : ''}`}
        title={tracking ? 'Stop live location' : 'Show my live location'}
        onClick={onLocate}
      >
        <LocateFixed size={17} />
      </button>

      <div className="radius-select" ref={ref}>
        <button
          type="button"
          className="radius-select-trigger"
          onClick={() => setOpen((o) => !o)}
        >
          {radiusKm === null ? 'All' : `${radiusKm} km`}
          <span className="radius-select-caret">▾</span>
        </button>
        {open && (
          <ul className="radius-select-menu" role="listbox">
            {RADIUS_OPTIONS.map((opt) => (
              <li
                key={opt.label}
                role="option"
                aria-selected={radiusKm === opt.value}
                className={radiusKm === opt.value ? 'selected' : ''}
                onClick={() => {
                  onRadiusChange(opt.value);
                  setOpen(false);
                }}
              >
                {opt.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}