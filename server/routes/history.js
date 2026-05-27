const { Router } = require('express')
const router = Router()

router.get('/', (req, res) => {
  const db = req.app.locals.db
  const plays = db.prepare('SELECT * FROM plays ORDER BY played_at DESC LIMIT 50').all()
  res.json({ plays })
})

module.exports = router
