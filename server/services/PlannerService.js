const crypto = require('crypto')

// Weather-to-mood mapping helpers
const WEATHER_MOOD_MAP = {
  rainy: { energyShift: -1, tags: ['rainy-day', 'chill'] },
  snowy: { energyShift: -1, tags: ['piano', 'warm-vocal'] },
  cloudy: { energyShift: 0, tags: ['ambient', 'chill'] },
  sunny: { energyShift: 1, tags: ['light-electronic', 'rhythm-pop'] },
  hot: { energyShift: -1, tags: ['chill', 'relax'] },
  coldSunny: { energyShift: 0, tags: ['warm-vocal', 'acoustic'] },
}

const SLOT_TEMPLATES = [
  {
    id: 'morning-wake', timeRange: '07:00-09:00', title: 'Morning Wake',
    scene: 'morning', energy: 'low-to-medium',
    musicDirection: ['light-electronic', 'mandarin-pop', 'piano'],
    opening: '早上好。新的一天开始了，我们用干净轻柔的音乐慢慢唤醒感官。',
    closing: '早晨的节奏先到这里。接下来进入专注时段，准备好进入状态。'
  },
  {
    id: 'deep-work', timeRange: '09:00-12:00', title: 'Deep Work',
    scene: 'work', energy: 'medium',
    musicDirection: ['steady-groove', 'light-electronic', 'instrumental'],
    opening: '进入深度工作时段。稳定的律动帮你锚定注意力，减少干扰。',
    closing: '上午的深度工作告一段落。该休息一下了。'
  },
  {
    id: 'noon-breath', timeRange: '12:00-13:30', title: 'Noon Breath',
    scene: 'noon', energy: 'low',
    musicDirection: ['mandarin-pop', 'acoustic', 'relax'],
    opening: '午间时间。让耳朵和大脑都放松一会儿，温暖的旋律陪你吃饭休息。',
    closing: '午休结束。下午还要继续，我们慢慢进入节奏。'
  },
  {
    id: 'afternoon-drive', timeRange: '13:30-18:00', title: 'Afternoon Drive',
    scene: 'afternoon', energy: 'medium',
    musicDirection: ['rhythm-pop', 'light-electronic', 'city'],
    opening: '下午时段。用明快的节奏驱散困意，保持工作效率。',
    closing: '下午的工作进入尾声。天色渐暗，我们切换到放松模式。'
  },
  {
    id: 'evening-soften', timeRange: '18:00-21:00', title: 'Evening Soften',
    scene: 'evening', energy: 'low-to-medium',
    musicDirection: ['warm-vocal', 'neo-classical', 'chill'],
    opening: '傍晚了。节奏放缓，让温暖的人声和古典氛围包裹你。',
    closing: '夜色渐深，我们准备进入安静的深夜时段。'
  },
  {
    id: 'night-close', timeRange: '21:00-00:00', title: 'Night Close',
    scene: 'night', energy: 'low',
    musicDirection: ['late-night', 'ambient', 'piano'],
    opening: '深夜了。安静的氛围音乐陪你收束这一天。',
    closing: '今天的节目到这里。晚安，好梦。'
  }
]

const SCENE_ADJACENCY = {
  morning: ['work', 'noon'],
  work: ['morning', 'noon', 'afternoon'],
  noon: ['morning', 'work', 'afternoon'],
  afternoon: ['work', 'noon', 'evening'],
  evening: ['afternoon', 'night'],
  night: ['evening']
}

// Energy tier for each direction tag — used for conflict resolution in routine merging
const TAG_ENERGY = {
  'piano': 'low',
  'ambient': 'low',
  'neo-classical': 'low',
  'late-night': 'low',
  'rainy-day': 'low',
  'chill': 'low-to-medium',
  'relax': 'low-to-medium',
  'acoustic': 'low-to-medium',
  'warm-vocal': 'low-to-medium',
  'mandarin-pop': 'low-to-medium',
  'instrumental': 'low-to-medium',
  'light-electronic': 'medium',
  'steady-groove': 'medium',
  'rhythm-pop': 'medium',
  'city': 'medium',
}

// Low and medium conflict with each other; low-to-medium bridges both
const CONFLICTING_ENERGY = { low: 'medium', medium: 'low' }

class PlannerService {
  constructor(libraryService, profileService, ncmService, weatherService) {
    this.libraryService = libraryService
    this.profileService = profileService
    this.ncmService = ncmService
    this.weatherService = weatherService
    this._todayPlan = null
    this._todayDate = null
    this._ready = false
    this._routines = this._loadRoutines()
  }

  /**
   * Map slot properties to NCM search keywords for finding relevant tracks.
   */
  _slotToSearchKeywords(slot) {
    const dir = slot.musicDirection || []
    const scene = slot.scene || ''
    const energy = slot.energy || 'medium'

    // Build Chinese search query from music direction tags
    const tagToKeyword = {
      'piano': '钢琴',
      'ambient': '氛围',
      'light-electronic': '轻电子',
      'instrumental': '纯音乐',
      'chill': 'chill',
      'relax': '放松',
      'acoustic': '吉他 弹唱',
      'warm-vocal': '温暖 人声',
      'neo-classical': '古典 钢琴',
      'steady-groove': '节奏 律动',
      'rhythm-pop': '流行 节奏',
      'mandarin-pop': '华语 流行',
      'rainy-day': '雨 钢琴',
      'late-night': '深夜 安静',
      'city': '城市 流行',
    }

    const sceneToKeyword = {
      'morning': '清晨 醒神',
      'work': '专注 工作',
      'noon': '午间 放松',
      'afternoon': '下午 轻快',
      'evening': '傍晚 温暖',
      'night': '深夜 安静',
    }

    // Build keyword list: primary from scene, then from top direction tags
    const keywords = [sceneToKeyword[scene] || '纯音乐']
    for (const tag of dir.slice(0, 2)) {
      if (tagToKeyword[tag]) keywords.push(tagToKeyword[tag])
    }

    // De-duplicate
    return [...new Set(keywords)].join(' ')
  }

  /**
   * Fetch NCM tracks for a slot. Returns array of NCM track objects.
   */
  async _fetchNcmTracksForSlot(slot, count = 5) {
    if (!this.ncmService) return []

    const query = this._slotToSearchKeywords(slot)
    const tracks = []
    const seen = new Set()

    // Try multiple search queries for diversity
    const queries = [query]
    // Add a fallback query from the first direction tag
    const firstTag = slot.musicDirection?.[0]
    if (firstTag) {
      const tagMap = {
        'piano': '钢琴曲', 'ambient': '氛围音乐', 'light-electronic': '电子音乐',
        'instrumental': '轻音乐', 'chill': 'chill', 'relax': '放松音乐',
        'acoustic': '吉他弹唱', 'warm-vocal': '温暖治愈', 'neo-classical': '新世纪',
        'steady-groove': '纯音乐', 'rhythm-pop': '流行', 'mandarin-pop': '华语',
        'rainy-day': '雨声', 'late-night': '深夜音乐', 'city': '城市民谣'
      }
      const fallback = tagMap[firstTag]
      if (fallback) queries.push(fallback)
    }

    for (const q of queries) {
      if (tracks.length >= count) break
      try {
        const data = await this.ncmService.search(q, 1, count * 3)
        const songs = data?.result?.songs || []
        for (const song of songs) {
          const ncmId = String(song.id)
          if (seen.has(ncmId)) continue
          seen.add(ncmId)
          if (tracks.length >= count) break
          tracks.push({
            id: `ncm-${ncmId}`,
            ncmId: song.id,
            title: song.name || 'Unknown',
            artist: (song.artists || song.ar || []).map(a => a.name).join(', '),
            source: 'netease',
            duration: Math.floor((song.duration || song.dt || 0) / 1000) || 180,
            album: song.album?.name || song.al?.name || '',
          })
        }
      } catch (e) {
        console.warn('[planner] NCM search failed for:', q, e.message)
      }

      // Small delay between searches to avoid rate limiting
      if (queries.length > 1) await new Promise(r => setTimeout(r, 300))
    }

    return tracks
  }

  async init() {
    this._ready = true
    console.log('[planner] ready with', this._routines.length, 'routines')
  }

  /** Load user-defined routines from user/routines.json (with fallback to data/) */
  _loadRoutines() {
    const fs = require('fs')
    const path = require('path')
    const primaryPath = path.join(__dirname, '..', '..', 'user', 'routines.json')
    const fallbackPath = path.join(__dirname, '..', '..', 'data', 'routines.json')

    const tryLoad = (filepath) => {
      if (fs.existsSync(filepath)) {
        const raw = fs.readFileSync(filepath, 'utf-8')
        const data = JSON.parse(raw)
        return Array.isArray(data) ? data : (data.routines || [])
      }
      return null
    }

    const list = tryLoad(primaryPath) || tryLoad(fallbackPath) || []
    if (list.length > 0) {
      const source = fs.existsSync(primaryPath) ? primaryPath : fallbackPath
      console.log('[planner] loaded', list.length, 'routines from', source)
    }
    return list
  }

  /** Find a routine matching the given time (HH:MM) */
  _findRoutineForTime(timeStr) {
    if (!this._routines || this._routines.length === 0) return null
    const [h, m] = timeStr.split(':').map(Number)
    const targetMinutes = h * 60 + m
    for (const r of this._routines) {
      if (!r.timeRange) continue
      const [start, end] = r.timeRange.split('-')
      if (!start || !end) continue
      const [sh, sm] = start.split(':').map(Number)
      const [eh, em] = end.split(':').map(Number)
      const startM = sh * 60 + sm
      const endM = eh * 60 + em
      if (targetMinutes >= startM && targetMinutes < endM) return r
    }
    return null
  }

  /** Apply routine context to a slot template */
  _applyRoutineToSlot(slot) {
    const routine = this._findRoutineForTime(slot.timeRange.split('-')[0])
    if (!routine) return { slot, routineContext: null }

    // Enhance slot with routine music direction if specified
    const enhancedSlot = { ...slot }
    if (routine.musicIntent) {
      // Parse musicIntent for direction keywords to add
      const directionMap = {
        '少人声': 'instrumental',
        '稳定律动': 'steady-groove',
        '轻电子': 'light-electronic',
        '器乐': 'instrumental',
        '安静': 'piano',
        '放松': 'chill',
        '温暖': 'warm-vocal',
        '节奏': 'rhythm-pop',
        '氛围': 'ambient'
      }

      // Collect routine-intended tags (excluding dupes)
      const routineTags = []
      for (const [keyword, tag] of Object.entries(directionMap)) {
        if (routine.musicIntent.includes(keyword) && !enhancedSlot.musicDirection.includes(tag)) {
          routineTags.push(tag)
        }
      }

      if (routineTags.length > 0) {
        // Conflict resolution: if routine tags have an opposing energy to slot defaults,
        // remove conflicting slot directions
        const firstRoutineEnergy = TAG_ENERGY[routineTags[0]]
        const conflictEnergy = CONFLICTING_ENERGY[firstRoutineEnergy]
        if (conflictEnergy) {
          enhancedSlot.musicDirection = enhancedSlot.musicDirection.filter(
            tag => TAG_ENERGY[tag] !== conflictEnergy
          )
        }

        // Append routine tags (de-duped)
        for (const tag of routineTags) {
          if (!enhancedSlot.musicDirection.includes(tag)) {
            enhancedSlot.musicDirection.push(tag)
          }
        }
      }
    }

    if (routine.opening) enhancedSlot.opening = routine.opening
    if (routine.closing) enhancedSlot.closing = routine.closing

    const routineContext = {
      source: routine.source || 'local-routine-v1',
      label: routine.label || '',
      activity: routine.activity || '',
      intent: routine.intent || '',
      musicIntent: routine.musicIntent || '',
      displayStyles: routine.displayStyles || [],
      timeRange: routine.timeRange || ''
    }

    return { slot: enhancedSlot, routineContext }
  }

  /**
   * Map weather conditions to mood adjustments for slot tuning.
   */
  _mapWeatherToMood(weather) {
    if (!weather || weather.status !== 'ready') return { mood: null, energyShift: 0, tags: [] }

    const summary = weather.summary || ''
    const temp = weather.temperature

    if (summary.includes('雨') || summary.includes('drizzle') || summary.includes('thunder')) {
      return { mood: 'rainy', ...WEATHER_MOOD_MAP.rainy }
    }
    if (summary.includes('雪') || summary.includes('snow')) {
      return { mood: 'snowy', ...WEATHER_MOOD_MAP.snowy }
    }
    if (summary.includes('阴') || summary.includes('多云') || summary.includes('cloud') || summary.includes('overcast')) {
      return { mood: 'cloudy', ...WEATHER_MOOD_MAP.cloudy }
    }
    if (summary.includes('晴') || summary.includes('sun') || summary.includes('clear')) {
      if (temp >= 35) return { mood: 'hot', ...WEATHER_MOOD_MAP.hot }
      if (temp <= 5) return { mood: 'coldSunny', ...WEATHER_MOOD_MAP.coldSunny }
      return { mood: 'sunny', ...WEATHER_MOOD_MAP.sunny }
    }

    return { mood: null, energyShift: 0, tags: [] }
  }

  getSlots() {
    return SLOT_TEMPLATES
  }

  getCurrentSlot() {
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    for (const slot of SLOT_TEMPLATES) {
      const [start, end] = slot.timeRange.split('-')
      const [sh, sm] = start.split(':').map(Number)
      const [eh, em] = end.split(':').map(Number)
      const startM = sh * 60 + sm
      const endM = eh * 60 + em
      if (currentMinutes >= startM && currentMinutes < endM) {
        return { ...slot }
      }
    }

    // Before 7am → night-close; after midnight → night-close
    return { ...SLOT_TEMPLATES[5] }
  }

  async getTodayPlan() {
    const today = new Date().toISOString().slice(0, 10)

    if (this._todayDate === today && this._todayPlan) {
      return this._todayPlan
    }

    // Check DB
    const db = require('../db').getDb()
    const existing = db.prepare('SELECT * FROM daily_programs WHERE date = ?').get(today)

    if (existing) {
      this._todayPlan = JSON.parse(existing.plan_json)
      this._todayDate = today
      return this._todayPlan
    }

    return this.generateTodayPlan()
  }

  async generateTodayPlan() {
    const today = new Date()
    const dateStr = today.toISOString().slice(0, 10)
    const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()]

    const profile = this.profileService ? this.profileService.enrichProfileForPlanning() : {}

    // Fetch weather for weather-aware planning
    let weather = null
    let weatherMood = null
    if (this.weatherService) {
      try {
        weather = await this.weatherService.getWeather()
        weatherMood = this._mapWeatherToMood(weather)
        if (weatherMood.mood) {
          console.log('[planner] weather:', weather.summary, `${weather.temperature}°C → mood:`, weatherMood.mood)
        }
      } catch (e) {
        console.warn('[planner] weather fetch failed:', e.message)
      }
    }

    // Apply user routines to slot templates and fetch NCM tracks in parallel
    let currentRoutineContext = null

    const slotEntries = SLOT_TEMPLATES.map(slot => {
      const { slot: adaptedSlot, routineContext } = this._applyRoutineToSlot(slot)
      if (routineContext) currentRoutineContext = routineContext

      // Apply profile preferences: remove disliked tags, promote preferred tags
      const prefTags = profile.preferredTags || []
      const disTags = profile.dislikedTags || []
      if (prefTags.length > 0 || disTags.length > 0) {
        const dirs = adaptedSlot.musicDirection
        // Remove disliked tags
        const filtered = dirs.filter(t => !disTags.includes(t))
        // Sort preferred tags to front (in profile order), preserve remaining order
        const prefSet = new Set(prefTags)
        const preferredDirs = prefTags.filter(t => filtered.includes(t))
        const remainingDirs = filtered.filter(t => !prefSet.has(t))
        adaptedSlot.musicDirection = preferredDirs.length > 0 || remainingDirs.length > 0
          ? [...preferredDirs, ...remainingDirs]
          : dirs // fallback if filtering emptied the list
      }

      // Apply weather mood to slot (prepend weather tags, adjust energy)
      if (weatherMood && weatherMood.tags.length > 0) {
        for (const tag of weatherMood.tags) {
          if (!adaptedSlot.musicDirection.includes(tag)) {
            adaptedSlot.musicDirection.unshift(tag)
          }
        }
        if (weatherMood.energyShift < 0 && adaptedSlot.energy !== 'low') {
          adaptedSlot.energy = adaptedSlot.energy === 'low-to-medium' ? 'low' : 'low-to-medium'
        } else if (weatherMood.energyShift > 0 && adaptedSlot.energy !== 'medium') {
          adaptedSlot.energy = adaptedSlot.energy === 'low' ? 'low-to-medium' : adaptedSlot.energy
        }
      }

      return adaptedSlot
    })

    // Fetch NCM tracks for all slots in parallel
    const ncmResults = await Promise.all(
      slotEntries.map(slot =>
        this.ncmService
          ? this._fetchNcmTracksForSlot(slot, 5)
          : Promise.resolve([])
      )
    )

    const slotsWithTracks = slotEntries.map((adaptedSlot, i) => {
      let tracks = ncmResults[i]

      // Fallback to library if NCM returns nothing
      if (tracks.length === 0) {
        const allTracks = this.libraryService.getAllTracks()
        const scored = allTracks.map(track => {
          const result = this._scoreTrackForSlot(track, adaptedSlot, profile)
          return result
        })
        scored.sort((a, b) => b.score - a.score)
        const selected = scored.slice(0, 5)
        tracks = selected.map(s => {
          const t = this.libraryService.getTrack(s.trackId)
          return t ? { ...t } : null
        }).filter(Boolean)
      }

      return {
        ...adaptedSlot,
        routineContext: currentRoutineContext,
        tracks
      }
    })

    const allSlotTracks = slotsWithTracks.flatMap(s => s.tracks || [])
    const uniqueTrackIds = new Set(allSlotTracks.map(t => t.id))

    const plan = {
      date: dateStr,
      weekday,
      host: 'Codio',
      generatedAt: new Date().toISOString(),
      source: currentRoutineContext ? 'planner-v1-with-routine' : 'planner-v1',
      routineContext: currentRoutineContext,
      slots: slotsWithTracks,
      weather: weather && weatherMood ? {
        summary: weather.summary,
        temperature: weather.temperature,
        city: weather.city,
        mood: weatherMood.mood
      } : null,
      libraryAnalysis: {
        totalTracks: uniqueTrackIds.size,
        source: allSlotTracks.length > 0 && allSlotTracks[0].source === 'netease' ? 'netease' : 'local'
      },
      listenerProfile: profile
    }

    // Persist
    try {
      const db = require('../db').getDb()
      db.prepare(`
        INSERT INTO daily_programs (date, weekday, host, generated_at, source, plan_json)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(dateStr, weekday, 'Codio', new Date().toISOString(), 'planner-v1', JSON.stringify(plan))
    } catch (e) {
      console.warn('[planner] persist failed:', e.message)
    }

    this._todayPlan = plan
    this._todayDate = dateStr
    console.log('[planner] generated plan for', dateStr)
    return plan
  }

  async regeneratePlan() {
    this._todayPlan = null
    this._todayDate = null

    const today = new Date().toISOString().slice(0, 10)
    try {
      const db = require('../db').getDb()
      db.prepare('DELETE FROM daily_programs WHERE date = ?').run(today)
    } catch { }

    return this.generateTodayPlan()
  }

  _scoreTrackForSlot(track, slot, profile) {
    let score = 0
    const breakdown = {}

    // 1. Scene match: +12
    if (track.sceneFit && track.sceneFit.includes(slot.scene)) {
      score += 12; breakdown.sceneMatch = 12
    }

    // 2. Time association: +4
    const adjacent = SCENE_ADJACENCY[slot.scene] || []
    if (track.sceneFit && track.sceneFit.some(s => adjacent.includes(s))) {
      score += 4; breakdown.timeAssoc = 4
    }

    // 3. Energy match: +6
    if (track.energy === slot.energy) {
      score += 6; breakdown.energyMatch = 6
    }

    // 4. Direction match: +5/tag
    const directionHits = (track.tags || []).filter(t => slot.musicDirection.includes(t))
    if (directionHits.length > 0) {
      score += directionHits.length * 5
      breakdown.directionMatch = directionHits.length * 5
    }

    // 5. Preference match: +4/tag
    const prefTags = profile.preferredTags || []
    const prefHits = (track.tags || []).filter(t => prefTags.includes(t))
    if (prefHits.length > 0) {
      score += prefHits.length * 4
      breakdown.preferenceMatch = prefHits.length * 4
    }

    // 6. Dislike penalty: -12/tag
    const disTags = profile.dislikedTags || []
    const disHits = (track.tags || []).filter(t => disTags.includes(t))
    if (disHits.length > 0) {
      score -= disHits.length * 12
      breakdown.dislikePenalty = -disHits.length * 12
    }

    // 7. Language match: +3
    const prefLang = profile.preferredLanguage
    if (prefLang && track.language === prefLang) {
      score += 3; breakdown.languageMatch = 3
    }

    // 8. Local first: +8
    if (track.source === 'local') {
      score += 8; breakdown.localFirst = 8
    }

    return { trackId: track.id, score, breakdown }
  }

  _getTagDistribution(tracks) {
    const dist = {}
    for (const t of tracks) {
      for (const tag of (t.tags || [])) {
        dist[tag] = (dist[tag] || 0) + 1
      }
    }
    return dist
  }

  /** Generate a break text between two consecutive tracks */
  generateBreakText(prevTrack, nextTrack) {
    const templates = [
      `接下来是 ${nextTrack.artist} 的《${nextTrack.title}》。`,
      `${prevTrack.title} 之后，我们来听 ${nextTrack.artist} 的这首《${nextTrack.title}》。`,
      `换一首风格。${nextTrack.artist}，《${nextTrack.title}》。`,
    ]
    return templates[Math.floor(Math.random() * templates.length)]
  }

  getSlotById(slotId) {
    return SLOT_TEMPLATES.find(s => s.id === slotId) || null
  }
}

module.exports = PlannerService
