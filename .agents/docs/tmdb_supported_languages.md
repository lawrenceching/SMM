# TMDB Supported Languages

> Source: [TMDB API Documentation](https://developer.themoviedb.org/docs/languages)
> Fetched: 2026-06-06 via `GET /3/configuration/languages` and `GET /3/configuration/primary_translations`

## Overview

TMDB uses two related language concepts:

1. **ISO 639-1 languages** — returned by `GET /3/configuration/languages`. Each entry has `iso_639_1`, `english_name`, and `name` (native name). These are the language codes used throughout the TMDB API.
2. **Primary translations** — returned by `GET /3/configuration/primary_translations`. IETF language tags (e.g. `en-US`, `zh-CN`) representing officially supported website/UI translations. API `language` query parameters typically use this format: `{iso_639_1}-{ISO_3166_1}`.

### Language code format

- **ISO 639-1**: language identifier (e.g. `en`, `zh`, `ja`)
- **ISO 3166-1**: country/region code paired with language (e.g. `en-US`, `pt-BR`)
- Image languages currently use ISO 639-1 only (planned upgrade to full IETF tags)

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /3/configuration/languages` | List all ISO 639-1 languages (187 entries) |
| `GET /3/configuration/primary_translations` | List officially supported IETF translation tags (144 entries) |

## ISO 639-1 Languages (187)

| iso_639_1 | english_name | name (native) |
|-----------|--------------|---------------|
| `aa` | Afar | Qafar af |
| `ab` | Abkhazian |  |
| `ae` | Avestan | Upastawakaēna |
| `af` | Afrikaans | Afrikaans |
| `ak` | Akan | Ákán |
| `am` | Amharic |  |
| `an` | Aragonese | Aragonés |
| `ar` | Arabic | العربية |
| `as` | Assamese | অসমীয়া |
| `av` | Avaric | магӏарул мацӏ |
| `ay` | Aymara | Aymara |
| `az` | Azerbaijani | Azərbaycan |
| `ba` | Bashkir | Башҡорт теле |
| `be` | Belarusian | беларуская мова |
| `bg` | Bulgarian | български език |
| `bi` | Bislama | Bislama |
| `bm` | Bambara | Bamanankan |
| `bn` | Bengali | বাংলা |
| `bo` | Tibetan | བོད་སྐད་། |
| `br` | Breton | Brezhoneg |
| `bs` | Bosnian | Bosanski |
| `ca` | Catalan | Català |
| `ce` | Chechen |  |
| `ch` | Chamorro | Finu' Chamorro |
| `cn` | Cantonese | 广州话 / 廣州話 |
| `co` | Corsican |  |
| `cr` | Cree |  |
| `cs` | Czech | Český |
| `cu` | Slavic |  |
| `cv` | Chuvash |  |
| `cy` | Welsh | Cymraeg |
| `da` | Danish | Dansk |
| `de` | German | Deutsch |
| `dv` | Divehi |  |
| `dz` | Dzongkha |  |
| `ee` | Ewe | Èʋegbe |
| `el` | Greek | ελληνικά |
| `en` | English | English |
| `eo` | Esperanto | Esperanto |
| `es` | Spanish | Español |
| `et` | Estonian | Eesti |
| `eu` | Basque | euskera |
| `fa` | Persian | فارسی |
| `ff` | Fulah | Fulfulde |
| `fi` | Finnish | suomi |
| `fj` | Fijian |  |
| `fo` | Faroese |  |
| `fr` | French | Français |
| `fy` | Frisian |  |
| `ga` | Irish | Gaeilge |
| `gd` | Gaelic |  |
| `gl` | Galician | Galego |
| `gn` | Guarani |  |
| `gu` | Gujarati |  |
| `gv` | Manx |  |
| `ha` | Hausa | Hausa |
| `he` | Hebrew | עִבְרִית |
| `hi` | Hindi | हिन्दी |
| `ho` | Hiri Motu |  |
| `hr` | Croatian | Hrvatski |
| `ht` | Haitian; Haitian Creole |  |
| `hu` | Hungarian | Magyar |
| `hy` | Armenian |  |
| `hz` | Herero |  |
| `ia` | Interlingua |  |
| `id` | Indonesian | Bahasa indonesia |
| `ie` | Interlingue |  |
| `ig` | Igbo |  |
| `ii` | Yi |  |
| `ik` | Inupiaq |  |
| `io` | Ido |  |
| `is` | Icelandic | Íslenska |
| `it` | Italian | Italiano |
| `iu` | Inuktitut |  |
| `ja` | Japanese | 日本語 |
| `jv` | Javanese |  |
| `ka` | Georgian | ქართული |
| `kg` | Kongo |  |
| `ki` | Kikuyu |  |
| `kj` | Kuanyama |  |
| `kk` | Kazakh | қазақ |
| `kl` | Kalaallisut |  |
| `km` | Khmer |  |
| `kn` | Kannada | ????? |
| `ko` | Korean | 한국어/조선말 |
| `kr` | Kanuri |  |
| `ks` | Kashmiri |  |
| `ku` | Kurdish |  |
| `kv` | Komi |  |
| `kw` | Cornish |  |
| `ky` | Kirghiz | ?????? |
| `la` | Latin | Latin |
| `lb` | Letzeburgesch |  |
| `lg` | Ganda |  |
| `li` | Limburgish |  |
| `ln` | Lingala |  |
| `lo` | Lao |  |
| `lt` | Lithuanian | Lietuvių |
| `lu` | Luba-Katanga |  |
| `lv` | Latvian | Latviešu |
| `mg` | Malagasy |  |
| `mh` | Marshall |  |
| `mi` | Maori |  |
| `mk` | Macedonian |  |
| `ml` | Malayalam |  |
| `mn` | Mongolian |  |
| `mo` | Moldavian |  |
| `mr` | Marathi |  |
| `ms` | Malay | Bahasa melayu |
| `mt` | Maltese | Malti |
| `my` | Burmese |  |
| `na` | Nauru |  |
| `nb` | Norwegian Bokmål | Bokmål |
| `nd` | Ndebele |  |
| `ne` | Nepali |  |
| `ng` | Ndonga |  |
| `nl` | Dutch | Nederlands |
| `nn` | Norwegian Nynorsk |  |
| `no` | Norwegian | Norsk |
| `nr` | Ndebele |  |
| `nv` | Navajo |  |
| `ny` | Chichewa; Nyanja |  |
| `oc` | Occitan |  |
| `oj` | Ojibwa |  |
| `om` | Oromo |  |
| `or` | Oriya |  |
| `os` | Ossetian; Ossetic |  |
| `pa` | Punjabi | ਪੰਜਾਬੀ |
| `pi` | Pali |  |
| `pl` | Polish | Polski |
| `ps` | Pushto | پښتو |
| `pt` | Portuguese | Português |
| `qu` | Quechua |  |
| `rm` | Raeto-Romance |  |
| `rn` | Rundi | Kirundi |
| `ro` | Romanian | Română |
| `ru` | Russian | Pусский |
| `rw` | Kinyarwanda | Kinyarwanda |
| `sa` | Sanskrit |  |
| `sc` | Sardinian |  |
| `sd` | Sindhi |  |
| `se` | Northern Sami |  |
| `sg` | Sango |  |
| `sh` | Serbo-Croatian |  |
| `si` | Sinhalese | සිංහල |
| `sk` | Slovak | Slovenčina |
| `sl` | Slovenian | Slovenščina |
| `sm` | Samoan |  |
| `sn` | Shona |  |
| `so` | Somali | Somali |
| `sq` | Albanian | shqip |
| `sr` | Serbian | Srpski |
| `ss` | Swati |  |
| `st` | Sotho |  |
| `su` | Sundanese |  |
| `sv` | Swedish | svenska |
| `sw` | Swahili | Kiswahili |
| `ta` | Tamil | தமிழ் |
| `te` | Telugu | తెలుగు |
| `tg` | Tajik |  |
| `th` | Thai | ภาษาไทย |
| `ti` | Tigrinya |  |
| `tk` | Turkmen |  |
| `tl` | Tagalog |  |
| `tn` | Tswana |  |
| `to` | Tonga |  |
| `tr` | Turkish | Türkçe |
| `ts` | Tsonga | Xitsonga |
| `tt` | Tatar |  |
| `tw` | Twi |  |
| `ty` | Tahitian |  |
| `ug` | Uighur |  |
| `uk` | Ukrainian | Український |
| `ur` | Urdu | اردو |
| `uz` | Uzbek | ozbek |
| `ve` | Venda |  |
| `vi` | Vietnamese | Tiếng Việt |
| `vo` | Volapük |  |
| `wa` | Walloon |  |
| `wo` | Wolof | Wolof |
| `xh` | Xhosa |  |
| `xx` | No Language | No Language |
| `yi` | Yiddish |  |
| `yo` | Yoruba | Èdè Yorùbá |
| `za` | Zhuang |  |
| `zh` | Mandarin | 普通话 |
| `zu` | Zulu | isiZulu |

## Primary Translations (144)

Officially supported IETF language tags for TMDB website localization and API `language` parameter:

| Tag | Tag | Tag | Tag | Tag | Tag |
|-----|-----|-----|-----|-----|-----|
| `af-ZA` | `ar-AE` | `ar-BH` | `ar-EG` | `ar-IQ` | `ar-JO` |
| `ar-LY` | `ar-MA` | `ar-QA` | `ar-SA` | `ar-TD` | `ar-YE` |
| `be-BY` | `bg-BG` | `bn-BD` | `bn-IN` | `br-FR` | `ca-AD` |
| `ca-ES` | `ch-GU` | `cs-CZ` | `cy-GB` | `da-DK` | `de-AT` |
| `de-CH` | `de-DE` | `el-CY` | `el-GR` | `en-AG` | `en-AU` |
| `en-BB` | `en-BZ` | `en-CA` | `en-CM` | `en-GB` | `en-GG` |
| `en-GH` | `en-GI` | `en-GY` | `en-IE` | `en-JM` | `en-KE` |
| `en-LC` | `en-MW` | `en-NZ` | `en-PG` | `en-TC` | `en-US` |
| `en-ZM` | `en-ZW` | `eo-EO` | `es-AR` | `es-CL` | `es-DO` |
| `es-EC` | `es-ES` | `es-GQ` | `es-GT` | `es-HN` | `es-MX` |
| `es-NI` | `es-PA` | `es-PE` | `es-PY` | `es-SV` | `es-UY` |
| `et-EE` | `eu-ES` | `fa-IR` | `fi-FI` | `fr-BF` | `fr-CA` |
| `fr-CD` | `fr-CI` | `fr-FR` | `fr-GF` | `fr-GP` | `fr-MC` |
| `fr-ML` | `fr-MU` | `fr-PF` | `ga-IE` | `gd-GB` | `gl-ES` |
| `he-IL` | `hi-IN` | `hr-HR` | `hu-HU` | `hy-AM` | `id-ID` |
| `it-IT` | `it-VA` | `ja-JP` | `ka-GE` | `kk-KZ` | `kn-IN` |
| `ko-KR` | `ku-TR` | `ky-KG` | `lt-LT` | `lv-LV` | `ml-IN` |
| `mr-IN` | `ms-MY` | `ms-SG` | `nb-NO` | `ne-NP` | `nl-BE` |
| `nl-NL` | `no-NO` | `oc-FR` | `pa-IN` | `pl-PL` | `pt-AO` |
| `pt-BR` | `pt-MZ` | `pt-PT` | `ro-MD` | `ro-RO` | `ru-RU` |
| `si-LK` | `sk-SK` | `sl-SI` | `so-SO` | `sq-AL` | `sq-XK` |
| `sr-ME` | `sr-RS` | `sv-SE` | `sw-TZ` | `ta-IN` | `te-IN` |
| `th-TH` | `tl-PH` | `tr-TR` | `uk-UA` | `ur-PK` | `uz-UZ` |
| `vi-VN` | `zh-CN` | `zh-HK` | `zh-SG` | `zh-TW` | `zu-ZA` |
