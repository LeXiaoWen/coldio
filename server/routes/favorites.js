const { Router } = require('express')
const router = Router()

// POST /api/favorites/toggle — toggle favorite for current track
router.post('/toggle', (req, res) => {
  const db = req.app.locals.db
  const { track_id, title, artist, source } = req.body

  if (!track_id) return res.status(400).json({ error: 'track_id required' })

  const existing = db.prepare('SELECT id FROM favorites WHERE track_id = ?').get(track_id)

  if (existing) {
    db.prepare('DELETE FROM favorites WHERE track_id = ?').run(track_id)
    return res.json({ favorited: false })
  }

  db.prepare(
    'INSERT INTO favorites (track_id, title, artist, source) VALUES (?, ?, ?, ?)'
  ).run(track_id, title || '', artist || '', source || '')

  res.json({ favorited: true })
})

// GET /api/favorites — list all favorites
router.get('/', (req, res) => {
  const db = req.app.locals.db
  const favorites = db.prepare('SELECT * FROM favorites ORDER BY created_at DESC').all()
  res.json({ favorites })
})

// GET /api/favorites/check/:trackId — check if a track is favorited
router.get('/check/:trackId', (req, res) => {
  const db = req.app.locals.db
  const existing = db.prepare('SELECT id FROM favorites WHERE track_id = ?').get(req.params.trackId)
  res.json({ favorited: !!existing })
})

module.exports = router
