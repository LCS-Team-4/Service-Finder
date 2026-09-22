import { LocateFixed, Search } from 'lucide-react';

interface GuideSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  onLocate: () => void;
  tracking: boolean;
}

export default function GuideSearch({
  query,
  onQueryChange,
  onSearch,
  onLocate,
  tracking,
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
    </section>
  );
}