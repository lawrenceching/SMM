# TVDB Supported Languages

> Source: [TVDB API v4 Documentation](https://thetvdb.github.io/v4-api/)
> Fetched: 2026-06-06 via `GET /v4/languages`

## Overview

TVDB API v4 provides a languages endpoint that returns all available language records. Each record uses **ISO 639-3** (3-letter) codes as the `id` field. The `shortCode` field (when present) provides a shorter identifier for translations.

### Language record schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | ISO 639-3 language code (e.g. `eng`, `zho`, `jpn`) |
| `name` | string | English name of the language |
| `nativeName` | string | Name in the language's own script |
| `shortCode` | string \| null | Short code for translations (often null) |

## API Endpoint

| Endpoint | Description |
|----------|-------------|
| `GET /v4/languages` | Returns list of all language records (185 entries) |

### Usage in translations

Translation endpoints use the language `id` (ISO 639-3) in the URL path:

- `GET /series/{id}/translations/{language}`
- `GET /movies/{id}/translations/{language}`
- `GET /episodes/{id}/translations/{language}`
- `GET /seasons/{id}/translations/{language}`
- `GET /people/{id}/translations/{language}`

## Languages (185)

| id (ISO 639-3) | name | nativeName | shortCode |
|----------------|------|------------|----------|
| `aar` | Afar | Afaraf |  |
| `abk` | Abkhaz | аҧсуа бызшәа |  |
| `afr` | Afrikaans | Afrikaans |  |
| `aka` | Akan | Akan |  |
| `amh` | Amharic | አማርኛ |  |
| `ara` | Arabic | العربية |  |
| `arg` | Aragonese | aragonés |  |
| `asm` | Assamese | অসমীয়া |  |
| `ava` | Avaric | авар мацӀ |  |
| `ave` | Avestan | avesta |  |
| `aym` | Aymara | aymar aru |  |
| `aze` | Azerbaijani | azərbaycan dili |  |
| `bak` | Bashkir | башҡорт теле |  |
| `bam` | Bambara | bamanankan |  |
| `bel` | Belarusian | беларуская мова |  |
| `ben` | Bengali | বাংলা |  |
| `bih` | Bihari | भोजपुरी |  |
| `bis` | Bislama | Bislama |  |
| `bod` | Tibetan Standard | བོད་ཡིག |  |
| `bos` | Bosnian | bosanski jezik |  |
| `bre` | Breton | brezhoneg |  |
| `bul` | Bulgarian | български език |  |
| `cat` | Catalan | català |  |
| `ces` | Czech | čeština |  |
| `cha` | Chamorro | Chamoru |  |
| `che` | Chechen | нохчийн мотт |  |
| `chu` | Old Church Slavonic | ѩзыкъ словѣньскъ |  |
| `chv` | Chuvash | чӑваш чӗлхи |  |
| `cor` | Cornish | Kernewek |  |
| `cos` | Corsican | corsu |  |
| `cre` | Cree | ᓀᐦᐃᔭᐍᐏᐣ |  |
| `cym` | Welsh | Cymraeg |  |
| `dan` | Danish | dansk |  |
| `deu` | German | Deutsch |  |
| `div` | Divehi | ދިވެހި |  |
| `dzo` | Dzongkha | རྫོང་ཁ |  |
| `ell` | Greek | ελληνική γλώσσα |  |
| `eng` | English | English |  |
| `epo` | Esperanto | Esperanto |  |
| `est` | Estonian | eesti |  |
| `eus` | Basque | euskara |  |
| `ewe` | Ewe | Eʋegbe |  |
| `fao` | Faroese | føroyskt |  |
| `fas` | Persian | فارسی |  |
| `fij` | Fijian | vosa Vakaviti |  |
| `fin` | Finnish | suomi |  |
| `fra` | French | français |  |
| `fry` | Western Frisian | Frysk |  |
| `ful` | Fula | Fulfulde |  |
| `gla` | Scottish Gaelic | Gàidhlig |  |
| `gle` | Irish | Gaeilge |  |
| `glg` | Galician | galego |  |
| `glv` | Manx | Gaelg |  |
| `grn` | Guaraní | Avañe'ẽ |  |
| `guj` | Gujarati | ગુજરાતી |  |
| `hat` | Haitian | Kreyòl ayisyen |  |
| `hau` | Hausa | هَوُسَ |  |
| `heb` | Hebrew | עברית |  |
| `her` | Herero | Otjiherero |  |
| `hin` | Hindi | हिन्दी |  |
| `hmo` | Hiri Motu | Hiri Motu |  |
| `hrv` | Croatian | hrvatski jezik |  |
| `hun` | Hungarian | Magyar |  |
| `hye` | Armenian | Հայերեն |  |
| `ibo` | Igbo | Asụsụ Igbo |  |
| `ido` | Ido | Ido |  |
| `iii` | Nuosu | Nuosuhxop |  |
| `iku` | Inuktitut | ᐃᓄᒃᑎᑐᑦ |  |
| `ile` | Interlingue | Interlingue |  |
| `ina` | Interlingua | Interlingua |  |
| `ind` | Indonesian | Bahasa Indonesia |  |
| `ipk` | Inupiaq | Iñupiaq |  |
| `isl` | Icelandic | Íslenska |  |
| `ita` | Italian | italiano |  |
| `jav` | Javanese | basa Jawa |  |
| `jpn` | Japanese | 日本語 |  |
| `kal` | Kalaallisut | kalaallisut |  |
| `kan` | Kannada | ಕನ್ನಡ |  |
| `kas` | Kashmiri | कश्मीरी |  |
| `kat` | Georgian | ქართული |  |
| `kau` | Kanuri | Kanuri |  |
| `kaz` | Kazakh | қазақ тілі |  |
| `khm` | Khmer | ខ្មែរ |  |
| `kik` | Kikuyu | Gĩkũyũ |  |
| `kin` | Kinyarwanda | Ikinyarwanda |  |
| `kir` | Kirghiz | кыргыз тили |  |
| `kom` | Komi | коми кыв |  |
| `kon` | Kongo | KiKongo |  |
| `kor` | Korean | 한국어 |  |
| `kua` | Kwanyama | Kuanyama |  |
| `kur` | Kurdish | Kurdî |  |
| `lao` | Lao | ພາສາລາວ |  |
| `lat` | Latin | latine |  |
| `lav` | Latvian | latviešu valoda |  |
| `lim` | Limburgish | Limburgs |  |
| `lin` | Lingala | Lingála |  |
| `lit` | Lithuanian | lietuvių kalba |  |
| `ltz` | Luxembourgish | Lëtzebuergesch |  |
| `lub` | Luba-Katanga | Luba-Katanga |  |
| `lug` | Luganda | Luganda |  |
| `mah` | Marshallese | Kajin M̧ajeļ |  |
| `mal` | Malayalam | മലയാളം |  |
| `mar` | Marathi | मराठी |  |
| `mkd` | Macedonian | македонски јазик |  |
| `mlg` | Malagasy | Malagasy fiteny |  |
| `mlt` | Maltese | Malti |  |
| `mon` | Mongolian | монгол |  |
| `mri` | Māori | te reo Māori |  |
| `msa` | Malay | bahasa Melayu |  |
| `mya` | Burmese | Burmese |  |
| `nau` | Nauru | Ekakairũ Naoero |  |
| `nav` | Navajo | Diné bizaad |  |
| `nbl` | South Ndebele | isiNdebele |  |
| `nde` | North Ndebele | isiNdebele |  |
| `ndo` | Ndonga | Owambo |  |
| `nep` | Nepali | नेपाली |  |
| `nld` | Dutch | Nederlands |  |
| `nor` | Norwegian | Norsk bokmål |  |
| `nya` | Chewa | chiCheŵa |  |
| `oci` | Occitan | occitan |  |
| `oji` | Ojibwe | ᐊᓂᔑᓈᐯᒧᐎᓐ |  |
| `ori` | Oriya | ଓଡ଼ିଆ |  |
| `orm` | Oromo | Afaan Oromoo |  |
| `oss` | Ossetian | ирон æвзаг |  |
| `pan` | Panjabi | ਪੰਜਾਬੀ |  |
| `pli` | Pāli | पाऴि |  |
| `pol` | Polish | język polski |  |
| `por` | Portuguese - Portugal | Português - Portugal |  |
| `pt` | Portuguese - Brazil | Português - Brasil |  |
| `pus` | Pashto | پښتو |  |
| `que` | Quechua | Runa Simi |  |
| `roh` | Romansh | rumantsch grischun |  |
| `ron` | Romanian | limba română |  |
| `run` | Kirundi | Ikirundi |  |
| `rus` | Russian | русский язык |  |
| `sag` | Sango | yângâ tî sängö |  |
| `san` | Sanskrit | संस्कृतम् |  |
| `sin` | Sinhala | සිංහල |  |
| `slk` | Slovak | slovenčina |  |
| `slv` | Slovene | slovenski jezik |  |
| `sme` | Northern Sami | Davvisámegiella |  |
| `smo` | Samoan | gagana fa'a Samoa |  |
| `sna` | Shona | chiShona |  |
| `snd` | Sindhi | सिन्धी |  |
| `som` | Somali | Soomaaliga |  |
| `sot` | Southern Sotho | Sesotho |  |
| `spa` | Spanish | español |  |
| `sqi` | Albanian | gjuha shqipe |  |
| `srd` | Sardinian | sardu |  |
| `srp` | Serbian | српски језик |  |
| `ssw` | Swati | SiSwati |  |
| `sun` | Sundanese | Basa Sunda |  |
| `swa` | Swahili | Kiswahili |  |
| `swe` | Swedish | svenska |  |
| `tah` | Tahitian | Reo Tahiti |  |
| `tam` | Tamil | தமிழ் |  |
| `tat` | Tatar | татар теле |  |
| `tel` | Telugu | తెలుగు |  |
| `tgk` | Tajik | тоҷикӣ |  |
| `tgl` | Tagalog | Wikang Tagalog |  |
| `tha` | Thai | ไทย |  |
| `tir` | Tigrinya | ትግርኛ |  |
| `ton` | Tonga | faka Tonga |  |
| `tsn` | Tswana | Setswana |  |
| `tso` | Tsonga | Xitsonga |  |
| `tuk` | Turkmen | Türkmen |  |
| `tur` | Turkish | Türkçe |  |
| `twi` | Twi | Twi |  |
| `uig` | Uighur | Uyƣurqə |  |
| `ukr` | Ukrainian | українська мова |  |
| `urd` | Urdu | اردو |  |
| `uzb` | Uzbek | Ozbek |  |
| `ven` | Venda | Tshivenḓa |  |
| `vie` | Vietnamese | Tiếng Việt |  |
| `vol` | Volapük | Volapük |  |
| `wln` | Walloon | walon |  |
| `wol` | Wolof | Wollof |  |
| `xho` | Xhosa | isiXhosa |  |
| `yid` | Yiddish | ייִדיש |  |
| `yor` | Yoruba | Yorùbá |  |
| `yue` | Chinese - Cantonese | 粵語 |  |
| `zha` | Zhuang | Saɯ cueŋƅ |  |
| `zho` | Chinese - China | 大陆简体 |  |
| `zhtw` | Chinese - Taiwan | 臺灣國語 |  |
| `zul` | Zulu | isiZulu |  |
