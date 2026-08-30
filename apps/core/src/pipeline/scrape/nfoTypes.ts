export type ThumbAspect = "poster" | "clearlogo" | null;

export interface NfoThumb {
  url: string;
  aspect: ThumbAspect;
  season?: number;
  type?: string;
}

export interface TvShowNFORating {
  default?: boolean;
  max?: number;
  name?: string;
  value?: number;
  votes?: number;
}

export interface TvShowNFOUniqueId {
  default?: boolean;
  type?: string;
  value?: string;
}

export interface TvShowNFOActor {
  name?: string;
  role?: string;
  thumb?: string;
  profile?: string;
  type?: string;
  tmdbid?: string;
}

export interface TvShowNFONamedSeason {
  number?: number;
  name?: string;
}

export interface TvShowNFO {
  title?: string;
  originalTitle?: string;
  showTitle?: string;
  sortTitle?: string;
  year?: number;
  top250?: number;
  ratings?: TvShowNFORating[];
  userRating?: number;
  outline?: string;
  plot?: string;
  tagline?: string;
  runtime?: number;
  thumbs?: NfoThumb[];
  namedSeasons?: TvShowNFONamedSeason[];
  fanartThumbs?: string[];
  mpaa?: string;
  certification?: string;
  episodeguide?: string;
  id?: string;
  imdbid?: string;
  tmdbid?: string;
  tvdbid?: string;
  uniqueIds?: TvShowNFOUniqueId[];
  premiered?: string;
  status?: string;
  watched?: boolean;
  playcount?: number;
  genres?: string[];
  studios?: string[];
  countries?: string[];
  tags?: string[];
  actors?: TvShowNFOActor[];
  trailer?: string;
  dateadded?: string;
  userNote?: string;
}

export interface EpisodeNfo {
  id?: string;
  title?: string;
  originalTitle?: string;
  showTitle?: string;
  season?: number;
  episode?: number;
  uniqueIds?: TvShowNFOUniqueId[];
  ratings?: TvShowNFORating[];
  userRating?: number;
  plot?: string;
  runtime?: number;
  thumb?: string;
  mpaa?: string;
  premiered?: string;
  aired?: string;
  watched?: boolean;
  playcount?: number;
  studios?: string[];
  credits?: Array<{ tmdbid?: string; name?: string }>;
  directors?: Array<{ tmdbid?: string; name?: string }>;
  actors?: TvShowNFOActor[];
  dateadded?: string;
  source?: string;
  edition?: string;
  originalFilename?: string;
  userNote?: string;
  episodeGroups?: Array<{ id?: string; name?: string; season?: number; episode?: number }>;
}

export interface MovieNFOSet {
  name?: string;
  overview?: string;
}

export interface MovieNFO {
  title?: string;
  originalTitle?: string;
  sortTitle?: string;
  year?: number;
  ratings?: TvShowNFORating[];
  userRating?: number;
  top250?: number;
  set?: MovieNFOSet;
  plot?: string;
  outline?: string;
  tagline?: string;
  runtime?: number;
  thumbs?: NfoThumb[];
  fanartThumbs?: string[];
  id?: string;
  imdbid?: string;
  tmdbid?: string;
  tvdbid?: string;
  uniqueIds?: TvShowNFOUniqueId[];
  countries?: string[];
  status?: string;
  premiered?: string;
  watched?: boolean;
  playcount?: number;
  genres?: string[];
  studios?: string[];
  languages?: string;
  dateadded?: string;
}
