# The example of TVDB series API

The id is number id extracted from object id such as `series-421069`.

The object is provided by Search API.

```bash
curl `https://tmdb-mcp-server.imlc.me/api/tvdb/v4/series/421069`
```

```json
{
    "status": "success",
    "data": {
      "id": 421069,
      "name": "【推しの子】",
      "slug": "oshi-no-ko",
      "image": "https://artworks.thetvdb.com/banners/v4/series/421069/posters/641e6331b737b.jpg",
      "nameTranslations": [
        "jpn",
        "eng",
        "fra",
        "pt",
        "spa",
        "zho",
        "deu",
        "kor",
        "tha",
        "zhtw",
        "rus",
        "ita",
        "tur",
        "ukr",
        "ind",
        "ara",
        "pol"
      ],
      "overviewTranslations": [
        "jpn",
        "eng",
        "fra",
        "pt",
        "spa",
        "zho",
        "deu",
        "kor",
        "tha",
        "zhtw",
        "rus",
        "ita",
        "tur",
        "ukr",
        "ind",
        "ara",
        "pol"
      ],
      "aliases": [
        {
          "language": "jpn",
          "name": "推しの子"
        },
        {
          "language": "rus",
          "name": "Звёздное дитя"
        },
        {
          "language": "rus",
          "name": "Ребёнок идола"
        },
        {
          "language": "ukr",
          "name": "Дитина улюбленця"
        },
        {
          "language": "ukr",
          "name": "Зіркові діти"
        },
        {
          "language": "zho",
          "name": "【我单推的孩子】"
        },
        {
          "language": "zho",
          "name": "我推的孩子"
        },
        {
          "language": "pt",
          "name": "[Minhas Crianças Favoritas]"
        },
        {
          "language": "pt",
          "name": "[Minha Favorita]"
        },
        {
          "language": "ara",
          "name": "أبناء نجمتهم المفضلة"
        },
        {
          "language": "eng",
          "name": "My Star"
        },
        {
          "language": "eng",
          "name": "My Favorite Idol's Children"
        },
        {
          "language": "eng",
          "name": "Children of the Star"
        },
        {
          "language": "eng",
          "name": "【OSHI Nの KO】"
        },
        {
          "language": "eng",
          "name": "Oshi no Ko (2023)"
        }
      ],
      "firstAired": "2023-04-12",
      "lastAired": "2026-03-25",
      "nextAired": "2026-03-25",
      "score": 150979,
      "status": {
        "id": 1,
        "name": "Continuing",
        "recordType": "series",
        "keepUpdated": true
      },
      "originalCountry": "jpn",
      "originalLanguage": "jpn",
      "defaultSeasonType": 1,
      "isOrderRandomized": false,
      "lastUpdated": "2026-03-18 15:52:48",
      "averageRuntime": 27,
      "episodes": null,
      "overview": "「この芸能界せかいにおいて嘘は武器だ」\r\n\r\n地方都市で働く産婦人科医・ゴロー。\r\nある日\"推し\"のアイドル「B小町」のアイが彼の前に現れた。\r\n彼女はある禁断の秘密を抱えており…。\r\nそんな二人の\"最悪\"の出会いから、運命が動き出していく―。",
      "year": "2023"
    }
  }
```