const { Router } = require('express')
const router = Router()

router.post('/toggle', async (req, res) => {
  const player = req.app.locals.playerService
  const result = await player.playPause()
  res.json(result)
})

router.post('/next', async (req, res) => {
  const player = req.app.locals.playerService
  const result = await player.next()
  res.json(result)
})

router.post('/previous', async (req, res) => {
  const player = req.app.locals.playerService
  const result = await player.previous()
  res.json(result)
})

router.post('/play', async (req, res) => {
  const player = req.app.locals.playerService
  const { trackId } = req.body
  if (!trackId) return res.status(400).json({ error: 'trackId required' })
  const result = await player.play(trackId)
  res.json(result)
})

router.post('/seek', async (req, res) => {
  const player = req.app.locals.playerService
  const { segment } = req.body
  if (typeof segment !== 'number') return res.status(400).json({ error: 'segment (number) required' })
  player.seekToSegment(segment)
  res.json({ ok: true })
})

router.post('/volume', (req, res) => {
  const player = req.app.locals.playerService
  const { level } = req.body
  if (typeof level !== 'number') return res.status(400).json({ error: 'level required' })
  player.setVolume(level)
  res.json({ volume: level })
})

router.post('/mute', (req, res) => {
  const player = req.app.locals.playerService
  player.toggleMute()
  res.json({ muted: player.getState().muted })
})

router.post('/sleeptimer', (req, res) => {
  const player = req.app.locals.playerService
  const { minutes } = req.body
  if (typeof minutes !== 'number' || minutes < 0) {
    return res.status(400).json({ error: 'minutes (number >= 0) required' })
  }
  if (minutes > 0) {
    player.setSleepTimer(minutes)
  } else {
    player.cancelSleepTimer()
  }
  res.json({ ok: true, remaining: player.getSleepTimerRemaining() })
})

module.exports = router
