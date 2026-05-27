const SEGMENTS_COUNT = 24

class PlayerService {
  constructor(libraryService, plannerService) {
    this.libraryService = libraryService
    this.plannerService = plannerService
    this._broadcastFn = null
    this._ws = null

    this._state = {
      playing: false,
      queue: [],
      queueIndex: -1,
      progress: 0,
      current: null,
      volume: 80,
      muted: false,
      hostIntroPlaying: false,
      hostOverlayPlaying: false,
      hostOverlayText: '',
      hostOverlayId: '',
      brainStatus: 'idle',
      ttsStatus: 'idle',
      services: [
        { name: 'netease', status: 'unknown' },
        { name: 'deepseek', status: 'unknown' },
        { name: 'tts', status: 'unknown' },
        { name: 'library', status: 'unknown' }
      ]
    }

    this._tickInterval = null
    this._segmentDuration = 7.5 // default 7.5s per segment
    this._hostDuckVolume = 0.3
    this._normalVolume = 80
    this._sleepTimerEndTime = null
    this._sleepTimerInterval = null
    this._advancing = false // guard against re-entrant _autoAdvance
    this._overlayTimer = null
  }

  setBroadcastFn(fn) {
    this._broadcastFn = fn
  }

  setWsModule(ws) {
    this._ws = ws
  }

  setHostService(hostService) {
    this.hostService = hostService
  }

  updateServiceStatus(name, status) {
    const svc = this._state.services.find(s => s.name === name)
    if (svc) svc.status = status
    this._broadcast()
  }

  getState() {
    return { ...this._state, current: this._state.current ? { ...this._state.current } : null }
  }

  getBroadcastState() {
    const s = this._state
    const current = s.current ? {
      id: s.current.id,
      type: s.current.type || 'music',
      title: s.current.title,
      artist: s.current.artist,
      source: s.current.source,
      duration: s.current.duration,
      fallback: s.current.type === 'music' && s.current.source === 'local' && !s.current.filepath
    } : null

    return {
      playing: s.playing,
      progress: s.progress,
      current,
      queue: s.queue.map(q => ({ type: q.type, id: q.id, title: q.title })),
      volume: s.volume,
      muted: s.muted,
      hostIntroPlaying: s.hostOverlayPlaying, // backward compat
      hostOverlayPlaying: s.hostOverlayPlaying,
      hostOverlayText: s.hostOverlayText || '',
      sleepTimerRemaining: this.getSleepTimerRemaining(),
      brainStatus: s.brainStatus,
      ttsStatus: (s.services.find(svc => svc.name === 'tts') || {}).status || 'idle',
      services: s.services
    }
  }

  _broadcast() {
    if (this._broadcastFn) {
      this._broadcastFn({ type: 'state', ...this.getBroadcastState() })
    }
  }

  _clearOverlay() {
    if (this._overlayTimer) {
      clearTimeout(this._overlayTimer)
      this._overlayTimer = null
    }
    this._state.hostOverlayPlaying = false
    this._state.hostOverlayText = ''
    this._state.hostOverlayId = ''
  }

  /** Consume a voice item as an overlay: set overlay state, advance past it to music */
  _consumeVoiceAsOverlay(voiceItem) {
    if (!voiceItem || voiceItem.type !== 'voice') return false

    this._clearOverlay()

    this._state.hostOverlayPlaying = true
    this._state.hostOverlayText = voiceItem.hostText || ''
    this._state.hostOverlayId = voiceItem.id || ''

    // Advance past voice to next item (must be music)
    if (this._state.queueIndex < this._state.queue.length - 1) {
      this._state.queueIndex++
      this._state.current = this._state.queue[this._state.queueIndex]
      this._updateSegmentDuration()
      this._startTicking()
    }

    // Schedule overlay end
    const voiceDuration = voiceItem.duration || 3
    this._overlayTimer = setTimeout(() => {
      this._state.hostOverlayPlaying = false
      this._state.hostOverlayText = ''
      this._state.hostOverlayId = ''
      console.log('[player] voice overlay ended')
      this._broadcast()
    }, voiceDuration * 1000)

    console.log('[player] voice overlay:', (voiceItem.hostText || '').slice(0, 50) + '...')
    return true
  }

  async start() {
    try {
      const plan = await this.plannerService.getTodayPlan()
      this._flattenPlan(plan)
      // Fire-and-forget: enrich break voice items with AI warm commentary
      this._enrichBreakCommentary().catch(e =>
        console.warn('[player] commentary enrichment error:', e.message)
      )
    } catch (e) {
      console.warn('[player] plan failed, using simple queue:', e.message)
      const tracks = this.libraryService.getAllTracks().slice(0, 10)
      this._state.queue = tracks.map(t => ({ type: 'music', ...t }))
    }

    if (this._state.queue.length > 0) {
      this._state.queueIndex = 0
      this._state.current = this._state.queue[0]
      this._state.playing = true

      // If first item is voice, consume as overlay immediately
      if (this._state.current.type === 'voice') {
        this._consumeVoiceAsOverlay(this._state.queue[0])
      }

      this._startTicking()
    }

    this._broadcast()
    console.log('[player] started with', this._state.queue.length, 'items')
  }

  async playPause() {
    if (!this._state.current) return this.getState()
    this._state.playing = !this._state.playing
    if (this._state.playing) this._startTicking()
    else this._stopTicking()
    this._broadcast()
    return this.getState()
  }

  async next() {
    if (this._state.queueIndex >= this._state.queue.length - 1) return this.getState()

    this._clearOverlay()

    this._state.queueIndex++
    this._state.current = this._state.queue[this._state.queueIndex]
    this._state.progress = 0
    this._updateSegmentDuration()

    // If the next item is a voice, consume as overlay and advance past it
    if (this._state.current && this._state.current.type === 'voice') {
      this._consumeVoiceAsOverlay(this._state.current)
    }

    // Log play for music items only
    if (this._state.current && this._state.current.type === 'music') {
      this._logPlay(this._state.current)
    }

    this._broadcast()
    return this.getState()
  }

  async previous() {
    this._clearOverlay()

    if (this._state.progress < 3 && this._state.queueIndex > 0) {
      this._state.queueIndex--
    }
    this._state.current = this._state.queue[this._state.queueIndex]
    this._state.progress = 0
    this._updateSegmentDuration()
    this._broadcast()
    return this.getState()
  }

  async play(trackId) {
    const track = this.libraryService.getTrack(trackId)
    if (!track) return this.getState()
    return this.playTrack(track)
  }

  playTrack(track) {
    this._stopTicking()
    this._clearOverlay()

    const insertAt = this._state.queueIndex + 1
    this._state.queue.splice(insertAt, 0, { type: 'music', ...track })
    this._state.queueIndex = insertAt
    this._state.current = this._state.queue[insertAt]
    this._state.progress = 0
    this._state.playing = true
    this._updateSegmentDuration()
    this._startTicking()
    this._broadcast()
    return this.getState()
  }

  addToQueue(track) {
    this._state.queue.push({ type: 'music', ...track })
    this._broadcast()
  }

  /**
   * Override the first voice item's hostText and optionally insert an NCM track
   * after it. Used by startup dynamic greeting to make the opening weather-aware.
   */
  overrideFirstVoice(greetingText, insertTrack) {
    const firstVoiceIdx = this._state.queue.findIndex(q => q.type === 'voice')
    if (firstVoiceIdx === -1) return

    const voiceItem = this._state.queue[firstVoiceIdx]
    voiceItem.hostText = greetingText
    voiceItem.duration = this._estimateVoiceDuration(greetingText)

    // Insert NCM track right after the voice, before any planned tracks
    if (insertTrack) {
      this._state.queue.splice(firstVoiceIdx + 1, 0, { type: 'music', ...insertTrack })
    }

    // If this voice is currently being played as overlay, update the overlay text
    if (this._state.hostOverlayPlaying && this._state.hostOverlayId === voiceItem.id) {
      this._state.hostOverlayText = greetingText
    }

    this._broadcast()
  }

  reshapeQueue(trackIds) {
    const newQueue = []
    for (const id of trackIds) {
      const existing = this._state.queue.find(q => q.id === id)
      if (existing) newQueue.push(existing)
    }
    if (newQueue.length > 0) {
      const currentId = this._state.current?.id
      const newIndex = newQueue.findIndex(q => q.id === currentId)
      this._state.queue = newQueue
      this._state.queueIndex = newIndex >= 0 ? newIndex : 0
      this._state.current = this._state.queue[this._state.queueIndex] || null
    }
    this._broadcast()
  }

  setVolume(level) {
    this._state.volume = Math.max(0, Math.min(100, level))
    this._broadcast()
  }

  toggleMute() {
    this._state.muted = !this._state.muted
    this._broadcast()
  }

  seekToSegment(index) {
    this._state.progress = Math.max(0, Math.min(SEGMENTS_COUNT - 1, index))
    this._broadcast()
  }

  getNextItem() {
    const nextIdx = this._state.queueIndex + 1
    if (nextIdx < this._state.queue.length) {
      return this._state.queue[nextIdx]
    }
    return null
  }

  getAudioStream(trackId, rangeHeader) {
    const track = this.libraryService.getTrack(trackId)
    if (!track || !track.filepath || !require('fs').existsSync(track.filepath)) {
      const wavTone = require('../util/wav-tone')
      const buffer = wavTone.generateWavTone(220, 5)
      return { buffer, mime: 'audio/wav', status: 200 }
    }

    const fs = require('fs')
    const stat = fs.statSync(track.filepath)
    const fileSize = stat.size

    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
      if (match) {
        const start = parseInt(match[1], 10)
        const end = match[2] ? parseInt(match[2], 10) : fileSize - 1
        const chunkSize = end - start + 1
        const stream = fs.createReadStream(track.filepath, { start, end })
        return { stream, mime: 'audio/mpeg', status: 206, headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Content-Length': chunkSize
        }}
      }
    }

    return { stream: fs.createReadStream(track.filepath), mime: 'audio/mpeg', status: 200 }
  }

  _flattenPlan(plan) {
    const queue = []

    for (const slot of plan.slots) {
      // Opening voice
      queue.push({
        type: 'voice',
        id: `voice-${slot.id}-opening`,
        hostText: slot.opening || '',
        duration: this._estimateVoiceDuration(slot.opening || '')
      })

      // Music tracks
      for (let i = 0; i < slot.tracks.length; i++) {
        const track = slot.tracks[i]
        queue.push({ type: 'music', ...track })

        // Break voice between tracks
        if (i < slot.tracks.length - 1) {
          const nextTrack = slot.tracks[i + 1]
          const fallback = `接下来是 ${nextTrack.artist} 的《${nextTrack.title}》。`
          queue.push({
            type: 'voice',
            id: `voice-${slot.id}-break-${i}`,
            hostText: fallback,
            duration: this._estimateVoiceDuration(fallback),
            _commentaryTarget: { track: nextTrack, slot }
          })
        }
      }

      // Closing voice
      queue.push({
        type: 'voice',
        id: `voice-${slot.id}-closing`,
        hostText: slot.closing || '',
        duration: this._estimateVoiceDuration(slot.closing || '')
      })
    }

    this._state.queue = queue
  }

  /** Enrich break voice items with AI-generated warm track commentary */
  async _enrichBreakCommentary() {
    if (!this.hostService) {
      console.log('[player] no hostService, skipping commentary enrichment')
      return
    }

    const targets = this._state.queue.filter(q => q._commentaryTarget)
    if (targets.length === 0) return

    console.log(`[player] enriching ${targets.length} break texts with AI commentary...`)

    await Promise.all(targets.map(async (item) => {
      const { track, slot } = item._commentaryTarget
      try {
        const commentary = await this.hostService.generateTrackCommentary(track, slot)
        if (commentary && commentary !== item.hostText) {
          item.hostText = commentary
          item.duration = this._estimateVoiceDuration(commentary)
          console.log(`[player] commentary enriched: "${track.title}" → ${commentary.slice(0, 50)}...`)
        }
      } catch (e) {
        console.warn(`[player] commentary enrichment failed for "${track?.title}":`, e.message)
      }
      // Clean up metadata no longer needed
      delete item._commentaryTarget
    }))

    // Broadcast updated state (voice items' hostText may have changed)
    this._broadcast()
    console.log('[player] commentary enrichment complete')
  }

  _estimateVoiceDuration(text) {
    if (!text) return 3
    const charCount = text.length
    return Math.max(3, Math.ceil(charCount / 4))
  }

  _updateSegmentDuration() {
    if (this._state.current && this._state.current.duration > 0) {
      this._segmentDuration = this._state.current.duration / SEGMENTS_COUNT
    } else {
      this._segmentDuration = 7.5
    }
  }

  _startTicking() {
    if (this._tickInterval) {
      clearInterval(this._tickInterval)
    }
    this._updateSegmentDuration()
    this._tickInterval = setInterval(() => this._tick(), this._segmentDuration * 1000)
  }

  _stopTicking() {
    if (this._tickInterval) {
      clearInterval(this._tickInterval)
      this._tickInterval = null
    }
  }

  _tick() {
    if (!this._state.playing || !this._state.current) return
    // In overlay mode, voice items are never the "current" item
    if (this._state.current.type === 'voice') return

    this._state.progress++

    if (this._state.progress >= SEGMENTS_COUNT) {
      this._state.progress = 0
      this._autoAdvance()
    }

    this._broadcast()
  }

  async _autoAdvance() {
    if (this._advancing) return
    this._advancing = true
    try {
      if (this._state.queueIndex < this._state.queue.length - 1) {
        this._state.queueIndex++
        this._state.current = this._state.queue[this._state.queueIndex]
        this._updateSegmentDuration()
        this._startTicking()

        if (this._state.current.type === 'voice') {
          // Voice item — consume as overlay, advancing past it to next music
          this._consumeVoiceAsOverlay(this._state.current)
        } else {
          this._logPlay(this._state.current)
        }

        this._broadcast()
      } else {
        this._state.playing = false
        this._stopTicking()
        this._broadcast()
      }
    } finally {
      this._advancing = false
    }
  }

  _logPlay(track) {
    try {
      const db = require('../db').getDb()
      db.prepare('INSERT INTO plays (title, artist, source) VALUES (?, ?, ?)').run(
        track.title || '', track.artist || '', track.source || ''
      )
    } catch { }
  }

  /* === Sleep Timer === */
  setSleepTimer(minutes) {
    this._sleepTimerEndTime = Date.now() + minutes * 60 * 1000
    if (!this._sleepTimerInterval) {
      this._sleepTimerInterval = setInterval(() => this._checkSleepTimer(), 1000)
    }
    console.log('[player] sleep timer set for', minutes, 'minutes')
    this._broadcast()
  }

  cancelSleepTimer() {
    this._sleepTimerEndTime = null
    if (this._sleepTimerInterval) {
      clearInterval(this._sleepTimerInterval)
      this._sleepTimerInterval = null
    }
    console.log('[player] sleep timer cancelled')
    this._broadcast()
  }

  getSleepTimerRemaining() {
    if (!this._sleepTimerEndTime) return 0
    const remaining = Math.round((this._sleepTimerEndTime - Date.now()) / 1000)
    if (remaining <= 0) {
      this._sleepTimerEndTime = null
      return 0
    }
    return remaining
  }

  _checkSleepTimer() {
    if (!this._sleepTimerEndTime) {
      this.cancelSleepTimer()
      return
    }
    if (Date.now() >= this._sleepTimerEndTime) {
      console.log('[player] sleep timer expired — stopping playback')
      this._sleepTimerEndTime = null
      if (this._sleepTimerInterval) {
        clearInterval(this._sleepTimerInterval)
        this._sleepTimerInterval = null
      }
      this._state.playing = false
      this._stopTicking()
      this._broadcast()
    }
  }

  getCurrentTrackUrl() {
    const current = this._state.current
    if (!current) return null
    if (current.source === 'local' && current.filepath) {
      return `/api/audio/music/${current.id}`
    }
    return current.url || null
  }

  getVoiceText(voiceId) {
    const item = this._state.queue.find(q => q.id === voiceId)
    return item && item.type === 'voice' ? (item.hostText || '') : null
  }
}

module.exports = PlayerService
