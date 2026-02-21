import { useState } from 'react';
import { Search, Filter, SortAsc, Music } from 'lucide-react';

const GENRES = ['all', 'pop', 'rock', 'electronic', 'jazz', 'classical'] as const;
const SORT_OPTIONS = [
  { value: 'title', label: 'Title (A-Z)' },
  { value: 'title-desc', label: 'Title (Z-A)' },
  { value: 'artist', label: 'Artist (A-Z)' },
  { value: 'duration', label: 'Duration' },
  { value: 'recent', label: 'Recently Added' }
] as const;

type Genre = typeof GENRES[number];
type SortBy = typeof SORT_OPTIONS[number]['value'];

export interface MediaPlayerToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onFilterChange: (genre: Genre) => void;
  onSortChange: (sortBy: SortBy) => void;
}

export function MediaPlayerToolbar({
  searchQuery,
  onSearchChange,
  onFilterChange,
  onSortChange
}: MediaPlayerToolbarProps) {
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  return (
    <header className="flex-shrink-0 bg-card/80 backdrop-blur-sm border-b border-border px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-primary flex items-center justify-center">
            <Music className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-foreground">MusicBox</h1>
        </div>

        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search music..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors duration-200"
              aria-label="Search music"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => {
                setShowFilterDropdown(!showFilterDropdown);
                setShowSortDropdown(false);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground hover:border-primary focus:outline-none focus:border-primary transition-colors duration-200"
              aria-haspopup="true"
              aria-expanded={showFilterDropdown}
            >
              <Filter className="w-4 h-4" />
              <span>Filter</span>
              <SortAsc className="w-4 h-4" />
            </button>
            {showFilterDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                {GENRES.map(genre => (
                  <button
                    key={genre}
                    onClick={() => {
                      onFilterChange(genre);
                      setShowFilterDropdown(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted transition-colors duration-200 capitalize"
                  >
                    {genre === 'all' ? 'All Genres' : genre}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => {
                setShowSortDropdown(!showSortDropdown);
                setShowFilterDropdown(false);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground hover:border-primary focus:outline-none focus:border-primary transition-colors duration-200"
              aria-haspopup="true"
              aria-expanded={showSortDropdown}
            >
              <SortAsc className="w-4 h-4" />
              <span>Sort</span>
              <SortAsc className="w-4 h-4" />
            </button>
            {showSortDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                {SORT_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onSortChange(option.value);
                      setShowSortDropdown(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted transition-colors duration-200"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export { GENRES, SORT_OPTIONS };
export type { Genre, SortBy };
