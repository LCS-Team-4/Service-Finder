import { LocateFixed, Search } from 'lucide-react';

export default function GuideSearch({ query, onQueryChange, onSearch, onLocate }: { query: string; onQueryChange: (query: string) => void; onSearch: () => void; onLocate: () => void }) {
  return <section className="search-panel">
    <span className="glass"><Search size={19} /></span>
    <input value={query} onChange={(event) => onQueryChange(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && onSearch()} placeholder="Search for a place or service..." />
    <button className="search-button" onClick={onSearch}>Search</button>
    <button className="locate" title="Use my location" onClick={onLocate}><LocateFixed size={17} /></button>
  </section>;
}