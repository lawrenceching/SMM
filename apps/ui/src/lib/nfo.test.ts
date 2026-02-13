import { describe, it, expect } from 'vitest'
import { Nfo, parseEpisodeNfo } from './nfo'

describe('Nfo', () => {

  describe('constructor', () => {
    it('should create an empty Nfo instance', () => {
      const nfo = new Nfo()
      
      expect(nfo.id).toBeUndefined()
      expect(nfo.title).toBeUndefined()
      expect(nfo.originalTitle).toBeUndefined()
      expect(nfo.showTitle).toBeUndefined()
      expect(nfo.plot).toBeUndefined()
      expect(nfo.thumbs).toBeUndefined()
      expect(nfo.fanart).toBeUndefined()
      expect(nfo.tmdbid).toBeUndefined()
    })
  })

  describe('toXML', () => {
    it('should generate XML with only tvshow root element when all fields are empty', () => {
      const nfo = new Nfo()
      const xml = nfo.toXML()

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>')
      // XMLSerializer creates self-closing tag when element is empty
      expect(xml).toMatch(/<tvshow\s*\/?>/)
    })

    it('should include all basic fields when populated', () => {
      const nfo = new Nfo()
      nfo.id = '12345'
      nfo.title = 'Test Show'
      nfo.originalTitle = 'Original Test Show'
      nfo.showTitle = 'Test Show Title'
      nfo.plot = 'This is a test plot'
      nfo.fanart = 'https://example.com/fanart.jpg'
      nfo.tmdbid = '67890'

      const xml = nfo.toXML()

      expect(xml).toContain('<id>12345</id>')
      expect(xml).toContain('<title>Test Show</title>')
      expect(xml).toContain('<originaltitle>Original Test Show</originaltitle>')
      expect(xml).toContain('<showtitle>Test Show Title</showtitle>')
      expect(xml).toContain('<plot>This is a test plot</plot>')
      expect(xml).toContain('<fanart>https://example.com/fanart.jpg</fanart>')
      expect(xml).toContain('<tmdbid>67890</tmdbid>')
    })

    it('should include only populated fields', () => {
      const nfo = new Nfo()
      nfo.title = 'Test Show'
      nfo.plot = 'Test plot'

      const xml = nfo.toXML()

      expect(xml).toContain('<title>Test Show</title>')
      expect(xml).toContain('<plot>Test plot</plot>')
      expect(xml).not.toContain('<id>')
      expect(xml).not.toContain('<originaltitle>')
      expect(xml).not.toContain('<showtitle>')
      expect(xml).not.toContain('<fanart>')
      expect(xml).not.toContain('<tmdbid>')
    })

    it('should include thumb elements with url only', () => {
      const nfo = new Nfo()
      nfo.thumbs = [
        { url: 'https://example.com/thumb1.jpg', aspect: null }
      ]

      const xml = nfo.toXML()

      expect(xml).toContain('<thumb>https://example.com/thumb1.jpg</thumb>')
    })

    it('should include thumb elements with aspect attribute', () => {
      const nfo = new Nfo()
      nfo.thumbs = [
        { url: 'https://example.com/poster.jpg', aspect: 'poster' },
        { url: 'https://example.com/logo.png', aspect: 'clearlogo' }
      ]

      const xml = nfo.toXML()

      expect(xml).toContain('<thumb aspect="poster">https://example.com/poster.jpg</thumb>')
      expect(xml).toContain('<thumb aspect="clearlogo">https://example.com/logo.png</thumb>')
    })

    it('should include thumb elements with season attribute', () => {
      const nfo = new Nfo()
      nfo.thumbs = [
        { url: 'https://example.com/season1.jpg', aspect: 'poster', season: 1 },
        { url: 'https://example.com/season2.jpg', aspect: 'poster', season: 2 }
      ]

      const xml = nfo.toXML()

      expect(xml).toContain('<thumb aspect="poster" season="1">https://example.com/season1.jpg</thumb>')
      expect(xml).toContain('<thumb aspect="poster" season="2">https://example.com/season2.jpg</thumb>')
    })

    it('should include thumb elements with type attribute', () => {
      const nfo = new Nfo()
      nfo.thumbs = [
        { url: 'https://example.com/thumb.jpg', aspect: 'poster', type: 'season' }
      ]

      const xml = nfo.toXML()

      expect(xml).toContain('<thumb aspect="poster" type="season">https://example.com/thumb.jpg</thumb>')
    })

    it('should include thumb elements with all attributes', () => {
      const nfo = new Nfo()
      nfo.thumbs = [
        { 
          url: 'https://example.com/thumb.jpg', 
          aspect: 'poster', 
          season: 1, 
          type: 'season' 
        }
      ]

      const xml = nfo.toXML()

      expect(xml).toContain('<thumb aspect="poster" season="1" type="season">https://example.com/thumb.jpg</thumb>')
    })

    it('should handle multiple thumb elements', () => {
      const nfo = new Nfo()
      nfo.thumbs = [
        { url: 'https://example.com/thumb1.jpg', aspect: 'poster' },
        { url: 'https://example.com/thumb2.jpg', aspect: 'clearlogo' },
        { url: 'https://example.com/thumb3.jpg', aspect: null, season: 1 }
      ]

      const xml = nfo.toXML()

      expect(xml).toContain('<thumb aspect="poster">https://example.com/thumb1.jpg</thumb>')
      expect(xml).toContain('<thumb aspect="clearlogo">https://example.com/thumb2.jpg</thumb>')
      expect(xml).toContain('<thumb season="1">https://example.com/thumb3.jpg</thumb>')
    })

    it('should skip thumb elements without url', () => {
      const nfo = new Nfo()
      nfo.thumbs = [
        { url: 'https://example.com/thumb1.jpg', aspect: 'poster' },
        { url: '', aspect: 'clearlogo' }, // Empty URL should be skipped
        { url: 'https://example.com/thumb3.jpg', aspect: null }
      ]

      const xml = nfo.toXML()

      expect(xml).toContain('<thumb aspect="poster">https://example.com/thumb1.jpg</thumb>')
      expect(xml).toContain('<thumb>https://example.com/thumb3.jpg</thumb>')
      // Should not contain the empty URL thumb
      const thumbMatches = xml.match(/<thumb[^>]*>/g) || []
      expect(thumbMatches.length).toBe(2)
    })

    it('should handle empty thumbs array', () => {
      const nfo = new Nfo()
      nfo.title = 'Test Show'
      nfo.thumbs = []

      const xml = nfo.toXML()

      expect(xml).toContain('<title>Test Show</title>')
      expect(xml).not.toContain('<thumb>')
    })

    it('should handle thumb with season 0', () => {
      const nfo = new Nfo()
      nfo.thumbs = [
        { url: 'https://example.com/thumb.jpg', aspect: 'poster', season: 0 }
      ]

      const xml = nfo.toXML()

      expect(xml).toContain('<thumb aspect="poster" season="0">https://example.com/thumb.jpg</thumb>')
    })

    it('should generate properly formatted XML with indentation', () => {
      const nfo = new Nfo()
      nfo.title = 'Test Show'
      nfo.plot = 'Test plot'
      nfo.thumbs = [
        { url: 'https://example.com/thumb.jpg', aspect: 'poster' }
      ]

      const xml = nfo.toXML()

      // Check that XML has proper line breaks and indentation
      expect(xml).toContain('\n')
      // Check that child elements are indented
      const lines = xml.split('\n')
      const tvshowLine = lines.find(line => line.includes('<tvshow>'))
      const titleLine = lines.find(line => line.includes('<title>'))
      
      expect(tvshowLine).toBeDefined()
      expect(titleLine).toBeDefined()
      // Title should be indented (starts with spaces)
      expect(titleLine?.startsWith('  ')).toBe(true)
    })

    it('should include XML declaration at the start', () => {
      const nfo = new Nfo()
      const xml = nfo.toXML()

      expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>')).toBe(true)
    })

    it('should generate valid XML structure', () => {
      const nfo = new Nfo()
      nfo.id = '123'
      nfo.title = 'Test Show'
      nfo.plot = 'Test plot'
      nfo.thumbs = [
        { url: 'https://example.com/thumb.jpg', aspect: 'poster', season: 1 }
      ]

      const xml = nfo.toXML()

      // Parse the XML to verify it's valid
      const parser = new DOMParser()
      const doc = parser.parseFromString(xml, 'text/xml')
      
      // Check for parsing errors
      const parseError = doc.querySelector('parsererror')
      expect(parseError).toBeNull()

      // Verify structure
      const tvshow = doc.querySelector('tvshow')
      expect(tvshow).not.toBeNull()
      expect(tvshow?.querySelector('id')?.textContent).toBe('123')
      expect(tvshow?.querySelector('title')?.textContent).toBe('Test Show')
      expect(tvshow?.querySelector('plot')?.textContent).toBe('Test plot')
      
      const thumb = tvshow?.querySelector('thumb')
      expect(thumb).not.toBeNull()
      expect(thumb?.textContent).toBe('https://example.com/thumb.jpg')
      expect(thumb?.getAttribute('aspect')).toBe('poster')
      expect(thumb?.getAttribute('season')).toBe('1')
    })

    it('should handle special characters in text content', () => {
      const nfo = new Nfo()
      nfo.title = 'Show & Title <with> "quotes"'
      nfo.plot = 'Plot with &amp; entities'

      const xml = nfo.toXML()

      // XMLSerializer escapes &, <, > in text content, but not quotes (quotes are only escaped in attributes)
      expect(xml).toContain('Show &amp; Title &lt;with&gt; "quotes"')
      // The &amp; in the input becomes &amp;amp; when serialized
      expect(xml).toContain('Plot with &amp;amp; entities')
    })

    it('should maintain element order', () => {
      const nfo = new Nfo()
      nfo.id = '1'
      nfo.title = 'Title'
      nfo.originalTitle = 'Original'
      nfo.showTitle = 'Show'
      nfo.plot = 'Plot'
      nfo.fanart = 'Fanart'
      nfo.tmdbid = '123'

      const xml = nfo.toXML()

      // Verify elements appear in the correct order
      const idIndex = xml.indexOf('<id>')
      const titleIndex = xml.indexOf('<title>')
      const originalTitleIndex = xml.indexOf('<originaltitle>')
      const showTitleIndex = xml.indexOf('<showtitle>')
      const plotIndex = xml.indexOf('<plot>')
      const fanartIndex = xml.indexOf('<fanart>')
      const tmdbidIndex = xml.indexOf('<tmdbid>')

      expect(idIndex).toBeLessThan(titleIndex)
      expect(titleIndex).toBeLessThan(originalTitleIndex)
      expect(originalTitleIndex).toBeLessThan(showTitleIndex)
      expect(showTitleIndex).toBeLessThan(plotIndex)
      expect(plotIndex).toBeLessThan(fanartIndex)
      expect(fanartIndex).toBeLessThan(tmdbidIndex)
    })
  })

  describe('fromXml', () => {
    it('should parse XML file and create Nfo instance with all fields', async () => {
      // Inline test NFO content (no file system access needed)
      const xmlContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<tvshow>
  <id>123876</id>
  <title>古见同学有交流障碍症</title>
  <originaltitle>古見さんは、コミュ症です。</originaltitle>
  <showtitle>古见同学有交流障碍症</showtitle>
  <plot>万人迷的美少女古见同学患有社交恐惧症。她极不擅长与人沟通，总是苦恼着「该如何开口跟人交谈？」「交谈之后又该怎么办？」只野同学和患有这种症状的古见同学变成了朋友，两人的心灵逐渐相通并且做了某项约定。从此之后，只野会不知不觉地傻笑，但偶尔，胸口也会隐隐刺痛。让人一看就中毒的社交恐惧症女主角喜剧在此揭开序幕！</plot>
  <fanart>https://image.tmdb.org/t/p/w1280/2bHGk7j4OD21qeXRRDYrKVhxzRc.jpg</fanart>
  <tmdbid>123876</tmdbid>
  <thumb aspect="poster">https://image.tmdb.org/t/p/w500/cJzKPkkr2rQczoT8gcdvV44Uh4Y.jpg</thumb>
  <thumb aspect="poster" season="1" type="season">https://image.tmdb.org/t/p/w500/hLtPx2WgRGhpoHgrGonSNpkJBmB.jpg</thumb>
</tvshow>`
      
      // Parse the XML
      const nfo = await Nfo.fromXml(xmlContent)
      
      // Verify all fields are correctly parsed
      expect(nfo.id).toBe('123876')
      expect(nfo.title).toBe('古见同学有交流障碍症')
      expect(nfo.originalTitle).toBe('古見さんは、コミュ症です。')
      expect(nfo.showTitle).toBe('古见同学有交流障碍症')
      expect(nfo.plot).toBe('万人迷的美少女古见同学患有社交恐惧症。她极不擅长与人沟通，总是苦恼着「该如何开口跟人交谈？」「交谈之后又该怎么办？」只野同学和患有这种症状的古见同学变成了朋友，两人的心灵逐渐相通并且做了某项约定。从此之后，只野会不知不觉地傻笑，但偶尔，胸口也会隐隐刺痛。让人一看就中毒的社交恐惧症女主角喜剧在此揭开序幕！')
      expect(nfo.fanart).toBe('https://image.tmdb.org/t/p/w1280/2bHGk7j4OD21qeXRRDYrKVhxzRc.jpg')
      expect(nfo.tmdbid).toBe('123876')
      
      // Verify thumbs array
      expect(nfo.thumbs).toBeDefined()
      expect(nfo.thumbs?.length).toBe(2)
      
      // Verify first thumb (poster only)
      expect(nfo.thumbs?.[0].url).toBe('https://image.tmdb.org/t/p/w500/cJzKPkkr2rQczoT8gcdvV44Uh4Y.jpg')
      expect(nfo.thumbs?.[0].aspect).toBe('poster')
      expect(nfo.thumbs?.[0].season).toBeUndefined()
      expect(nfo.thumbs?.[0].type).toBeUndefined()
      
      // Verify second thumb (poster with season and type)
      expect(nfo.thumbs?.[1].url).toBe('https://image.tmdb.org/t/p/w500/hLtPx2WgRGhpoHgrGonSNpkJBmB.jpg')
      expect(nfo.thumbs?.[1].aspect).toBe('poster')
      expect(nfo.thumbs?.[1].season).toBe(1)
      expect(nfo.thumbs?.[1].type).toBe('season')
    })
  })
})

describe('parseEpisodeNfo', () => {
  it('should parse minimal episode NFO with only required fields', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
  <title>Test Episode</title>
  <season>2</season>
  <episode>5</episode>
</episodedetails>`
    
    const episodeNfo = await parseEpisodeNfo(xml)
    
    expect(episodeNfo?.title).toBe('Test Episode')
    expect(episodeNfo?.season).toBe(2)
    expect(episodeNfo?.episode).toBe(5)
    expect(episodeNfo?.id).toBeUndefined()
    expect(episodeNfo?.originalFilename).toBeUndefined()
  })

  it('should handle missing optional fields', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
  <title>Episode Title</title>
  <season>1</season>
  <episode>1</episode>
</episodedetails>`
    
    const episodeNfo = await parseEpisodeNfo(xml)
    
    expect(episodeNfo?.title).toBe('Episode Title')
    expect(episodeNfo?.season).toBe(1)
    expect(episodeNfo?.episode).toBe(1)
    expect(episodeNfo?.id).toBeUndefined()
    expect(episodeNfo?.originalFilename).toBeUndefined()
  })

  it('should handle missing season and episode fields', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
  <title>Episode Title</title>
  <id>12345</id>
</episodedetails>`
    
    const episodeNfo = await parseEpisodeNfo(xml)
    
    expect(episodeNfo?.title).toBe('Episode Title')
    expect(episodeNfo?.id).toBe('12345')
    expect(episodeNfo?.season).toBeUndefined()
    expect(episodeNfo?.episode).toBeUndefined()
  })

  it('should parse season and episode as numbers', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
  <title>Test</title>
  <season>10</season>
  <episode>99</episode>
</episodedetails>`
    
    const episodeNfo = await parseEpisodeNfo(xml)
    
    expect(episodeNfo?.season).toBe(10)
    expect(episodeNfo?.episode).toBe(99)
    expect(typeof episodeNfo?.season).toBe('number')
    expect(typeof episodeNfo?.episode).toBe('number')
  })

  it('should handle season 0', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
  <title>Test</title>
  <season>0</season>
  <episode>1</episode>
</episodedetails>`
    
    const episodeNfo = await parseEpisodeNfo(xml)
    
    expect(episodeNfo?.season).toBe(0)
    expect(episodeNfo?.episode).toBe(1)
  })

  it('should skip invalid numeric values for season and episode', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
  <title>Test</title>
  <season>invalid</season>
  <episode>not-a-number</episode>
</episodedetails>`
    
    const episodeNfo = await parseEpisodeNfo(xml)
    
    expect(episodeNfo?.title).toBe('Test')
    expect(episodeNfo?.season).toBeUndefined()
    expect(episodeNfo?.episode).toBeUndefined()
  })

  it('should trim whitespace from text fields', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
  <title>  Test Episode  </title>
  <id>  12345  </id>
  <original_filename>  test.mkv  </original_filename>
  <season>1</season>
  <episode>2</episode>
</episodedetails>`
    
    const episodeNfo = await parseEpisodeNfo(xml)
    
    expect(episodeNfo?.title).toBe('Test Episode')
    expect(episodeNfo?.id).toBe('12345')
    expect(episodeNfo?.originalFilename).toBe('test.mkv')
  })

  it('should handle empty text elements', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
  <title></title>
  <season>1</season>
  <episode>1</episode>
</episodedetails>`
    
    const episodeNfo = await parseEpisodeNfo(xml)
    
    expect(episodeNfo?.title).toBeUndefined()
    expect(episodeNfo?.season).toBe(1)
    expect(episodeNfo?.episode).toBe(1)
  })

  it('should throw error for invalid XML', async () => {
    const invalidXml = `<?xml version="1.0"?>
<episodedetails>
  <title>Test</title>
  <unclosed-tag>
</episodedetails>`
    
    await expect(parseEpisodeNfo(invalidXml)).rejects.toThrow('Failed to parse XML')
  })

  it('should return undefined when episodedetails root element is missing', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<tvshow>
  <title>Test</title>
</tvshow>`
    
    const episodeNfo = await parseEpisodeNfo(xml)
    expect(episodeNfo).toBeUndefined()
  })

  it('should handle special characters in text content', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
  <title>Episode &amp; Title &lt;with&gt; "quotes"</title>
  <season>1</season>
  <episode>1</episode>
</episodedetails>`
    
    const episodeNfo = await parseEpisodeNfo(xml)
    
    // XML entities should be decoded by the parser
    expect(episodeNfo?.title).toBe('Episode & Title <with> "quotes"')
  })

  it('should handle original_filename with special characters', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
  <title>Test</title>
  <season>1</season>
  <episode>1</episode>
  <original_filename>Show Name - S01E01 - Episode Title.mkv</original_filename>
</episodedetails>`
    
    const episodeNfo = await parseEpisodeNfo(xml)
    
    expect(episodeNfo?.originalFilename).toBe('Show Name - S01E01 - Episode Title.mkv')
  })
})
