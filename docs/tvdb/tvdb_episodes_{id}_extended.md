# The example of TVDB Episodes API

The episode id comes from `/seasons/{seasonId}/extended`

```bash
curl `https://tmdb-mcp-server.imlc.me/api/tvdb/v4/episodes/2004593/extended`
```

```json
{
  "status": "success",
  "data": {
    "id": 9807573,
    "seriesId": 421069,
    "name": "振り返り特番～【推しの子】は推せるときに推せ!～",
    "aired": "2023-05-31",
    "runtime": 24,
    "nameTranslations": [
      "jpn",
      "eng",
      "deu",
      "kor",
      "fra",
      "rus"
    ],
    "overview": "大好評放送中のTVアニメ【推しの子】5月31日(水)は「TVアニメ【推しの子】振り返り特番～【推しの子】は推せるときに推せ！～」を放送致します。この振り返り特番ではアクア役・大塚剛央さん、ルビー役・伊駒ゆりえさんのインタビューと共にTVアニメ【推しの子】第一話～第七話を一挙振り返り。この番組を見れば『【推しの子】』を更に推せること間違いなし！",
    "overviewTranslations": [
      "jpn",
      "eng",
      "deu",
      "kor",
      "rus"
    ],
    "image": "https://artworks.thetvdb.com/banners/v4/episode/9807573/screencap/64791ffb9fd8e.jpg",
    "imageType": 11,
    "isMovie": 0,
    "seasons": [
      {
        "id": 2004592,
        "seriesId": 421069,
        "type": {
          "id": 1,
          "name": "Aired Order",
          "type": "official",
          "alternateName": null
        },
        "number": 0,
        "nameTranslations": null,
        "overviewTranslations": null,
        "image": "https://artworks.thetvdb.com/banners/v4/season/2004592/posters/66d5f92d04d1d.jpg",
        "imageType": 7,
        "companies": {
          "studio": null,
          "network": null,
          "production": null,
          "distributor": null,
          "special_effects": null
        },
        "lastUpdated": "2026-03-18 09:25:34"
      }
    ],
    "number": 1,
    "absoluteNumber": 0,
    "seasonNumber": 0,
    "lastUpdated": "2025-06-06 12:45:12",
    "finaleType": null,
    "airsBeforeSeason": 1,
    "airsBeforeEpisode": 8,
    "year": "2023"
  }
}
```