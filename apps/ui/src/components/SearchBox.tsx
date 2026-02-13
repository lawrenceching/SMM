import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Search } from 'lucide-react';

interface SearchBoxProps {
  value: string;
  onValueChange: (value: string) => void;
  mediaType: 'tvshow' | 'movie';
  onMediaTypeChange: (type: 'tvshow' | 'movie') => void;
  onSearch: () => void;
  isLoading?: boolean;
  placeholder?: string;
}

export function SearchBox({
  value,
  onValueChange,
  mediaType,
  onMediaTypeChange,
  onSearch,
  isLoading = false,
  placeholder = 'Enter movie or TV show name...',
}: SearchBoxProps) {
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearch();
    }
  };

  return (
    <div className="flex gap-2">
      <Select
        value={mediaType}
        onValueChange={onMediaTypeChange}
        disabled={isLoading}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Select media type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="tvshow">TV Show</SelectItem>
          <SelectItem value="movie">Movie</SelectItem>
        </SelectContent>
      </Select>
      <Input
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        onKeyPress={handleKeyPress}
        disabled={isLoading}
        className="flex-1"
      />
      <Button
        onClick={onSearch}
        disabled={isLoading || !value.trim()}
      >
        <Search className="w-4 h-4 mr-2" />
        {isLoading ? 'Searching...' : 'Search'}
      </Button>
    </div>
  );
}
