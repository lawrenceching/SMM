import { useState } from 'react';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { searchTmdb, getTMDBImageUrl } from '@/api/tmdb';
import { useConfig } from './config-provider';
import type { TMDBMovie, TMDBTVShow } from '@core/types';
import { SearchBox } from './SearchBox';

type MediaType = 'tvshow' | 'movie';

interface SearchResult {
  /**
   * TMDB ID
   */
  id: string;
  title: string;
  description: string;
  /**
   * Thumbnail URL
   */
  thumbnail: string;
}

interface MediaSearchProps {
  onSelect?: (tmdbId: number) => void;
}

export function MediaSearch({ onSelect }: MediaSearchProps) {
  const [query, setQuery] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('tvshow');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { userConfig } = useConfig();

  /**
   * Maps TMDB result to SearchResult format
   */
  const mapTmdbResult = (item: TMDBMovie | TMDBTVShow): SearchResult => {
    const isMovie = 'title' in item;
    return {
      id: item.id.toString(),
      title: isMovie ? item.title : item.name,
      description: item.overview || 'No description available',
      thumbnail: getTMDBImageUrl(item.poster_path, 'w300') || '',
    };
  };

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      // Get language from user config, default to en-US
      const language = (userConfig?.applicationLanguage || 'en-US') as 'zh-CN' | 'en-US' | 'ja-JP';
      
      // Map mediaType to TMDB type
      const tmdbType = mediaType === 'movie' ? 'movie' : 'tv';

      // Perform search
      const response = await searchTmdb(query.trim(), tmdbType, language);

      if (response.error) {
        setError(response.error);
        setResults([]);
        return;
      }

      // Map results to SearchResult format
      const mappedResults = response.results.map(mapTmdbResult);
      setResults(mappedResults);

      if (mappedResults.length === 0) {
        setError('No results found');
      }
    } catch (error) {
      console.error('Search failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to search TMDB';
      setError(errorMessage);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label>Search</Label>
          <SearchBox
            value={query}
            onValueChange={setQuery}
            mediaType={mediaType}
            onMediaTypeChange={setMediaType}
            onSearch={handleSearch}
            isLoading={isLoading}
            placeholder="Enter movie or TV show name..."
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Search Results</Label>
        {error && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}
        <ScrollArea className="h-[400px] w-full rounded-md border">
          <div className="p-4 space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-muted-foreground">Searching...</div>
              </div>
            ) : results.length > 0 ? (
              results.map((result) => (
                <div
                  key={result.id}
                  onClick={() => {
                    setSelectedResult(result);
                    if (onSelect) {
                      onSelect(parseInt(result.id));
                    }
                  }}
                  className={`flex gap-4 p-4 rounded-lg border transition-colors cursor-pointer ${
                    selectedResult?.id === result.id
                      ? 'bg-primary/10 ring-2 ring-primary ring-inset'
                      : 'bg-background hover:bg-accent'
                  }`}
                >
                  <div className="shrink-0">
                    <img
                      src={result.thumbnail || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjE5MiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjE5MiIgZmlsbD0iI2Y1ZjVmNSIvPjx0ZXh0IHg9IjY0IiB5PSIxMDAiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+'}
                      alt={result.title}
                      className="w-16 h-24 object-cover rounded-md bg-muted"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjE5MiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjE5MiIgZmlsbD0iI2Y1ZjVmNSIvPjx0ZXh0IHg9IjY0IiB5PSIxMDAiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+';
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg mb-1 truncate">
                      {result.title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {result.description}
                    </p>
                    <div className="mt-2">
                      <span className="inline-block px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">
                        TMDB ID: {result.id}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : !isLoading && !error ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                No results found
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
