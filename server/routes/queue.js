const { Router } = require('express')
const router = Router()

router.post('/add', (req, res) => {
  const player = req.app.locals.playerService
  const { track } = req.body
  if (!track) return res.status(400).json({ error: 'track required' })
  player.addToQueue(track)
  res.json({ ok: true })
})

router.post('/reshape', (req, res) => {
  const player = req.app.locals.playerService
  const { trackIds } = req.body
  if (!Array.isArray(trackIds)) return res.status(400).json({ error: 'trackIds array required' })
  player.reshapeQueue(trackIds)
  res.json({ ok: true })
})

router.get('/', (req, res) => {
  const player = req.app.locals.playerService
  res.json({ queue: player.getState().queue || [] })
})

module.exports = router
