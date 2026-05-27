const { Router } = require('express')
const router = Router()

router.get('/', (req, res) => {
  const db = req.app.locals.db
  const rows = db.prepare('SELECT key, value FROM prefs').all()
  const prefs = {}
  for (const row of rows) {
    try { prefs[row.key] = JSON.parse(row.value) }
    catch { prefs[row.key] = row.value }
  }
  res.json(prefs)
})

router.put('/:key', (req, res) => {
  const db = req.app.locals.db
  const { key } = req.params
  const { value } = req.body
  const val = typeof value === 'string' ? value : JSON.stringify(value)
  db.prepare('INSERT OR REPLACE INTO prefs (key, value) VALUES (?, ?)').run(key, val)
  res.json({ ok: true })
})

module.exports = router
