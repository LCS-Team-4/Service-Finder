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

      <select
  className="radius-select"
  value={radiusKm ?? 'off'}
  onChange={(event) =>
    onRadiusChange(event.target.value === 'off' ? null : Number(event.target.value))
  }
  title="Filter services by distance from you"
>
  <option value={1}>1 km</option>
  <option value={2}>2 km</option>
  <option value={5}>5 km</option>
  <option value={10}>10 km</option>
  <option value={20}>20 km</option>
  <option value="off">All</option>
</select>
    </section>
  );
}