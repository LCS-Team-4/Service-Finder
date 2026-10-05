import { useEffect, useRef, useState } from 'react';
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

const SLIDER_MIN = 1;
const SLIDER_MAX = 50;
const SLIDER_STEP = 1;

export default function GuideSearch({
  query,
  onQueryChange,
  onSearch,
  onLocate,
  tracking,
  radiusKm,
  onRadiusChange,
}: GuideSearchProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const sliderValue = radiusKm === null ? SLIDER_MAX : Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, radiusKm));

  return (
    <>
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

        {/* Desktop dropdown — hidden below 780px by CSS */}
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

      {/* Mobile slider — hidden above 780px by CSS */}
      <div className="radius-slider">
        <div className="radius-slider-header">
          <span>Radius</span>
          <span className="radius-slider-value">
            {radiusKm === null ? 'All' : `${radiusKm} km`}
          </span>
        </div>
        <input
          type="range"
          min={SLIDER_MIN}
          max={SLIDER_MAX}
          step={SLIDER_STEP}
          value={sliderValue}
          onChange={(event) => {
            const value = Number(event.target.value);
            onRadiusChange(value >= SLIDER_MAX ? null : value);
          }}
          aria-label="Filter radius"
        />
        <div className="radius-slider-scale">
          <span>1</span>
          <span>25</span>
          <span>All</span>
        </div>
      </div>
    </>
  );
}