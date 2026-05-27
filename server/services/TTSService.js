const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const CACHE_DIR = path.join(__dirname, '..', '..', 'cache', 'tts')
const MAX_CACHE_SIZE = 50 * 1024 * 1024  // 50 MB
const MAX_CACHE_FILES = 500

class TTSService {
  constructor() {
    fs.mkdirSync(CACHE_DIR, { recursive: true })

    this.apiKey = process.env.DOUBAO_TTS_API_KEY || ''
    this.resourceId = process.env.DOUBAO_TTS_RESOURCE_ID || 'seed-tts-2.0'
    this.voice = process.env.DOUBAO_TTS_VOICE || 'zh_female_xiaohe_uranus_bigtts'
    this.endpoint = process.env.DOUBAO_TTS_ENDPOINT || 'https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse'
    this._consecutiveFailures = 0
  }

  get configured() {
    return !!this.apiKey
  }

  /** Track TTS health: after 3 consecutive failures, the service is degraded */
  recordSuccess() {
    this._consecutiveFailures = 0
  }

  recordFailure() {
    this._consecutiveFailures++
    console.warn(`[tts] consecutive failures: ${this._consecutiveFailures}`)
  }

  get isHealthy() {
    return this._consecutiveFailures < 3
  }

  _hashText(text) {
    return crypto.createHash('sha256')
      .update(`${this.resourceId}:${this.voice}:${text}`)
      .digest('hex')
      .slice(0, 24)
  }

  _getCached(hash) {
    const filePath = path.join(CACHE_DIR, `${hash}.mp3`)
    if (fs.existsSync(filePath)) {
      return { buffer: fs.readFileSync(filePath), filePath }
    }
    return null
  }

  _setCache(hash, buffer) {
    const filePath = path.join(CACHE_DIR, `${hash}.mp3`)
    fs.writeFileSync(filePath, buffer)
    // Async eviction check (fire-and-forget)
    setImmediate(() => this._evictCache())
    return filePath
  }

  /**
   * LRU eviction: remove oldest files when cache exceeds size or count limits.
   */
  _evictCache() {
    try {
      const files = fs.readdirSync(CACHE_DIR)
        .filter(f => f.endsWith('.mp3'))
        .map(f => {
          const fp = path.join(CACHE_DIR, f)
          try {
            const stat = fs.statSync(fp)
            return { file: f, path: fp, size: stat.size, mtime: stat.mtimeMs }
          } catch { return null }
        })
        .filter(Boolean)
        .sort((a, b) => a.mtime - b.mtime) // oldest first

      let totalSize = files.reduce((sum, f) => sum + f.size, 0)
      let totalCount = files.length

      // Remove oldest files until under limits
      const toRemove = []
      for (const f of files) {
        if (totalSize <= MAX_CACHE_SIZE && totalCount <= MAX_CACHE_FILES) break
        toRemove.push(f)
        totalSize -= f.size
        totalCount--
      }

      for (const f of toRemove) {
        try { fs.unlinkSync(f.path) } catch { /* ignore */ }
      }

      if (toRemove.length > 0) {
        console.log('[tts] cache evicted', toRemove.length, 'files (', (totalSize / 1024 / 1024).toFixed(1), 'MB remaining)')
      }
    } catch { /* cache eviction is best-effort */ }
  }

  _buildHeaders(requestId) {
    return {
      'Content-Type': 'application/json',
      'X-Api-Resource-Id': this.resourceId,
      'X-Api-Request-Id': requestId,
      'X-Api-Key': this.apiKey,
      'X-Control-Require-Usage-Tokens-Return': 'text_words'
    }
  }

  _buildPayload(text, requestId) {
    return {
      req_params: {
        text,
        speaker: this.voice,
        audio_params: {
          format: 'mp3',
          sample_rate: 24000
        },
        additions: JSON.stringify({
          cache_config: { use_cache: true, text_type: 1 }
        })
      },
      user: { uid: 'coldio-local' },
      request: {
        reqid: requestId,
        text,
        operation: 'query'
      }
    }
  }

  _parseEventStream(raw) {
    return raw
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean)
      .map(l => l.startsWith('data:') ? l.slice(5).trim() : l)
      .filter(l => l && l !== '[DONE]')
  }

  _readAudioChunks(response, rawText) {
    const contentType = response.headers.get('content-type') || ''
    const lines = contentType.includes('event-stream')
      ? this._parseEventStream(rawText)
      : this._parseEventStream(rawText)

    const chunks = []
    let usage = null

    for (const line of lines) {
      try {
        const frame = JSON.parse(line)
        if (frame.usage) usage = frame.usage
        if (frame.code && ![0, 20000000].includes(frame.code)) {
          throw new Error(frame.message || frame.Message || `Doubao TTS code ${frame.code}`)
        }
        const encodedAudio = frame.data || frame.audio || frame.result?.audio
        if (encodedAudio) chunks.push(Buffer.from(encodedAudio, 'base64'))
      } catch (err) {
        if (line.includes('{') || line.includes('}')) throw err
      }
    }

    if (chunks.length === 0) {
      try {
        const frame = JSON.parse(rawText)
        const encodedAudio = frame.data || frame.audio || frame.result?.audio
        if (encodedAudio) chunks.push(Buffer.from(encodedAudio, 'base64'))
        if (frame.usage) usage = frame.usage
      } catch { /* keep the clearer error below */ }
    }

    if (chunks.length === 0) {
      throw new Error('Doubao TTS response did not include audio data')
    }

    return { audio: Buffer.concat(chunks), usage }
  }

  async synthesize(text) {
    const cleanText = String(text || '').trim()
    if (!cleanText) {
      return { status: 'error', audioBuffer: null, hash: '', message: 'text is required' }
    }

    const hash = this._hashText(cleanText)
    const cached = this._getCached(hash)
    if (cached) {
      console.log('[tts] cache hit:', hash)
      return { status: 'cached', audioBuffer: cached.buffer, hash, message: '' }
    }

    if (!this.configured) {
      console.log('[tts] not configured — using browser speechSynthesis fallback')
      return { status: 'degraded', audioBuffer: null, hash, message: 'TTS not configured' }
    }

    try {
      const requestId = crypto.randomUUID()
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: this._buildHeaders(requestId),
        body: JSON.stringify(this._buildPayload(cleanText, requestId))
      })

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(`Doubao TTS failed: ${response.status} ${body.slice(0, 300)}`)
      }

      const rawText = await response.text()
      const { audio } = this._readAudioChunks(response, rawText)

      this._setCache(hash, audio)
      console.log('[tts] synthesized:', hash, `(${audio.length} bytes)`)

      return { status: 'ready', audioBuffer: audio, hash, message: '' }
    } catch (e) {
      console.warn('[tts] synthesis failed:', e.message)
      return { status: 'error', audioBuffer: null, hash, message: e.message }
    }
  }
}

module.exports = TTSService
