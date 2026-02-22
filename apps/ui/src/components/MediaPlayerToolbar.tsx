import { SearchForm } from './search-form';
import { FilterButton } from './shared/FilterButton';
import { SortingButton } from './shared/SortingButton';

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
  filterValue: Genre;
  sortValue: SortBy;
}

export function MediaPlayerToolbar({
  searchQuery,
  onSearchChange,
  onFilterChange,
  onSortChange,
  filterValue,
  sortValue
}: MediaPlayerToolbarProps) {
  const filterOptions = GENRES.map(genre => ({
    value: genre,
    label: genre === 'all' ? 'All Genres' : genre
  }));

  const sortOptions = SORT_OPTIONS.map(option => ({ ...option }));

  return (
    <header className="flex-shrink-0 bg-card/80 backdrop-blur-sm border-b border-border px-2 py-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
        </div>

        <div className="flex-1 max-w-md">
          <SearchForm
            value={searchQuery}
            onValueChange={onSearchChange}
            placeholder="Search music..."
            testId="mediaplayer-search-input"
          />
        </div>

        <div className="flex items-center gap-2">
          <FilterButton
            value={filterValue}
            options={filterOptions}
            onValueChange={onFilterChange}
            placeholder="Filter"
            tooltipLabel="Genre"
          />
          <SortingButton
            value={sortValue}
            options={sortOptions}
            onValueChange={onSortChange}
            placeholder="Sort"
            tooltipLabel="Sort by"
          />
        </div>
      </div>
    </header>
  );
}

export { GENRES, SORT_OPTIONS };
export type { Genre, SortBy };
