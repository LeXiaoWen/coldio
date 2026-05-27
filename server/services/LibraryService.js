const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

class LibraryService {
  constructor() {
    this.tracks = new Map()
    this.dirs = []
    this._initialized = false
    this._overrides = {}
    this._overridesPath = path.join(__dirname, '..', '..', 'data', 'track-overrides.json')
    this._sampleTracksPath = path.join(__dirname, '..', '..', 'data', 'sample-tracks.json')
  }

  _loadOverrides() {
    try {
      if (fs.existsSync(this._overridesPath)) {
        this._overrides = JSON.parse(fs.readFileSync(this._overridesPath, 'utf-8'))
        const count = Object.keys(this._overrides).length
        if (count > 0) console.log('[library] loaded', count, 'track overrides')
      }
    } catch (e) {
      console.warn('[library] failed to load overrides:', e.message)
    }
  }

  _applyOverride(track) {
    if (!track) return track
    const ov = this._overrides[track.id]
    if (!ov) return track
    return {
      ...track,
      title: ov.title || track.title,
      artist: ov.artist || track.artist
    }
  }

  _saveSampleTracks() {
    try {
      const tracks = Array.from(this.tracks.values()).filter(t =>
        t.source === 'local' && (!t.filepath || t.sourceDir === '(samples)')
      )
      if (tracks.length > 0) {
        const dir = path.dirname(this._sampleTracksPath)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(this._sampleTracksPath, JSON.stringify(tracks, null, 2), 'utf-8')
      }
    } catch (e) {
      console.warn('[library] failed to save sample tracks:', e.message)
    }
  }

  _loadSampleTracksFromDisk() {
    try {
      if (fs.existsSync(this._sampleTracksPath)) {
        const raw = fs.readFileSync(this._sampleTracksPath, 'utf-8')
        const tracks = JSON.parse(raw)
        if (Array.isArray(tracks) && tracks.length > 0) {
          for (const t of tracks) {
            this.tracks.set(t.id, t)
          }
          console.log('[library] loaded', tracks.length, 'sample tracks from disk')
          return true
        }
      }
    } catch (e) {
      console.warn('[library] failed to load sample tracks:', e.message)
    }
    return false
  }

  async init() {
    this._loadOverrides()
    const dirsEnv = process.env.RADIO_LIBRARY_DIRS || ''
    this.dirs = dirsEnv.split(',').map(d => d.trim()).filter(Boolean)

    if (this.dirs.length === 0) {
      console.log('[library] no RADIO_LIBRARY_DIRS configured — using built-in samples')
      if (!this._loadSampleTracksFromDisk()) {
        this._createSampleTracks()
        this._saveSampleTracks()
      }
      this._initialized = true
      return
    }

    for (const dir of this.dirs) {
      await this._scanDirectory(dir)
    }

    // Keep sample tracks as fallback if no real files found
    if (this.tracks.size === 0) {
      console.log('[library] no tracks found in configured dirs — using built-in samples as fallback')
      if (!this._loadSampleTracksFromDisk()) {
        this._createSampleTracks()
        this._saveSampleTracks()
      }
    }

    console.log('[library] scanned', this.tracks.size, 'tracks from', this.dirs.length, 'directories')
    this._initialized = true
  }

  async _scanDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
      console.warn('[library] directory not found:', dirPath)
      return
    }

    const audioExts = new Set(['.mp3', '.flac', '.m4a', '.m4r', '.wav', '.ogg'])

    const walk = (dir) => {
      let entries
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true })
      } catch { return }

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(fullPath)
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase()
          if (audioExts.has(ext)) {
            this._addTrack(fullPath, dir)
          }
        }
      }
    }

    walk(dirPath)
  }

  _addTrack(filePath, sourceDir) {
    const filename = path.basename(filePath)
    const ext = path.extname(filename)
    const name = path.basename(filename, ext)
    const id = crypto.createHash('md5').update(filePath).digest('hex').slice(0, 12)

    const { artist, title } = this._parseFilename(name, sourceDir)
    const tags = this._inferTags(filename, title, artist, filePath)
    const energy = this._inferEnergy(tags)
    const sceneFit = this._inferSceneFit(tags, energy)
    const mood = this._inferMood(tags, energy, sceneFit)
    const language = this._inferLanguage(title, artist, filename)

    // Get file size for duration estimation
    let fileSize = 0
    try { fileSize = fs.statSync(filePath).size } catch { }

    this.tracks.set(id, {
      id,
      title,
      artist,
      filename,
      filepath: filePath,
      duration: 0,
      format: ext.slice(1),
      source: 'local',
      sourceDir,
      mood,
      tags,
      energy,
      sceneFit,
      language,
      fileSize
    })
  }

  _parseFilename(name, sourceDir) {
    const sep = / - | -|- /
    const parts = name.split(sep).map(s => s.trim()).filter(Boolean)

    if (parts.length < 2) {
      return { title: name, artist: 'Unknown' }
    }

    const artistFirst = this._detectArtistFirst(name, sourceDir, parts)

    if (artistFirst) {
      return { artist: parts[0], title: parts.slice(1).join(' - ') }
    }
    return { title: parts[0], artist: parts.slice(1).join(' - ') }
  }

  _detectArtistFirst(name, sourceDir, parts) {
    if (/网易云|CloudMusic/i.test(sourceDir)) return true

    const leftHasChinese = /[一-鿿]/.test(parts[0])
    const rightIsEnglish = parts[1] && /^[a-zA-Z]/.test(parts[1])
    if (leftHasChinese && rightIsEnglish) return true

    const versionWords = /remix|bootleg|cover|live|edit|piano|instrumental|acoustic|rework|mix|version|伴奏/i
    if (parts[1] && versionWords.test(parts[1])) return true

    return false
  }

  _inferTags(filename, title, artist, filepath) {
    const tags = []
    const all = `${filename} ${title} ${artist} ${filepath}`.toLowerCase()

    if (/piano|钢琴/.test(all)) tags.push('piano')
    if (/ambient|氛围/.test(all)) tags.push('ambient')
    if (/电子|electronic/.test(all)) tags.push('light-electronic')
    if (/纯音|instrumental/.test(all)) tags.push('instrumental')
    if (/chill|relax|放松/.test(all)) tags.push('chill', 'relax')
    if (/city|urban|城市/.test(all)) tags.push('city')
    if (/acoustic|木吉他|吉他/.test(all)) tags.push('acoustic')
    if (/vocal|人声/.test(all)) tags.push('warm-vocal')
    if (/古典|neo-classical|classical/.test(all)) tags.push('neo-classical')
    if (/爵士|jazz/.test(all)) tags.push('chill', 'warm-vocal')
    if (/律动|groove|steady/.test(all)) tags.push('steady-groove')
    if (/节奏|rhythm|pop/.test(all)) tags.push('rhythm-pop')
    if (/mandarin|中文|华语/.test(all)) tags.push('mandarin-pop')
    if (/rain|雨|雨天/.test(all)) tags.push('rainy-day')
    if (/late.?night|深夜/.test(all)) tags.push('late-night')

    if (tags.length === 0) tags.push('instrumental')
    return [...new Set(tags)]
  }

  _inferEnergy(tags) {
    if (tags.some(t => ['ambient', 'late-night', 'piano', 'neo-classical'].includes(t))) return 'low'
    if (tags.some(t => ['relax', 'chill', 'acoustic', 'mandarin-pop'].includes(t))) return 'low-to-medium'
    if (tags.some(t => ['light-electronic', 'steady-groove', 'rhythm-pop'].includes(t))) return 'medium'
    return 'medium'
  }

  _inferSceneFit(tags, energy) {
    const scenes = ['daily']
    if (tags.some(t => ['light-electronic', 'piano'].includes(t))) scenes.push('morning', 'work')
    if (tags.some(t => ['instrumental'].includes(t)) || energy === 'low-to-medium' || energy === 'medium') scenes.push('work', 'afternoon')
    if (tags.some(t => ['acoustic', 'relax', 'mandarin-pop'].includes(t))) scenes.push('noon', 'evening')
    if (tags.some(t => ['chill', 'warm-vocal', 'neo-classical'].includes(t))) scenes.push('evening')
    if (tags.some(t => ['late-night', 'ambient'].includes(t)) || energy === 'low') scenes.push('night')
    return [...new Set(scenes)]
  }

  _inferMood(tags, energy, sceneFit) {
    if (sceneFit.includes('morning') || tags.includes('light-electronic')) return 'morning'
    if (sceneFit.includes('work') || tags.includes('instrumental')) return 'focus'
    if (sceneFit.includes('afternoon') || energy === 'medium') return 'drive'
    if (sceneFit.includes('evening') || tags.some(t => ['warm-vocal', 'chill'].includes(t))) return 'warm'
    if (sceneFit.includes('night') || tags.some(t => ['late-night', 'ambient'].includes(t))) return 'midnight'
    return 'open'
  }

  _inferLanguage(title, artist, filename) {
    const all = `${title} ${artist} ${filename}`
    if (/[一-鿿]/.test(all)) return 'chinese'
    if (/piano|instrumental|ambient|纯音|轻音乐/.test(all)) return 'instrumental'
    return 'unknown'
  }

  _createSampleTracks() {
    const samples = [
      { title: 'Rainy Day Piano', artist: 'Ambient Dream', tags: ['piano', 'chill'], energy: 'low', sceneFit: ['morning', 'night', 'daily'], mood: 'midnight' },
      { title: 'Electronic Morning', artist: 'Neon Waves', tags: ['light-electronic'], energy: 'medium', sceneFit: ['morning', 'work', 'daily'], mood: 'morning' },
      { title: 'Deep Focus', artist: 'Instrumental Lab', tags: ['instrumental', 'steady-groove'], energy: 'medium', sceneFit: ['work', 'daily'], mood: 'focus' },
      { title: 'Warm Evening', artist: 'Chill Vibes', tags: ['warm-vocal', 'chill'], energy: 'low-to-medium', sceneFit: ['evening', 'daily'], mood: 'warm' },
      { title: 'Night Journey', artist: 'Ambient Dream', tags: ['ambient', 'late-night'], energy: 'low', sceneFit: ['night', 'daily'], mood: 'midnight' },
      { title: 'Acoustic Afternoon', artist: 'Folk Tales', tags: ['acoustic', 'relax'], energy: 'low-to-medium', sceneFit: ['noon', 'afternoon', 'daily'], mood: 'warm' },
      { title: 'City Lights', artist: 'Urban Flow', tags: ['city', 'rhythm-pop'], energy: 'medium', sceneFit: ['afternoon', 'evening', 'daily'], mood: 'drive' },
      { title: 'Mandarin Morning', artist: '晨曦乐队', tags: ['mandarin-pop', 'acoustic'], energy: 'low-to-medium', sceneFit: ['morning', 'noon', 'daily'], mood: 'morning' },
      { title: 'Neo Classic Dreams', artist: 'Modern Classical', tags: ['neo-classical', 'piano'], energy: 'low', sceneFit: ['evening', 'night', 'daily'], mood: 'warm' },
      { title: 'Steady Groove', artist: 'Beat Architect', tags: ['steady-groove', 'light-electronic'], energy: 'medium', sceneFit: ['work', 'afternoon', 'daily'], mood: 'focus' },
    ]

    for (const s of samples) {
      const id = crypto.createHash('md5').update(s.title).digest('hex').slice(0, 12)
      this.tracks.set(id, {
        id,
        ...s,
        filename: `${s.artist} - ${s.title}.mp3`,
        filepath: '',
        duration: 180 + Math.floor(Math.random() * 120),
        format: 'mp3',
        source: 'local',
        sourceDir: '(samples)',
        language: s.tags.includes('mandarin-pop') ? 'chinese' : 'instrumental',
        fileSize: 5000000
      })
    }
  }

  getTrack(trackId) {
    const track = this.tracks.get(trackId) || null
    return track ? this._applyOverride(track) : null
  }

  getAllTracks() {
    return Array.from(this.tracks.values()).map(t => this._applyOverride(t))
  }

  getTracksByTags(tags) {
    if (!tags || tags.length === 0) return this.getAllTracks()
    const tagSet = new Set(tags)
    return this.getAllTracks().filter(t => t.tags.some(tt => tagSet.has(tt)))
  }

  getTrackCount() {
    return this.tracks.size
  }
}

module.exports = LibraryService
