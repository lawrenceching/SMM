# TheTVDB (TVDB) HTTP API — v4

This document describes the **official TheTVDB API v4** HTTP surface that SMM’s CLI uses when talking to TVDB. Implementation reference: `apps/cli/src/route/Tvdb.ts`.

Authoritative references:

- [Interactive API docs (Swagger UI)](https://thetvdb.github.io/v4-api/)
- [OpenAPI spec & repo](https://github.com/thetvdb/v4-api) (see `docs/swagger.yml`)

Base URL used by SMM when no custom host is set:

```http
https://api4.thetvdb.com/v4
```

All paths below are relative to that base (trailing slashes on the configured host are normalized away).

---

## Authentication

### `POST /login`

Creates a **bearer token** used on subsequent requests. Per official docs, the token is valid for about **one month**.

**Request**

- `Content-Type: application/json`
- Body:

| Field    | Type   | Required | Description |
|----------|--------|----------|-------------|
| `apikey` | string | yes      | Your API key from [thetvdb.com dashboard](https://www.thetvdb.com/dashboard/account/apikey). |
| `pin`    | string | no*      | Subscriber PIN for user-supported keys. Omit entirely if not used. |

**Response (success)**

JSON with a token the client must send as a Bearer token. The official shape wraps the token under `data` (e.g. `data.token`). SMM also accepts a top-level `token` when parsing login responses.

**Subsequent requests**

```http
Authorization: Bearer <token>
Accept: application/json
```

SMM caches the token in process memory and refreshes it when it is close to expiry (implementation treats validity as **30 days** with a refresh margin — aligned with the documented one-month lifetime).

---

## Search

### `GET /search`

Searches TVDB’s index (series, movies, people, companies). Official notes: results are capped (e.g. **5k** max in the published spec).

**Query parameters** (subset commonly relevant to SMM; see OpenAPI for the full list)

| Parameter   | Description |
|------------|-------------|
| `query`    | Primary search string (titles, translations, aliases). |
| `q`        | Legacy alias of `query`; `query` is preferred. |
| `type`     | Restrict entity type: `movie`, `series`, `person`, or `company`. |
| `year`     | Filter by year (series/movies). |
| `company`  | Filter by company name. |
| `country`  | 3-letter country code (series/movies). |
| `director` | Director name (often movies). |
| `language` | **Primary language filter** (3-letter code, series/movies): restricts results to records whose **primary / original language** matches — *not* “return titles in this language”. See [official OpenAPI `GET /search`](https://github.com/thetvdb/v4-api/blob/main/docs/swagger.yml). For translated titles in search hits, use `SearchResult.name_translated` / `overview_translated` (when present). |
| `network`  | Network name (TV / TV movies). |
| `remote_id`| External id (e.g. IMDB). |
| `offset` / `limit` | Pagination. |

**Response**

JSON whose `data` field is an array of **search result** objects (`SearchResult` in the spec), plus `status` and optional `links` for pagination.

For **localized titles and overviews**, the spec includes `translations` and `overviews` as [`TranslationSimple`](https://github.com/thetvdb/v4-api/blob/main/docs/swagger.yml) maps (keys are 3-letter language codes such as `eng`, `zho`, `yue`). Some responses also use `name_translated` (sometimes a JSON string of code→title) or `overview_translated` (array of `code: text` lines). SMM’s UI (`tvdbSearchDisplay.ts`) picks strings from these fields according to the user’s **search language** — this is separate from the `language` **query** parameter above.

**What SMM calls**

SMM performs:

```http
GET /search?query=<encoded-keyword>&type=<movie|series>
```

Optional: `&language=<3-letter-code>` — **only if** you intend to filter by **primary language** (e.g. mostly English-produced series). Do **not** confuse this with UI “search language” or expecting English *translations* of Japanese titles; that is not what this parameter does.

- UI/API may send `type: "tv"`; the CLI maps that to TVDB’s `type=series`.
- SMM does **not** automatically add `language` from the media search language dropdown (that would misapply this filter). The CLI still accepts an optional `language` in `POST /api/tvdb/search` for callers that explicitly want primary-language filtering.

---

## Series details

### `GET /series/{id}/extended`

Returns an **extended** series record (richer than the base record).

**Path**

- `id` — numeric TVDB series id.

**Query (optional)**

| Parameter | Description |
|-----------|-------------|
| `meta`    | `translations` or `episodes` (extra metadata). |
| `short`   | `true` to omit some heavy fields (e.g. characters, artworks per spec). |

**Response**

JSON with `data` containing a **series extended** record (`SeriesExtendedRecord` in the spec).

**Typical failure codes**

- `400` — invalid id  
- `401` — unauthorized  
- `404` — series not found  

---

## Movie details

### `GET /movies/{id}/extended`

Returns an **extended** movie record.

**Path**

- `id` — numeric TVDB movie id.

**Query (optional)**

| Parameter | Description |
|-----------|-------------|
| `meta`    | `translations` only (per spec). |
| `short`   | `true` for a reduced payload (no characters, artworks, trailers per spec). |

**Response**

JSON with `data` containing a **movie extended** record (`MovieExtendedRecord` in the spec).

**Typical failure codes**

- `400` — invalid id  
- `401` — unauthorized  
- `404` — movie not found  

---

## Response envelope (typical)

Most successful TVDB v4 responses follow a common pattern:

```json
{
  "data": { },
  "status": "success"
}
```

`data` may be an object or an array depending on the endpoint. SMM’s TVDB layer returns the **parsed JSON verbatim** to the UI (no forced unwrapping of `data`), so clients should handle the official envelope when reading responses.

---

## SMM proxy routes (CLI → same official calls)

The CLI exposes thin HTTP routes that authenticate with TVDB and forward to the endpoints above:

| SMM route | Method | Maps to TVDB |
|-----------|--------|----------------|
| `/api/tvdb/search` | `POST` body: `{ keyword, type: "tv" \| "movie" }` | `GET /search?query=…&type=series\|movie` |
| `/api/tvdb/series/:id` | `GET` | `GET /series/:id/extended` |
| `/api/tvdb/movie/:id` | `GET` | `GET /movies/:id/extended` |

Configuration: API key and optional custom `host` live in user config (`UserConfig.tvdb`); see `getTvdbConfig()` in `Tvdb.ts`.

Errors (missing key, login failure, HTTP errors from TVDB) are often returned as JSON `{ "error": "…" }` with HTTP **200** from these proxy routes — check the JSON body, not only status codes, when integrating.

---

## Example: minimal official call flow

1. `POST https://api4.thetvdb.com/v4/login` with `{ "apikey": "<your-key>" }`  
2. Read bearer token from the response.  
3. `GET https://api4.thetvdb.com/v4/search?query=oshi+no+ko&type=series` with `Authorization: Bearer <token>`  
4. `GET https://api4.thetvdb.com/v4/series/421069/extended` with the same header for full series payload.

A large real-world shape for `/series/{id}/extended` is kept in-repo as `docs/tvdb-tvshow-http-response-example.json` (illustrative sample, not a guarantee of all fields for every series).
