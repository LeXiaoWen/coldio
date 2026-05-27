const { Router } = require('express')
const router = Router()
const wavTone = require('../util/wav-tone')

// GET /api/audio/music/:trackId — local music or WAV fallback
router.get('/music/:trackId', (req, res) => {
  const player = req.app.locals.playerService
  const { trackId } = req.params
  const rangeHeader = req.headers.range

  const result = player.getAudioStream(trackId, rangeHeader)

  res.status(result.status)
  res.setHeader('Content-Type', result.mime)
  res.setHeader('Accept-Ranges', 'bytes')

  if (result.headers) {
    for (const [k, v] of Object.entries(result.headers)) {
      res.setHeader(k, v)
    }
  }

  if (result.buffer) return res.send(result.buffer)
  if (result.stream) return result.stream.pipe(res)

  res.status(404).json({ error: 'track not found' })
})

// GET /api/audio/ncm/:id — proxy NCM song audio
router.get('/ncm/:id', async (req, res) => {
  const ncm = req.app.locals.ncmService
  const { id } = req.params

  try {
    const data = await ncm.getSongUrl(id)
    const url = data?.data?.[0]?.url

    if (!url) {
      const buffer = wavTone.generateWavTone(220, 30)
      res.setHeader('Content-Type', 'audio/wav')
      return res.send(buffer)
    }

    const axios = await ncm._getAxios()
    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 15000,
      headers: {
        'Referer': 'https://music.163.com/',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    })

    res.setHeader('Content-Type', response.headers['content-type'] || 'audio/mpeg')
    // Note: no Accept-Ranges header — NCM proxy doesn't handle range requests.
    // Seeking on NCM audio falls back to server-side progress tracking only.
    response.data.on('error', () => {
      // Stream error — fallback to WAV tone (if headers not yet sent)
      if (!res.headersSent) {
        const buf = wavTone.generateWavTone(220, 30)
        res.setHeader('Content-Type', 'audio/wav')
        res.send(buf)
      }
    })
    response.data.pipe(res)
  } catch (e) {
    const buffer = wavTone.generateWavTone(220, 30)
    res.setHeader('Content-Type', 'audio/wav')
    res.send(buffer)
  }
})

// GET /api/audio/voice/:voiceId/text — voice item text (for speechSynthesis fallback)
router.get('/voice/:voiceId/text', (req, res) => {
  const player = req.app.locals.playerService
  const text = player.getVoiceText(req.params.voiceId)
  if (!text) return res.status(404).json({ error: 'voice not found' })
  res.json({ text })
})

// GET /api/audio/voice/:voiceId — TTS host voice
router.get('/voice/:voiceId', async (req, res) => {
  const player = req.app.locals.playerService
  const tts = req.app.locals.ttsService
  const { voiceId } = req.params

  const text = player.getVoiceText(voiceId)
  if (!text) {
    return res.status(404).end()
  }

  try {
    const result = await tts.synthesize(text)
    if (result && result.audioBuffer) {
      const buf = result.audioBuffer
      // Detect audio format from magic bytes
      const isMp3 = buf.length > 2 &&
        ((buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0) ||
         (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33))
      res.setHeader('Content-Type', isMp3 ? 'audio/mpeg' : 'audio/wav')
      res.setHeader('X-TTS-Source', 'volcano')
      return res.send(buf)
    }
  } catch (e) {
    console.warn('[audio] tts failed:', e.message)
  }

  // TTS unavailable — return 503 so frontend falls back to browser speechSynthesis
  res.status(503).end()
})

// GET /api/audio/speak?text=... — TTS for arbitrary text (chat replies, etc.)
router.get('/speak', async (req, res) => {
  const tts = req.app.locals.ttsService
  const player = req.app.locals.playerService
  const text = (req.query.text || '').trim()
  if (!text) {
    return res.status(400).json({ error: 'text required' })
  }

  try {
    const result = await tts.synthesize(text)
    if (result && result.audioBuffer) {
      tts.recordSuccess()
      // Restore tts status if it was previously degraded
      if (!tts.isHealthy) {
        player.updateServiceStatus('tts', 'ok')
      }
      const buf = result.audioBuffer
      const isMp3 = buf.length > 2 &&
        ((buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0) ||
         (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33))
      res.setHeader('Content-Type', isMp3 ? 'audio/mpeg' : 'audio/wav')
      res.setHeader('X-TTS-Source', 'volcano')
      return res.send(buf)
    }
  } catch (e) {
    console.warn('[speak] tts failed:', e.message)
  }

  // TTS unavailable — track health and return 503
  tts.recordFailure()
  if (!tts.isHealthy) {
    player.updateServiceStatus('tts', 'degraded')
  }
  res.status(503).end()
})

// GET /api/audio/host-intro — TTS host voice for current slot segment
router.get('/host-intro', async (req, res) => {
  const tts = req.app.locals.ttsService
  const player = req.app.locals.playerService
  const segment = req.query.segment || 'opening'

  // Find nearest voice item matching the requested segment type
  const state = player.getState()
  let text = ''
  for (let i = state.queueIndex; i >= 0 && i < state.queue.length; i++) {
    const item = state.queue[i]
    if (item.type === 'voice' && item.id && item.id.includes(segment)) {
      text = item.hostText || ''
      break
    }
  }

  if (!text) {
    return res.status(404).end()
  }

  try {
    const result = await tts.synthesize(text)
    if (result && result.audioBuffer) {
      const buf = result.audioBuffer
      const isMp3 = buf.length > 2 &&
        ((buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0) ||
         (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33))
      res.setHeader('Content-Type', isMp3 ? 'audio/mpeg' : 'audio/wav')
      res.setHeader('X-TTS-Source', 'volcano')
      return res.send(buf)
    }
  } catch (e) {
    console.warn('[host-intro] tts failed:', e.message)
  }

  // TTS unavailable — return 503 so frontend falls back to browser speechSynthesis
  res.status(503).end()
})

module.exports = router
