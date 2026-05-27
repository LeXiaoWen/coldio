/* ── coldio Frontend ── */

/* === Dot Matrix Clock Patterns === */
const DIGIT_PATTERNS = {
  '0': [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,1,1],[1,0,1,0,1],[1,1,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  '1': [[0,0,1,0,0],[0,1,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,1,1,1,0]],
  '2': [[0,1,1,1,0],[1,0,0,0,1],[0,0,0,0,1],[0,0,0,1,0],[0,0,1,0,0],[0,1,0,0,0],[1,1,1,1,1]],
  '3': [[1,1,1,1,0],[0,0,0,0,1],[0,0,0,0,1],[0,1,1,1,0],[0,0,0,0,1],[0,0,0,0,1],[1,1,1,1,0]],
  '4': [[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,1],[0,0,0,0,1],[0,0,0,0,1],[0,0,0,0,1]],
  '5': [[1,1,1,1,1],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,0],[0,0,0,0,1],[0,0,0,0,1],[1,1,1,1,0]],
  '6': [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,0],[1,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  '7': [[1,1,1,1,1],[0,0,0,0,1],[0,0,0,1,0],[0,0,1,0,0],[0,1,0,0,0],[0,1,0,0,0],[0,1,0,0,0]],
  '8': [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  '9': [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,1],[0,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]]
}

/* === State === */
const coolState = {
  playing: false,
  progress: 0,
  current: null,
  queue: [],
  volume: 80,
  muted: false,
  hostIntroPlaying: false,
  brainStatus: 'idle',
  ttsStatus: 'idle',
  services: [],
  messages: [],
  feedbackState: {}, // messageId → feedbackType
  profile: null,
  plannerSlot: null,
  slots: [],
  lyrics: [],
  translatedLyrics: [],
  lyricsOpen: false,
  favoritedTrackIds: new Set()
}

let ws = null
let wsReconnectTimer = null
let audioEl = null
let overlayAudioEl = null
let audioContext = null
let userInteracted = false

/* === DOM Ready === */
document.addEventListener('DOMContentLoaded', () => {
  renderDotMatrixClock()
  startClock()
  renderProgressBar()
  renderVolumeSlider()
  bindControls()
  connectWebSocket()
  initAudio()
  loadChatHistory()
  document.getElementById('chatClear').addEventListener('click', clearChatHistory)
  initSearch()
  initLyrics()
  initSlots()
  initVoiceInput()
  loadFavorites()
  fetchWeather()
  setInterval(fetchWeather, 300000)
  initInitPanel()
  initProfilePanel()
  initHistoryPanel()
  initSleepTimer()
  initRoutinesPanel()
  loadProfile()
  initNcmLogin()
  _ensureVoice()

  // Register service worker for offline support
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(e => {
      console.warn('[sw] registration failed:', e)
    })
  }

  // Touch listener to unlock audio — also resume playback on first interaction
  let _interacted = false
  function _onFirstInteraction() {
    if (_interacted) return
    _interacted = true
    userInteracted = true
    console.log('[app] first interaction — starting playback')
    // Create and resume AudioContext (browser autoplay policy requires user gesture)
    if (!_audioCtx) {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (_audioCtx.state === 'suspended') {
      _audioCtx.resume()
    }
    // Start playback for the current track — always play audio on first interaction
    const current = coolState.current
    if (current && audioEl) {
      const isVoice = current.type === 'voice' || String(current.id).startsWith('voice-')
      console.log('[app] resume: type=' + current.type + ' id=' + current.id + ' isVoice=' + isVoice + ' playing=' + coolState.playing)
      if (isVoice) {
        const voiceUrl = `/api/audio/voice/${current.id}`
        if (coolState.ttsStatus === 'idle' || coolState.ttsStatus === 'degraded') {
          speakHostText(current.id)
        } else if (overlayAudioEl) {
          overlayAudioEl.src = voiceUrl
          overlayAudioEl.play().catch(() => speakHostText(current.id))
        }
      } else {
        const isNcm = current.source === 'netease' || String(current.id).startsWith('ncm-')
        const audioUrl = isNcm
          ? `/api/audio/ncm/${String(current.id).replace(/^ncm-/, '')}`
          : `/api/audio/music/${current.id}`
        playMusic(audioUrl)
      }

      // Guard: prevent applyState from stopMusic()-ing during toggle race
      _firstPlayGuard = true

      // If there's a pending overlay TTS deferred by autoplay policy, speak now
      // We check hostOverlayText directly rather than hostIntroPlaying because
      // the overlay may have already ended by the time user interacts.
      if (coolState.hostOverlayText && coolState.hostOverlayText !== _lastOverlayText) {
        _triggerOverlayTTS(coolState.hostOverlayText)
      }

      // Resume server playback if paused
      if (!coolState.playing) {
        fetch('/api/playback/toggle', { method: 'POST' }).catch(() => {})
      }

      // Auto-clear guard after 2s — plenty of time for toggle to propagate
      setTimeout(() => { _firstPlayGuard = false }, 2000)
    } else {
      console.log('[app] resume: no current track yet (ws not connected?)')
    }
  }
  document.addEventListener('click', _onFirstInteraction, { once: true })
  document.addEventListener('touchstart', _onFirstInteraction, { once: true })
})

/* === Dot Matrix Clock === */
function renderDotMatrixClock() {
  const container = document.getElementById('dotMatrixClock')
  container.innerHTML = ''

  // 8 digits (HH:MM = 4 digits) + 1 colon
  const digitChars = ['0','0','0','0']
  const colonIndex = 2

  for (let i = 0; i < digitChars.length; i++) {
    if (i === colonIndex) {
      const colon = document.createElement('div')
      colon.className = 'colon-group'
      colon.id = 'colonGroup'
      // 7 rows, 1 col — rows 2 and 4 are lit
      for (let r = 0; r < 7; r++) {
        const cell = document.createElement('div')
        cell.className = 'dot-cell'
        if (r === 2 || r === 4) {
          cell.classList.add('colon-on')
          cell.id = 'colonDot'
        } else {
          cell.classList.add('colon-off')
        }
        colon.appendChild(cell)
      }
      container.appendChild(colon)
    }

    const group = document.createElement('div')
    group.className = 'digit-group'
    group.dataset.index = i

    // Build 5x7 grid
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 5; c++) {
        const cell = document.createElement('div')
        cell.className = 'dot-cell off'
        cell.dataset.row = r
        cell.dataset.col = c
        group.appendChild(cell)
      }
    }
    container.appendChild(group)
  }
}

function startClock() {
  updateClock()
  setInterval(updateClock, 1000)
}

function updateClock() {
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const digits = (hh + mm).split('')

  // Update date display
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${days[now.getDay()]}`
  document.getElementById('dateDisplay').textContent = dateStr

  // Update digit groups
  const groups = document.querySelectorAll('.digit-group')
  for (let i = 0; i < groups.length; i++) {
    const digit = digits[i] || '0'
    const pattern = DIGIT_PATTERNS[digit] || DIGIT_PATTERNS['0']
    const cells = groups[i].querySelectorAll('.dot-cell')
    let idx = 0
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 5; c++) {
        const cell = cells[idx]
        if (pattern[r][c]) {
          cell.className = 'dot-cell on'
        } else {
          cell.className = 'dot-cell off'
        }
        idx++
      }
    }
  }

  // Blink colon: toggle every second (CSS animation handles it)
}

/* === Progress Bar === */
function renderProgressBar() {
  const bar = document.getElementById('progressBar')
  bar.innerHTML = ''
  for (let i = 0; i < 24; i++) {
    const seg = document.createElement('div')
    seg.className = 'progress-segment'
    seg.dataset.index = i
    seg.addEventListener('click', () => seekToSegment(i))
    bar.appendChild(seg)
  }
}

function updateProgressBar(activeSegment) {
  const segments = document.querySelectorAll('.progress-segment')
  segments.forEach((seg, i) => {
    seg.className = 'progress-segment'
    if (i < activeSegment) seg.classList.add('filled')
    else if (i === activeSegment) seg.classList.add('active')
  })
}

function seekToSegment(index) {
  fetch('/api/playback/seek', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ segment: index })
  }).catch(() => {})
  // Seek the audio element to the corresponding position (local music only)
  // NCM proxy doesn't support range requests so seeking would restart audio
  const isNcm = coolState.current?.source === 'netease' || String(coolState.current?.id || '').startsWith('ncm-')
  if (audioEl && coolState.current && coolState.current.type !== 'voice' && !isNcm && coolState.current.duration) {
    audioEl.currentTime = (index / 24) * coolState.current.duration
  }
}

/* === Volume Slider === */
function renderVolumeSlider() {
  const slider = document.getElementById('volumeSlider')
  slider.innerHTML = ''
  for (let i = 0; i < 10; i++) {
    const seg = document.createElement('div')
    seg.className = 'volume-segment'
    seg.dataset.level = (i + 1) * 10
    seg.addEventListener('click', () => setVolume((i + 1) * 10))
    slider.appendChild(seg)
  }
}

function updateVolumeSlider(volume, muted) {
  const segments = document.querySelectorAll('.volume-segment')
  const level = Math.round(volume / 10)
  segments.forEach((seg, i) => {
    seg.className = 'volume-segment'
    if (muted) seg.classList.add('muted')
    else if (i < level) seg.classList.add('filled')
  })

  const volIcon = document.getElementById('volumeIcon')
  if (volIcon) {
    volIcon.src = muted ? '/assets/icons/mute.svg' : '/assets/icons/volume.svg'
  }
}

function setVolume(level) {
  fetch('/api/playback/volume', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level })
  }).catch(() => {})
  coolState.volume = level
  if (audioEl) audioEl.volume = (coolState.muted ? 0 : level) / 100
  updateVolumeSlider(level, coolState.muted)
}

/* === Audio === */
let _currentVoiceId = null
let _audioCtx = null
let _analyser = null
let _analyserSource = null
let _levelRaf = null

function initAudio() {
  audioEl = new Audio()
  audioEl.volume = 0.8

  audioEl.addEventListener('timeupdate', () => {
    _syncLyrics()
  })

  audioEl.addEventListener('ended', () => {
    // For the startup greeting voice, advance to the next track when audio finishes
    if (coolState.current && coolState.current.id && coolState.current.id.endsWith('-dyn')) {
      fetch('/api/playback/next', { method: 'POST' }).catch(() => {})
    }
  })

  audioEl.addEventListener('error', (e) => {
    console.warn('[audio] error:', e)
  })

  audioEl.addEventListener('play', () => {
    _startLevelMeter()
  })

  // Separate audio element for host voice overlays (plays on top of music)
  overlayAudioEl = new Audio()
  overlayAudioEl.volume = 0.8
}

function _startLevelMeter() {
  if (_levelRaf) return
  try {
    if (!_audioCtx) {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    }
    // Resume if suspended — safety net in case _onFirstInteraction didn't run
    if (_audioCtx.state === 'suspended') {
      _audioCtx.resume()
    }
    if (!_analyser) {
      _analyser = _audioCtx.createAnalyser()
      _analyser.fftSize = 256
    }
    // Reconnect source if audio element changed
    if (!_analyserSource || _analyserSource.mediaElement !== audioEl) {
      _analyserSource = _audioCtx.createMediaElementSource(audioEl)
      _analyserSource.connect(_analyser)
      _analyser.connect(_audioCtx.destination)
    }
  } catch (e) {
    // AudioContext may not be available or already connected
    if (e.name === 'InvalidStateError') return
    console.warn('[audio] analyser unavailable:', e.message)
    return
  }

  const bufferLength = _analyser.frequencyBinCount
  const dataArray = new Uint8Array(bufferLength)
  const bandCount = 7
  const bandSize = Math.floor(bufferLength / bandCount)
  // Per-band smoothed values for hysteresis
  const smoothed = new Array(bandCount).fill(0)

  function tick() {
    if (!_analyser) { _levelRaf = null; return }
    _analyser.getByteFrequencyData(dataArray)

    for (let b = 0; b < bandCount; b++) {
      const start = b * bandSize
      const end = b === bandCount - 1 ? bufferLength : start + bandSize
      let sum = 0
      for (let i = start; i < end; i++) sum += dataArray[i]
      const raw = sum / (end - start) / 255
      // Smooth each band independently
      smoothed[b] += (raw - smoothed[b]) * 0.25
      document.documentElement.style.setProperty(`--audio-level-${b}`, smoothed[b])
    }

    _levelRaf = requestAnimationFrame(tick)
  }
  _levelRaf = requestAnimationFrame(tick)
}

function speakHostText(voiceId) {
  if (!window.speechSynthesis) return
  if (_currentVoiceId === voiceId) return
  _currentVoiceId = voiceId

  window.speechSynthesis.cancel()

  fetch(`/api/audio/voice/${encodeURIComponent(voiceId)}/text`)
    .then(r => r.json())
    .then(data => {
      if (!data.text) return
      const utterance = new SpeechSynthesisUtterance(data.text)
      utterance.lang = 'zh-CN'
      utterance.rate = 0.9
      utterance.pitch = 1.0
      utterance.volume = coolState.muted ? 0 : coolState.volume / 100
      window.speechSynthesis.speak(utterance)
    })
    .catch(() => {})
}

function speakOverlayText(text) {
  if (!text || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-CN'
  utterance.rate = 0.9
  utterance.pitch = 1.0
  utterance.volume = coolState.muted ? 0 : Math.round(coolState.volume * 0.7) / 100
  window.speechSynthesis.speak(utterance)
}

/* === Text-to-Speech === */

function _currentTrackUrl() {
  const track = coolState.current
  if (!track) return null
  if (track.type === 'voice' || String(track.id).startsWith('voice-')) {
    return `/api/audio/voice/${track.id}`
  }
  const isNcm = track.source === 'netease' || String(track.id).startsWith('ncm-')
  return isNcm
    ? `/api/audio/ncm/${String(track.id).replace(/^ncm-/, '')}`
    : `/api/audio/music/${track.id}`
}

let _ttsCleanup = null

function speakText(text) {
  if (!text || coolState.muted || !userInteracted) return

  // Clean up any previous TTS handlers
  if (_ttsCleanup) _ttsCleanup()

  const restoreUrl = _currentTrackUrl()

  // Try server TTS (火山引擎) first — higher quality, consistent voice
  const ttsUrl = `/api/audio/speak?text=${encodeURIComponent(text)}`
  audioEl.pause()
  audioEl.src = ttsUrl
  audioEl.volume = coolState.muted ? 0 : coolState.volume / 100
  audioEl.play().catch(() => {
    // TTS API unavailable — fall back to speechSynthesis
    _ttsCleanup = null
    _speakFallback(text, restoreUrl)
  })

  const onEnd = () => {
    _ttsCleanup = null
    audioEl.removeEventListener('ended', onEnd)
    audioEl.removeEventListener('error', onError)
    if (restoreUrl) {
      audioEl.src = restoreUrl
      audioEl.volume = coolState.muted ? 0 : coolState.volume / 100
      audioEl.play().catch(() => {})
    }
  }
  const onError = () => {
    _ttsCleanup = null
    audioEl.removeEventListener('ended', onEnd)
    audioEl.removeEventListener('error', onError)
    // TTS stream error — try speechSynthesis fallback
    _speakFallback(text, restoreUrl)
  }
  audioEl.addEventListener('ended', onEnd)
  audioEl.addEventListener('error', onError)
  _ttsCleanup = () => {
    audioEl.removeEventListener('ended', onEnd)
    audioEl.removeEventListener('error', onError)
    _ttsCleanup = null
  }
}

function _speakFallback(text, restoreUrl) {
  // Duck music volume during speechSynthesis
  const ducked = coolState.muted ? 0 : Math.round(coolState.volume * 0.3)
  audioEl.volume = (coolState.muted ? 0 : ducked) / 100

  if (window.speechSynthesis) {
    window.speechSynthesis.cancel()
    _speakSegments(text, () => {
      audioEl.volume = (coolState.muted ? 0 : coolState.volume) / 100
    })
  } else if (restoreUrl) {
    audioEl.src = restoreUrl
    audioEl.play().catch(() => {})
  }
}

/* === Speech Segments (Chrome ~15s limit workaround) === */
let _speechVoiceCache = null
let _speechVoiceLoaded = false

function _ensureVoice() {
  if (!_speechVoiceLoaded && window.speechSynthesis) {
    _speechVoiceLoaded = true
    const voices = window.speechSynthesis.getVoices()
    if (voices.length > 0) {
      _speechVoiceCache = voices.find(v => v.lang.startsWith('zh')) || null
    } else {
      // Voices not ready yet — listen for load event
      window.speechSynthesis.addEventListener('voiceschanged', () => {
        _speechVoiceCache = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('zh')) || null
      }, { once: true })
    }
  }
}

function _splitSpeechSegments(text) {
  // Split at Chinese/English sentence boundaries, then sub-split long segments
  const raw = text.split(/(?<=[。！？.!?\n])/).map(s => s.trim()).filter(Boolean)
  const segments = []
  for (const part of raw) {
    if (part.length <= 100) {
      segments.push(part)
    } else {
      // Further split long segments at comma/space boundaries
      let start = 0
      while (start < part.length) {
        let end = Math.min(start + 100, part.length)
        if (end < part.length) {
          // Try to break at a comma or space
          const comma = part.lastIndexOf('，', end)
          const comma2 = part.lastIndexOf(',', end)
          const space = part.lastIndexOf(' ', end)
          const breakAt = Math.max(comma, comma2, space)
          if (breakAt > start + 30) end = breakAt + 1
        }
        segments.push(part.slice(start, end).trim())
        start = end
      }
    }
  }
  return segments
}

function _speakSegments(text, onDone) {
  if (!window.speechSynthesis) { if (onDone) onDone(); return }

  _ensureVoice()
  const segments = _splitSpeechSegments(text)
  let idx = 0

  function speakNext() {
    if (idx >= segments.length) {
      if (onDone) onDone()
      return
    }

    const segment = segments[idx]
    const utterance = new SpeechSynthesisUtterance(segment)
    utterance.lang = 'zh-CN'
    utterance.rate = 0.9
    utterance.pitch = 1.0
    utterance.volume = coolState.muted ? 0 : coolState.volume / 100

    if (_speechVoiceCache) {
      utterance.voice = _speechVoiceCache
    }

    utterance.onend = () => {
      idx++
      speakNext()
    }

    window.speechSynthesis.speak(utterance)
  }

  speakNext()
}

function playMusic(url) {
  if (!userInteracted || !audioEl) return
  if (!url) return

  audioEl.src = url
  audioEl.volume = coolState.muted ? 0 : coolState.volume / 100
  audioEl.play().catch(e => console.warn('[audio] play failed:', e.message))
}

function stopMusic() {
  if (audioEl) {
    audioEl.pause()
    // Don't set src='' — browsers resolve empty src to the page URL,
    // causing audio errors. Use a silent WAV data URI instead.
    audioEl.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='
  }
}

/* === WebSocket === */
function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsUrl = `${protocol}//${location.host}/stream`

  try {
    ws = new WebSocket(wsUrl)
  } catch (e) {
    scheduleReconnect()
    return
  }

  ws.onopen = () => {
    updateConnectionStatus('CONNECTED')
  }

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      handleWsMessage(data)
    } catch (e) {
      console.warn('[ws] parse error:', e)
    }
  }

  ws.onclose = () => {
    updateConnectionStatus('DISCONNECTED')
    scheduleReconnect()
  }

  ws.onerror = () => {
    ws.close()
  }
}

function scheduleReconnect() {
  if (wsReconnectTimer) return
  wsReconnectTimer = setTimeout(() => {
    wsReconnectTimer = null
    connectWebSocket()
  }, 3000)
}

function handleWsMessage(data) {
  switch (data.type) {
    case 'state':
      applyState(data)
      break
    case 'slot':
      applySlot(data.slot)
      break
    case 'shutdown':
      updateConnectionStatus('DISCONNECTED')
      break
  }
}

/* === State & Audio Ducking === */
let _savedVolume = 80
let _prevHostPlaying = false
let _lastTrackId = null
let _lastOverlayText = ''
let _firstPlayGuard = false  // prevents stopMusic() during first-interaction race window

function _triggerOverlayTTS(text) {
  if (!text || !overlayAudioEl) return
  _lastOverlayText = text
  const ttsUrl = `/api/audio/speak?text=${encodeURIComponent(text)}`

  if (coolState.ttsStatus === 'idle' || coolState.ttsStatus === 'degraded') {
    speakOverlayText(text)
    return
  }

  // Try server TTS (Doubao) — use fetch to detect HTTP errors reliably.
  // The server now returns 503 when TTS is unavailable, instead of a beep tone.
  fetch(ttsUrl)
    .then(res => {
      if (!res.ok) throw new Error('TTS server returned ' + res.status)
      return res.blob()
    })
    .then(blob => {
      const url = URL.createObjectURL(blob)
      overlayAudioEl.src = url
      overlayAudioEl.play().catch(() => {
        URL.revokeObjectURL(url)
        speakOverlayText(text)
      })
    })
    .catch(() => {
      speakOverlayText(text)
    })
}

function applyState(state) {
  coolState.playing = state.playing
  coolState.progress = state.progress
  coolState.hostIntroPlaying = state.hostIntroPlaying
  coolState.brainStatus = state.brainStatus
  coolState.ttsStatus = state.ttsStatus

  if (state.current) coolState.current = state.current
  if (state.queue) coolState.queue = state.queue

  // Track change → fetch lyrics + update heart
  const currentId = coolState.current?.id
  if (currentId && currentId !== _lastTrackId) {
    _lastTrackId = currentId
    coolState.lyrics = []
    if (coolState.lyricsOpen) fetchLyricsForCurrentTrack()
    updateHeartButton()
  }
  if (state.volume !== undefined) coolState.volume = state.volume
  if (state.muted !== undefined) coolState.muted = state.muted
  if (state.sleepTimerRemaining !== undefined) {
    coolState.sleepTimerRemaining = state.sleepTimerRemaining
    renderSleepTimer(state.sleepTimerRemaining)
  }

  renderNowPlaying()
  updateProgressBar(state.progress)
  updatePlayButton()
  updateHostVoiceIndicator(state.hostIntroPlaying)
  updateVolumeSlider(state.volume, state.muted)

  // Host Overlay Ducking + TTS — trigger on text changes too, not just transitions
  if (state.hostOverlayPlaying) {
    const textChanged = state.hostOverlayText && state.hostOverlayText !== _lastOverlayText
    const overlayJustStarted = state.hostOverlayPlaying && !_prevHostPlaying

    if (textChanged || overlayJustStarted) {
      // Duck volume only on first overlay start, not on every text update
      if (overlayJustStarted) {
        _savedVolume = audioEl ? audioEl.volume : (coolState.volume / 100)
        const ducked = Math.round(coolState.volume * 0.3)
        if (audioEl) audioEl.volume = (coolState.muted ? 0 : ducked) / 100
      }
      // Save current overlay text so first-interaction handler can use it
      coolState.hostOverlayText = state.hostOverlayText
      // Only play TTS if user has already interacted (browser autoplay policy)
      if (userInteracted && state.hostOverlayText) {
        _triggerOverlayTTS(state.hostOverlayText)
      }
    }
  } else if (!state.hostOverlayPlaying && _prevHostPlaying) {
    if (audioEl) audioEl.volume = (coolState.muted ? 0 : _savedVolume) / 100
    // Stop overlay audio
    if (overlayAudioEl) {
      overlayAudioEl.pause()
      overlayAudioEl.src = ''
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel()
  }
  _prevHostPlaying = state.hostOverlayPlaying

  // Sync audio playback for the current track
  if (state.playing && state.current && state.current.id) {
    const trackId = state.current.id
    const isVoice = state.current.type === 'voice' || String(trackId).startsWith('voice-')
    console.log('[app] sync: id=' + trackId + ' voice=' + isVoice + ' ttsStatus=' + state.ttsStatus + ' src=' + (audioEl ? audioEl.src : 'null') + ' ui=' + userInteracted)

    if (isVoice) {
      // In overlay mode, voice items are consumed as overlays server-side.
      // The "current" track should always be music. If it's still a voice
      // item (legacy/fallback), use speechSynthesis directly.
      const voiceUrl = `/api/audio/voice/${trackId}`
      if (audioEl && audioEl.src !== location.origin + voiceUrl) {
        if (state.ttsStatus === 'idle' || state.ttsStatus === 'degraded') {
          speakHostText(trackId)
        } else {
          // Use fetch to detect server TTS errors; fall back to speechSynthesis
          fetch(voiceUrl)
            .then(res => {
              if (!res.ok) throw new Error('TTS unavailable')
              return res.blob()
            })
            .then(blob => {
              const url = URL.createObjectURL(blob)
              if (overlayAudioEl) {
                overlayAudioEl.src = url
                overlayAudioEl.play().catch(() => {
                  URL.revokeObjectURL(url)
                  speakHostText(trackId)
                })
              }
            })
            .catch(() => speakHostText(trackId))
        }
      }
    } else {
      const isNcm = state.current.source === 'netease' || String(trackId).startsWith('ncm-')
      const audioUrl = isNcm
        ? `/api/audio/ncm/${String(trackId).replace(/^ncm-/, '')}`
        : `/api/audio/music/${trackId}`
      if (audioEl && audioEl.src !== location.origin + audioUrl) {
        playMusic(audioUrl)
      }
    }
  } else if (!state.playing && !_firstPlayGuard) {
    stopMusic()
    if (overlayAudioEl) { overlayAudioEl.pause(); overlayAudioEl.src = '' }
    if (window.speechSynthesis) window.speechSynthesis.cancel()
  }
  // Clear the guard once we receive a valid playing state from server
  if (state.playing) _firstPlayGuard = false
}

function applySlot(slot) {
  if (!slot) return
  coolState.plannerSlot = slot
  const label = document.getElementById('slotLabel')
  label.textContent = `${slot.title} · ${slot.timeRange}`
  renderNowPlaying()
}

/* === Render Functions === */
function renderNowPlaying() {
  const titleEl = document.getElementById('trackTitle')
  const artistEl = document.getElementById('trackArtist')
  const sourceEl = document.getElementById('trackSource')
  const dirEl = document.getElementById('trackDirection')

  const track = coolState.current
  if (!track) {
    titleEl.textContent = '[LOADING...]'
    artistEl.textContent = ''
    sourceEl.textContent = 'Codio Selection'
    dirEl.textContent = ''
    return
  }

  titleEl.textContent = track.title || '[untitled]'
  artistEl.textContent = track.artist || ''
  if (track.source === 'netease') {
    sourceEl.textContent = 'Netease Music'
  } else if (track.source === 'local') {
    sourceEl.textContent = track.fallback ? 'Local Library [FALLBACK]' : 'Local Library'
  } else {
    sourceEl.textContent = 'Codio Selection'
  }

  // Music direction from planner slot
  const slot = coolState.plannerSlot
  if (slot && slot.musicDirection && slot.musicDirection.length > 0) {
    dirEl.textContent = slot.musicDirection.join(' / ')
  } else {
    dirEl.textContent = ''
  }
}

function updatePlayButton() {
  const icon = document.getElementById('playIcon')
  if (icon) {
    icon.src = coolState.playing ? '/assets/icons/pause.svg' : '/assets/icons/play.svg'
  }
}

function updateHostVoiceIndicator(active) {
  const el = document.getElementById('hostVoiceIndicator')
  if (el) {
    el.style.display = active ? 'block' : 'none'
  }
}

function updateConnectionStatus(status) {
  const el = document.getElementById('connectionStatus')
  if (el) {
    el.textContent = status
    el.className = 'footer-status' + (status === 'DISCONNECTED' ? ' disconnected' : '')
  }
}

/* === Weather === */
function fetchWeather() {
  fetch('/api/weather')
    .then(r => r.json())
    .then(data => {
      coolState.weather = data
      renderWeather(data)
    })
    .catch(() => {})
}

function renderWeather(data) {
  const widget = document.getElementById('weatherWidget')
  if (!widget) return
  if (!data || data.status !== 'ready') {
    widget.style.display = 'none'
    return
  }
  widget.style.display = 'flex'
  document.getElementById('weatherTemp').textContent = `${data.temperature}°`
  document.getElementById('weatherDesc').textContent = data.summary
}

function updateHeartButton() {
  const btn = document.getElementById('btnHeart')
  if (!btn) return
  const track = coolState.current
  if (!track || !track.id) {
    btn.classList.remove('active')
    return
  }
  // Check local set first, then server
  if (coolState.favoritedTrackIds.has(track.id)) {
    btn.classList.add('active')
  } else {
    fetch(`/api/favorites/check/${encodeURIComponent(track.id)}`)
      .then(r => r.json())
      .then(data => {
        if (data.favorited) {
          coolState.favoritedTrackIds.add(track.id)
          btn.classList.add('active')
        } else {
          btn.classList.remove('active')
        }
      })
      .catch(() => { btn.classList.remove('active') })
  }
}

function loadFavorites() {
  fetch('/api/favorites')
    .then(r => r.json())
    .then(data => {
      if (data.favorites) {
        coolState.favoritedTrackIds = new Set(data.favorites.map(f => f.track_id))
      }
    })
    .catch(() => {})
}

/* === Chat === */
function loadChatHistory() {
  fetch('/api/chat')
    .then(r => r.json())
    .then(data => {
      if (data.messages) {
        coolState.messages = data.messages
        _saveMessagesToLocal()
        renderAllMessages()
        // Load persisted feedback state
        loadFeedbackState()
      }
    })
    .catch(() => {
      // Server offline — try localStorage fallback
      const local = _loadMessagesFromLocal()
      if (local && local.length > 0) {
        coolState.messages = local
        renderAllMessages()
      }
    })
}

/* === localStorage Chat Backup === */
const CHAT_STORAGE_KEY = 'coldio-chat'

function _saveMessagesToLocal() {
  try { localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(coolState.messages)) } catch {}
}

function _loadMessagesFromLocal() {
  try {
    const data = localStorage.getItem(CHAT_STORAGE_KEY)
    return data ? JSON.parse(data) : null
  } catch { return null }
}

function clearChatHistory() {
  fetch('/api/chat', { method: 'DELETE' })
    .then(r => r.json())
    .then(() => {
      coolState.messages = []
      coolState.feedbackState = {}
      try { localStorage.removeItem(CHAT_STORAGE_KEY) } catch {}
      loadChatHistory()
    })
    .catch(() => {})
}

function loadFeedbackState() {
  fetch('/api/memory/feedback')
    .then(r => r.json())
    .then(data => {
      if (data.feedback) {
        coolState.feedbackState = {}
        for (const fb of data.feedback) {
          coolState.feedbackState[fb.message_id] = fb.feedback_type
        }
        // Re-render messages to show saved feedback state
        const hostMessages = document.querySelectorAll('.message-row.host')
        hostMessages.forEach(row => {
          const idAttr = row.id
          if (!idAttr) return
          const msgId = idAttr.replace('msg-', '')
          const savedType = coolState.feedbackState[msgId]
          if (savedType) {
            const btns = row.querySelectorAll('.feedback-btn')
            btns.forEach(btn => {
              if (btn.dataset.type === savedType) {
                btn.textContent = '[SAVED]'
                btn.disabled = true
                btn.classList.add('saved')
              }
            })
          }
        })
      }
    })
    .catch(() => {})
}

function renderAllMessages() {
  const container = document.getElementById('chatMessages')
  container.innerHTML = ''
  for (const msg of coolState.messages) {
    renderMessage(msg)
  }
  container.scrollTop = container.scrollHeight
}

function renderMessage(msg) {
  const container = document.getElementById('chatMessages')
  const row = document.createElement('div')
  row.className = `message-row ${msg.role === 'host' ? 'host' : 'user'}`
  row.id = `msg-${msg.id}`

  // Avatar
  const avatar = document.createElement('div')
  avatar.className = 'message-avatar'
  if (msg.role === 'host') {
    avatar.innerHTML = '<img src="/assets/icons/codio-avatar.svg" alt="C">'
  } else {
    avatar.textContent = 'U'
  }

  const content = document.createElement('div')
  content.className = 'message-content'

  const header = document.createElement('div')
  header.className = 'message-header'
  header.textContent = `${msg.nickname || (msg.role === 'host' ? 'Codio' : '你')} · ${formatTime(msg.created_at)}`
  content.appendChild(header)

  const bubble = document.createElement('div')
  bubble.className = 'message-bubble'
  bubble.textContent = msg.content
  content.appendChild(bubble)

  // Feedback for host messages
  if (msg.role === 'host') {
    const feedback = renderFeedbackBar(msg.id)
    content.appendChild(feedback)
  }

  row.appendChild(avatar)
  row.appendChild(content)
  container.appendChild(row)
  container.scrollTop = container.scrollHeight
}

function renderFeedbackBar(messageId) {
  const bar = document.createElement('div')
  bar.className = 'feedback-bar'

  const types = [
    { label: '[like]', value: 'like' },
    { label: '[dislike]', value: 'dislike' },
    { label: '[more like]', value: 'more_like_this' },
    { label: '[less like]', value: 'less_like_this' }
  ]

  types.forEach(t => {
    const btn = document.createElement('button')
    btn.className = 'feedback-btn'
    btn.textContent = t.label
    btn.dataset.type = t.value
    btn.addEventListener('click', () => submitFeedback(messageId, t.value, btn))
    bar.appendChild(btn)
  })

  return bar
}

function submitFeedback(messageId, type, btn) {
  const msg = coolState.messages.find(m => m.id === messageId)
  const track = coolState.current

  const body = {
    messageId: String(messageId),
    feedbackType: type,
    userMessage: msg?.content || '',
    slotId: coolState.plannerSlot?.id || '',
    slotTitle: coolState.plannerSlot?.title || '',
    track: track ? { title: track.title, artist: track.artist, source: track.source } : {},
    musicDirection: coolState.plannerSlot?.musicDirection?.join(', ') || '',
    scene: coolState.plannerSlot?.scene || '',
    mood: ''
  }

  fetch('/api/memory/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).catch(() => {})

  // Save to local state for persistence across re-renders
  coolState.feedbackState[String(messageId)] = type

  // Refresh profile data to reflect updated track preferences
  loadProfile()

  btn.textContent = '[SAVED]'
  btn.disabled = true
  btn.classList.add('saved')
}

function formatTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

/* === Chat Input === */
function sendChatMessage() {
  const input = document.getElementById('chatInput')
  const text = input.value.trim()
  if (!text) return
  input.value = ''

  // Optimistically show user message
  const userMsg = {
    id: Date.now(),
    role: 'user',
    nickname: '你',
    content: text,
    created_at: new Date().toISOString()
  }
  coolState.messages.push(userMsg)
  _saveMessagesToLocal()
  renderMessage(userMsg)

  // Send to server
  fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text })
  })
    .then(r => r.json())
    .then(data => {
      if (data.reply) {
        const hostMsg = {
          id: Date.now() + 1,
          role: 'host',
          nickname: 'Codio',
          content: data.reply,
          created_at: new Date().toISOString()
        }
        coolState.messages.push(hostMsg)
        _saveMessagesToLocal()
        renderMessage(hostMsg)
        // Speak the host's reply aloud
        speakText(data.reply)
      }
      if (data.slot) applySlot(data.slot)
    })
    .catch(() => {
      const errMsg = {
        id: Date.now() + 1,
        role: 'host',
        nickname: 'Codio',
        content: '[CONNECTION LOST]',
        created_at: new Date().toISOString()
      }
      coolState.messages.push(errMsg)
      _saveMessagesToLocal()
      renderMessage(errMsg)
    })
}

/* === Search (NCM) === */
function initSearch() {
  const btnSearch = document.getElementById('btnSearch')
  const btnSearchClose = document.getElementById('btnSearchClose')
  const panel = document.getElementById('searchPanel')
  const input = document.getElementById('searchInput')
  const results = document.getElementById('searchResults')

  btnSearch.addEventListener('click', () => {
    const shown = panel.style.display !== 'none'
    panel.style.display = shown ? 'none' : 'block'
    if (!shown) {
      input.focus()
    } else {
      results.style.display = 'none'
      results.innerHTML = ''
    }
  })

  btnSearchClose.addEventListener('click', () => {
    panel.style.display = 'none'
    results.style.display = 'none'
    results.innerHTML = ''
    input.value = ''
  })

  let searchTimer = null
  input.addEventListener('input', () => {
    clearTimeout(searchTimer)
    const q = input.value.trim()
    if (q.length < 2) {
      results.style.display = 'none'
      return
    }
    searchTimer = setTimeout(() => doSearch(q), 400)
  })

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      clearTimeout(searchTimer)
      doSearch(input.value.trim())
    }
  })
}

async function doSearch(q) {
  const results = document.getElementById('searchResults')
  results.innerHTML = '<div class="search-status">[SEARCHING...]</div>'
  results.style.display = 'block'

  try {
    const r = await fetch(`/api/search?keywords=${encodeURIComponent(q)}&type=1&limit=10`)
    const data = await r.json()
    renderSearchResults(data)
  } catch (e) {
    results.innerHTML = '<div class="search-status">[SEARCH FAILED]</div>'
  }
}

function renderSearchResults(data) {
  const container = document.getElementById('searchResults')
  container.innerHTML = ''

  const songs = data?.result?.songs
  if (!songs || songs.length === 0) {
    container.innerHTML = '<div class="search-status">[NO RESULTS]</div>'
    container.style.display = 'block'
    return
  }

  for (const song of songs) {
    const item = document.createElement('div')
    item.className = 'search-result-item'

    const info = document.createElement('div')
    info.className = 'search-result-info'

    const title = document.createElement('div')
    title.className = 'search-result-title'
    title.textContent = song.name || '[untitled]'

    const artist = document.createElement('div')
    artist.className = 'search-result-artist'
    artist.textContent = (song.artists || song.ar || []).map(a => a.name).join(', ')

    info.appendChild(title)
    info.appendChild(artist)

    const playBtn = document.createElement('button')
    playBtn.className = 'search-result-play'
    playBtn.textContent = '[PLAY]'
    playBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      playNcmTrack(song)
    })

    item.appendChild(info)
    item.appendChild(playBtn)
    container.appendChild(item)
  }

  container.style.display = 'block'
}

async function playNcmTrack(song) {
  const track = {
    id: `ncm-${song.id}`,
    title: song.name || '',
    artist: (song.artists || song.ar || []).map(a => a.name).join(', '),
    source: 'netease',
    duration: Math.floor((song.duration || song.dt || 0) / 1000) || 30,
    ncmId: song.id,
    album: song.album?.name || song.al?.name || ''
  }

  try {
    const r = await fetch('/api/queue/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track })
    })
    const result = await r.json()
    if (result.ok) {
      // Auto-play by sending play command
      await fetch('/api/playback/next', { method: 'POST' })
    }
  } catch (e) {
    console.warn('[ncm] failed to add track:', e)
  }
}

/* ── Overlay Panel System ── */
let _activeOverlayPanel = null

function closeAllOverlays() {
  // Close slideovers
  document.querySelectorAll('.panel-slideover, .panel-slideover-top').forEach(el => {
    el.classList.remove('panel-slideover', 'panel-slideover-top')
    el.style.display = 'none'
  })
  // Close overlay backdrop
  const backdrop = document.getElementById('panelOverlayBackdrop')
  if (backdrop) {
    backdrop.remove()
  }
  _activeOverlayPanel = null
}

function _openOverlay(panelId, type = 'slideover') {
  // Close any existing overlay first
  closeAllOverlays()

  const panel = document.getElementById(panelId)
  if (!panel) return

  // Create backdrop
  const backdrop = document.createElement('div')
  backdrop.className = 'panel-overlay'
  backdrop.id = 'panelOverlayBackdrop'
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeAllOverlays()
  })
  document.body.appendChild(backdrop)

  // Show panel as overlay
  panel.style.display = 'block'
  panel.classList.add(type === 'slideover-top' ? 'panel-slideover-top' : 'panel-slideover')

  _activeOverlayPanel = panelId
}

// Close overlays on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && _activeOverlayPanel) {
    closeAllOverlays()
  }
})

/* === Slots Panel === */
function initSlots() {
  document.getElementById('slotToggle').addEventListener('click', toggleSlotsPanel)
  fetchTodayPlan()
}

function toggleSlotsPanel() {
  const panel = document.getElementById('slotsPanel')
  const isOverlay = panel.classList.contains('panel-slideover-top') || panel.classList.contains('panel-slideover')
  if (isOverlay) {
    closeAllOverlays()
    return
  }
  _openOverlay('slotsPanel', 'slideover-top')
  if (coolState.slots.length > 0) renderSlots()
}

async function fetchTodayPlan() {
  try {
    const r = await fetch('/api/planner/today')
    const data = await r.json()
    if (data && data.slots) {
      coolState.slots = data.slots
      if (document.getElementById('slotsPanel').style.display !== 'none') {
        renderSlots()
      }
    }
  } catch (e) {
    console.warn('[slots] fetch plan failed:', e.message)
  }
}

function renderSlots() {
  const container = document.getElementById('slotsList')
  const currentSlotId = coolState.plannerSlot?.id

  container.innerHTML = coolState.slots.map(slot => {
    const isCurrent = slot.id === currentSlotId
    const trackCount = slot.tracks ? slot.tracks.length : 0
    return `
      <div class="slot-card ${isCurrent ? 'current' : ''}" data-slot-id="${slot.id}">
        <span class="slot-card-indicator"></span>
        <div class="slot-card-info">
          <div class="slot-card-title">${slot.title}</div>
          <div class="slot-card-meta">${slot.timeRange} · ${(slot.musicDirection || []).join(' / ')}</div>
        </div>
        <span class="slot-card-tracks">${trackCount} tracks</span>
      </div>
    `
  }).join('')
}

/* === Profile Panel === */
function initProfilePanel() {
  document.getElementById('profileToggle').addEventListener('click', toggleProfilePanel)
}

function toggleProfilePanel() {
  const panel = document.getElementById('profilePanel')
  const isOverlay = panel.classList.contains('panel-slideover')
  if (isOverlay) {
    closeAllOverlays()
    return
  }
  _openOverlay('profilePanel', 'slideover')
  if (coolState.profile) renderProfilePanel()
}

function loadProfile() {
  fetch('/api/memory/profile')
    .then(r => r.json())
    .then(data => {
      coolState.profile = data
      // Re-render if panel is open
      const el = document.getElementById('profilePanel')
      if (el && (el.classList.contains('panel-slideover') || el.style.display !== 'none')) {
        renderProfilePanel()
      }
    })
    .catch(() => {})
}

function renderProfilePanel() {
  const profile = coolState.profile
  if (!profile) return

  const favContainer = document.getElementById('favoriteTracksList')
  const disContainer = document.getElementById('dislikedTracksList')

  favContainer.innerHTML = (!profile.favoriteTracks || profile.favoriteTracks.length === 0)
    ? '<div class="profile-empty">[no liked tracks yet]</div>'
    : profile.favoriteTracks.map(t =>
        `<div class="profile-track-item"><span class="profile-track-title">${escapeHtml(t.title)}</span><span class="profile-track-artist">${escapeHtml(t.artist || '')}</span><span class="profile-track-count">(${t.count})</span></div>`
      ).join('')

  disContainer.innerHTML = (!profile.dislikedTracks || profile.dislikedTracks.length === 0)
    ? '<div class="profile-empty">[no disliked tracks yet]</div>'
    : profile.dislikedTracks.map(t =>
        `<div class="profile-track-item"><span class="profile-track-title">${escapeHtml(t.title)}</span><span class="profile-track-artist">${escapeHtml(t.artist || '')}</span><span class="profile-track-count">(${t.count})</span></div>`
      ).join('')
}

function escapeHtml(str) {
  if (!str) return ''
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/* === History Panel === */
function initHistoryPanel() {
  document.getElementById('historyToggle').addEventListener('click', toggleHistoryPanel)
}

function toggleHistoryPanel() {
  const panel = document.getElementById('historyPanel')
  const isOverlay = panel.classList.contains('panel-slideover')
  if (isOverlay) {
    closeAllOverlays()
    return
  }
  _openOverlay('historyPanel', 'slideover')
  loadHistory()
}

function loadHistory() {
  fetch('/api/history/plays')
    .then(r => r.json())
    .then(data => {
      const container = document.getElementById('historyList')
      if (!data.plays || data.plays.length === 0) {
        container.innerHTML = '<div class="history-empty">[no play history yet]</div>'
        return
      }
      container.innerHTML = data.plays.map(p =>
        `<div class="history-item">
          <span class="history-title">${escapeHtml(p.title)}</span>
          <span class="history-artist">${escapeHtml(p.artist || '')}</span>
          <span class="history-time">${p.played_at ? p.played_at.slice(11, 16) : ''}</span>
        </div>`
      ).join('')
    })
    .catch(() => {
      document.getElementById('historyList').innerHTML = '<div class="history-empty">[failed to load history]</div>'
    })
}

/* === Lyrics === */
function initLyrics() {
  document.getElementById('lyricsToggle').addEventListener('click', toggleLyrics)
}

function toggleLyrics() {
  const panel = document.getElementById('lyricsPanel')
  coolState.lyricsOpen = !coolState.lyricsOpen
  panel.style.display = coolState.lyricsOpen ? 'block' : 'none'
  document.getElementById('lyricsToggleLabel').textContent = coolState.lyricsOpen ? '[- LYRICS]' : '[+ LYRICS]'
  if (coolState.lyricsOpen && coolState.lyrics.length === 0) {
    fetchLyricsForCurrentTrack()
  }
  if (coolState.lyricsOpen && coolState.lyrics.length > 0) {
    renderLyrics()
  }
}

async function fetchLyricsForCurrentTrack() {
  const track = coolState.current
  if (!track) return

  // Extract NCM ID from track id (format: ncm-123456)
  const ncmId = track.ncmId || (String(track.id).startsWith('ncm-') ? String(track.id).replace('ncm-', '') : null)
  if (!ncmId) {
    coolState.lyrics = []
    renderLyrics()
    return
  }

  try {
    const r = await fetch(`/api/lyric?id=${ncmId}`)
    const data = await r.json()
    if (data?.lrc?.lyric) {
      coolState.lyrics = parseLrc(data.lrc.lyric)
      coolState.translatedLyrics = data.tlyric?.lyric ? parseLrc(data.tlyric.lyric) : []
      renderLyrics()
    } else {
      coolState.lyrics = [{ time: 0, text: '[no lyrics available]' }]
      renderLyrics()
    }
  } catch (e) {
    console.warn('[lyrics] fetch failed:', e.message)
    coolState.lyrics = [{ time: 0, text: '[unable to load lyrics]' }]
    renderLyrics()
  }
}

function parseLrc(lrcText) {
  const lines = lrcText.split('\n')
  const parsed = []
  const timeRe = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/
  for (const line of lines) {
    const match = line.match(timeRe)
    if (match) {
      const minutes = parseInt(match[1])
      const seconds = parseInt(match[2])
      const millis = parseInt(match[3].length === 2 ? match[3] + '0' : match[3])
      const time = minutes * 60 + seconds + millis / 1000
      const text = line.replace(timeRe, '').trim()
      if (text) parsed.push({ time, text })
    }
  }
  return parsed.sort((a, b) => a.time - b.time)
}

function renderLyrics() {
  const container = document.getElementById('lyricsContent')
  if (!coolState.lyrics || coolState.lyrics.length === 0) {
    container.innerHTML = '<div class="lyrics-placeholder">no lyrics available</div>'
    return
  }
  container.innerHTML = coolState.lyrics.map((l, i) => {
    const translated = coolState.translatedLyrics?.[i]?.text
    return `<div class="lyrics-line-group" data-index="${i}">` +
      `<div class="lyrics-line" data-index="${i}">${l.text}</div>` +
      (translated ? `<div class="lyrics-line-translated" data-index="${i}">${translated}</div>` : '') +
      `</div>`
  }).join('')
  _lyricsActiveIndex = -1
}

/* === Lyrics Sync === */
let _lyricsActiveIndex = -1

function _syncLyrics() {
  if (!coolState.lyrics || coolState.lyrics.length === 0) return
  const currentTime = audioEl ? audioEl.currentTime : 0

  // Find the last line whose time <= currentTime
  let activeIdx = -1
  for (let i = 0; i < coolState.lyrics.length; i++) {
    if (coolState.lyrics[i].time <= currentTime) {
      activeIdx = i
    } else {
      break // times are sorted ascending
    }
  }

  if (activeIdx === _lyricsActiveIndex) return // no change

  _lyricsActiveIndex = activeIdx

  const container = document.getElementById('lyricsContent')
  const lines = container.querySelectorAll('.lyrics-line')
  const translatedLines = container.querySelectorAll('.lyrics-line-translated')
  lines.forEach((el, i) => {
    el.classList.toggle('active', i === activeIdx)
  })
  translatedLines.forEach((el, i) => {
    el.classList.toggle('active', i === activeIdx)
  })

  // Scroll to keep active line visible
  if (activeIdx >= 0 && lines[activeIdx]) {
    const activeEl = lines[activeIdx]
    const containerRect = container.getBoundingClientRect()
    const activeRect = activeEl.getBoundingClientRect()
    if (activeRect.top < containerRect.top || activeRect.bottom > containerRect.bottom) {
      activeEl.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }
}

/* === Sleep Timer === */
function initSleepTimer() {
  document.getElementById('timerBtn').addEventListener('click', cycleSleepTimer)
}

function cycleSleepTimer() {
  const current = coolState.sleepTimerRemaining || 0
  // Cycle: Off → 30 → 60 → 90 → Off
  let minutes = 0
  if (current <= 0) minutes = 30
  else if (current <= 35 * 60) minutes = 60
  else if (current <= 65 * 60) minutes = 90
  else minutes = 0

  fetch('/api/playback/sleeptimer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ minutes })
  }).catch(() => {})
}

function renderSleepTimer(remaining) {
  const el = document.getElementById('timerBtn')
  if (!el) return
  if (remaining > 0) {
    const m = Math.floor(remaining / 60)
    const s = remaining % 60
    el.textContent = `[${m}:${String(s).padStart(2, '0')}]`
    el.classList.add('active')
  } else {
    el.textContent = '[TIMER]'
    el.classList.remove('active')
  }
}

/* === Routines Editor === */
function initRoutinesPanel() {
  document.getElementById('routinesToggle').addEventListener('click', toggleRoutinesEditor)
}

let _routinesData = []

function toggleRoutinesEditor() {
  const panel = document.getElementById('routinesPanel')
  const isOverlay = panel.classList.contains('panel-slideover')
  if (isOverlay) {
    closeAllOverlays()
    return
  }
  _openOverlay('routinesPanel', 'slideover')
  loadRoutines()
}

function loadRoutines() {
  fetch('/api/routines')
    .then(r => r.json())
    .then(data => {
      _routinesData = data.routines || []
      renderRoutinesEditor()
    })
    .catch(() => {
      document.getElementById('routinesEditor').innerHTML = '<div class="routines-empty">[failed to load routines]</div>'
    })
}

function renderRoutinesEditor() {
  const container = document.getElementById('routinesEditor')
  if (_routinesData.length === 0) {
    container.innerHTML = '<div class="routines-empty">[no routines yet]</div><button class="routines-add-btn" onclick="addRoutine()">[+ ADD ROUTINE]</button>'
    return
  }

  let html = ''
  for (let i = 0; i < _routinesData.length; i++) {
    const r = _routinesData[i]
    html += `<div class="routine-card">
      <div class="routine-card-header">
        <input class="routine-input routine-label-input" value="${escapeHtml(r.label)}" data-idx="${i}" data-field="label" placeholder="Label">
        <span class="routine-delete" onclick="deleteRoutine(${i})">[×]</span>
      </div>
      <input class="routine-input" value="${escapeHtml(r.timeRange || '')}" data-idx="${i}" data-field="timeRange" placeholder="timeRange (e.g. 09:00-12:00)">
      <input class="routine-input" value="${escapeHtml(r.activity || '')}" data-idx="${i}" data-field="activity" placeholder="Activity description">
      <input class="routine-input" value="${escapeHtml(r.intent || '')}" data-idx="${i}" data-field="intent" placeholder="Intent">
      <input class="routine-input" value="${escapeHtml(r.musicIntent || '')}" data-idx="${i}" data-field="musicIntent" placeholder="Music intent (e.g. 少人声、稳定律动)">
      <input class="routine-input" value="${escapeHtml((r.displayStyles || []).join(', '))}" data-idx="${i}" data-field="displayStyles" placeholder="Display styles (comma separated)">
    </div>`
  }
  html += '<button class="routines-add-btn" onclick="addRoutine()">[+ ADD ROUTINE]</button>'
  html += '<button class="routines-save-btn" onclick="saveRoutines()">[SAVE ALL]</button>'
  container.innerHTML = html

  // Bind input change listeners
  container.querySelectorAll('.routine-input').forEach(input => {
    input.addEventListener('change', onRoutineFieldChange)
  })
}

function onRoutineFieldChange(e) {
  const idx = parseInt(e.target.dataset.idx)
  const field = e.target.dataset.field
  const val = e.target.value
  if (idx >= 0 && idx < _routinesData.length) {
    if (field === 'displayStyles') {
      _routinesData[idx][field] = val.split(',').map(s => s.trim()).filter(Boolean)
    } else {
      _routinesData[idx][field] = val
    }
    _routinesData[idx].source = _routinesData[idx].source || 'local-routine-v1'
  }
}

function addRoutine() {
  _routinesData.push({
    source: 'local-routine-v1',
    label: '',
    activity: '',
    intent: '',
    musicIntent: '',
    displayStyles: [],
    timeRange: ''
  })
  renderRoutinesEditor()
  // Scroll to bottom
  const container = document.getElementById('routinesEditor')
  setTimeout(() => { container.scrollTop = container.scrollHeight }, 50)
}

function deleteRoutine(idx) {
  _routinesData.splice(idx, 1)
  renderRoutinesEditor()
}

function saveRoutines() {
  fetch('/api/routines', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ routines: _routinesData })
  })
    .then(r => r.json())
    .then(data => {
      if (data.ok) {
        const btn = document.querySelector('.routines-save-btn')
        if (btn) { btn.textContent = '[SAVED]'; setTimeout(() => { btn.textContent = '[SAVE ALL]' }, 2000) }
      }
    })
    .catch(() => {})
}

/* === Voice Input === */
let _recognition = null
let _recording = false
let _silenceTimer = null

function initVoiceInput() {
  const btn = document.getElementById('btnMic')
  if (!btn) return
  btn.addEventListener('click', toggleVoiceInput)
}

function toggleVoiceInput() {
  if (_recording) {
    stopVoiceInput(true) // submit if there's text
    return
  }
  startVoiceInput()
}

function startVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SpeechRecognition) {
    document.getElementById('chatInput').placeholder = 'voice input not supported'
    return
  }

  if (_recognition) {
    _recognition.abort()
  }

  _recognition = new SpeechRecognition()
  _recognition.lang = 'zh-CN'
  _recognition.continuous = true       // stay active across speech pauses
  _recognition.interimResults = true
  _recognition.maxAlternatives = 1

  const btn = document.getElementById('btnMic')
  const input = document.getElementById('chatInput')
  btn.classList.add('recording')
  input.placeholder = 'listening...'
  _recording = true

  const _resetSilenceTimer = () => {
    if (_silenceTimer) clearTimeout(_silenceTimer)
    _silenceTimer = setTimeout(() => {
      // Auto-submit after 2s of silence
      if (_recording && input.value.trim()) {
        sendChatMessage()
      }
      _silenceTimer = null
    }, 2000)
  }

  _recognition.onresult = (event) => {
    let interim = ''
    let final = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript
      if (event.results[i].isFinal) {
        final += transcript
      } else {
        interim += transcript
      }
    }
    input.value = final || interim
    _resetSilenceTimer()
  }

  _recognition.onend = () => {
    if (_recording && input.value.trim()) {
      sendChatMessage()
    }
    btn.classList.remove('recording')
    input.placeholder = "tell me how you're feeling..."
    _recording = false
    if (_silenceTimer) { clearTimeout(_silenceTimer); _silenceTimer = null }
  }

  _recognition.onerror = (event) => {
    console.warn('[voice] error:', event.error)
    btn.classList.remove('recording')
    input.placeholder = "tell me how you're feeling..."
    _recording = false
    if (_silenceTimer) { clearTimeout(_silenceTimer); _silenceTimer = null }
  }

  _recognition.start()
}

function stopVoiceInput(submitIfText) {
  if (_silenceTimer) { clearTimeout(_silenceTimer); _silenceTimer = null }
  if (_recording && submitIfText && document.getElementById('chatInput').value.trim()) {
    sendChatMessage()
  }
  if (_recognition) {
    _recognition.stop()
    _recognition = null
  }
  const btn = document.getElementById('btnMic')
  btn.classList.remove('recording')
  document.getElementById('chatInput').placeholder = "tell me how you're feeling..."
  _recording = false
}

/* === Init Panel === */
function initInitPanel() {
  const btnInit = document.getElementById('btnInit')
  const panel = document.getElementById('initPanel')
  const btnClose = document.getElementById('btnInitClose')
  const btnParse = document.getElementById('btnParseReview')
  const btnSave = document.getElementById('btnSaveInit')
  const parseStatus = document.getElementById('parseStatus')

  btnInit.addEventListener('click', () => {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none'
    parseStatus.textContent = ''
  })

  btnClose.addEventListener('click', () => {
    panel.style.display = 'none'
  })

  // Tag toggle for multi-select groups
  document.querySelectorAll('.init-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.closest('.init-tag-group')
      // Single-select group (energy)
      if (btn.classList.contains('init-tag-single')) {
        group.querySelectorAll('.init-tag').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
      } else {
        // Multi-select
        btn.classList.toggle('active')
      }
    })
  })

  // Parse review via DeepSeek
  btnParse.addEventListener('click', async () => {
    const text = document.getElementById('reviewInput').value.trim()
    if (!text) {
      parseStatus.textContent = '[请输入锐评文本]'
      return
    }
    parseStatus.textContent = '[解析中...]'
    btnParse.disabled = true

    try {
      const r = await fetch('/api/memory/parse-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })
      const data = await r.json()
      if (data.ok && data.preferences) {
        applyParsedPreferences(data.preferences)
        parseStatus.textContent = '[解析完成，标签已自动勾选]'
      } else {
        parseStatus.textContent = '[解析失败: ' + (data.error || 'unknown') + ']'
      }
    } catch (e) {
      parseStatus.textContent = '[解析请求失败]'
    }
    btnParse.disabled = false
  })

  // Save & init
  btnSave.addEventListener('click', async () => {
    const prefs = getInitPreferences()
    try {
      const r = await fetch('/api/memory/init-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs)
      })
      const data = await r.json()
      if (data.ok) {
        panel.style.display = 'none'
        parseStatus.textContent = ''
        // Refresh profile-dependent data
        if (window.fetchTodayPlan) fetchTodayPlan()
      } else {
        parseStatus.textContent = '[保存失败: ' + (data.error || 'unknown') + ']'
      }
    } catch (e) {
      parseStatus.textContent = '[保存请求失败]'
    }
  })
}

function applyParsedPreferences(prefs) {
  // Clear previous selections
  document.querySelectorAll('.init-tag').forEach(b => b.classList.remove('active'))

  // Apply preferred directions
  for (const dir of (prefs.preferredDirections || [])) {
    const btn = document.querySelector(`#preferredTags .init-tag[data-tag="${dir}"]`)
    if (btn) btn.classList.add('active')
  }

  // Apply disliked directions
  for (const dir of (prefs.dislikedDirections || [])) {
    const btn = document.querySelector(`#dislikedTags .init-tag[data-tag="${dir}"]`)
    if (btn) btn.classList.add('active')
  }

  // Apply scenes
  for (const scene of (prefs.favoriteScenes || [])) {
    const btn = document.querySelector(`#sceneTags .init-tag[data-tag="${scene}"]`)
    if (btn) btn.classList.add('active')
  }

  // Apply avoided scenes
  for (const scene of (prefs.avoidedScenes || [])) {
    const btn = document.querySelector(`#avoidedSceneTags .init-tag[data-tag="${scene}"]`)
    if (btn) btn.classList.add('active')
  }

  // Apply energy
  if (prefs.preferredEnergy) {
    const btn = document.querySelector(`#energyTags .init-tag[data-tag="${prefs.preferredEnergy}"]`)
    if (btn) btn.classList.add('active')
  }
}

function getInitPreferences() {
  const getActiveTags = (containerId) => {
    return Array.from(document.querySelectorAll(`#${containerId} .init-tag.active`)).map(b => b.dataset.tag)
  }

  return {
    preferredDirections: getActiveTags('preferredTags'),
    dislikedDirections: getActiveTags('dislikedTags'),
    favoriteScenes: getActiveTags('sceneTags'),
    avoidedScenes: getActiveTags('avoidedSceneTags'),
    preferredEnergy: (document.querySelector('#energyTags .init-tag.active') || {}).dataset?.tag || 'medium'
  }
}

/* === Controls Binding === */
function bindControls() {
  document.getElementById('btnPlayPause').addEventListener('click', () => {
    fetch('/api/playback/toggle', { method: 'POST' }).catch(() => {})
  })

  document.getElementById('btnNext').addEventListener('click', () => {
    fetch('/api/playback/next', { method: 'POST' }).catch(() => {})
  })

  document.getElementById('btnPrev').addEventListener('click', () => {
    fetch('/api/playback/previous', { method: 'POST' }).catch(() => {})
  })

  document.getElementById('btnHeart').addEventListener('click', () => {
    const track = coolState.current
    if (!track || !track.id) return
    fetch('/api/favorites/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        track_id: track.id,
        title: track.title,
        artist: track.artist,
        source: track.source
      })
    })
      .then(r => r.json())
      .then(data => {
        const btn = document.getElementById('btnHeart')
        if (data.favorited) {
          coolState.favoritedTrackIds.add(track.id)
          btn.classList.add('active')
        } else {
          coolState.favoritedTrackIds.delete(track.id)
          btn.classList.remove('active')
        }
      })
      .catch(() => {})
  })

  document.getElementById('btnMute').addEventListener('click', () => {
    fetch('/api/playback/mute', { method: 'POST' }).catch(() => {})
    coolState.muted = !coolState.muted
    if (audioEl) audioEl.volume = coolState.muted ? 0 : coolState.volume / 100
    updateVolumeSlider(coolState.volume, coolState.muted)
  })

  document.getElementById('chatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendChatMessage()
    }
  })

  document.getElementById('btnSend').addEventListener('click', sendChatMessage)

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    const tag = e.target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return

    switch (e.key) {
      case ' ':
        e.preventDefault()
        document.getElementById('btnPlayPause').click()
        break
      case 'ArrowLeft':
        document.getElementById('btnPrev').click()
        break
      case 'ArrowRight':
        document.getElementById('btnNext').click()
        break
      case 'm':
      case 'M':
        document.getElementById('btnMute').click()
        break
    }
  })
}

/* === NCM Login === */
function initNcmLogin() {
  const badge = document.getElementById('ncmLoginBadge')
  const modal = document.getElementById('ncmLoginModal')
  const closeBtn = document.getElementById('ncmLoginClose')
  const qrImg = document.getElementById('ncmQrImage')
  const qrStatus = document.getElementById('ncmQrStatus')
  const refreshBtn = document.getElementById('ncmRefreshQr')

  let qrPollTimer = null

  function stopQrPolling() {
    if (qrPollTimer) {
      clearInterval(qrPollTimer)
      qrPollTimer = null
    }
  }

  async function checkLoginStatus() {
    try {
      const r = await fetch('/api/ncm/auth/status')
      const data = await r.json()
      badge.classList.toggle('logged-in', data.loggedIn)
      badge.textContent = data.loggedIn ? '[NCM OK]' : '[NCM]'
    } catch { /* ignore */ }
  }

  async function startQrLogin() {
    stopQrPolling()
    qrStatus.textContent = '获取二维码...'
    qrImg.style.display = 'none'

    try {
      const keyRes = await fetch('/api/ncm/auth/qr-key')
      const { unikey } = await keyRes.json()
      if (!unikey) { qrStatus.textContent = '获取二维码失败'; return }

      const qrRes = await fetch(`/api/ncm/auth/qr-create?key=${encodeURIComponent(unikey)}`)
      const { qrimg } = await qrRes.json()
      if (!qrimg) { qrStatus.textContent = '生成二维码失败'; return }

      qrImg.src = qrimg
      qrImg.style.display = 'block'
      qrStatus.textContent = '请使用网易云音乐扫码登录'

      qrPollTimer = setInterval(async () => {
        try {
          const r = await fetch(`/api/ncm/auth/qr-check?key=${encodeURIComponent(unikey)}`)
          const data = await r.json()

          if (data.code === 803) {
            qrStatus.textContent = '登录成功！'
            stopQrPolling()
            checkLoginStatus()
            setTimeout(() => { modal.style.display = 'none' }, 1500)
          } else if (data.code === 802) {
            qrStatus.textContent = '扫码成功，请在手机上确认...'
          } else if (data.code === 800) {
            qrStatus.textContent = '二维码已过期，请刷新'
            stopQrPolling()
          }
        } catch { /* poll failed, retry */ }
      }, 2000)
    } catch {
      qrStatus.textContent = '网络错误'
    }
  }

  badge.addEventListener('click', () => {
    modal.style.display = 'flex'
    startQrLogin()
  })

  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none'
    stopQrPolling()
  })

  refreshBtn.addEventListener('click', startQrLogin)

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none'
      stopQrPolling()
    }
  })

  checkLoginStatus()
}
