const { Router } = require('express')
const fs = require('fs')
const path = require('path')
const router = Router()

const ROUTINES_PATH = path.join(__dirname, '..', '..', 'user', 'routines.json')

// GET /api/routines — return current routines
router.get('/', (req, res) => {
  try {
    if (fs.existsSync(ROUTINES_PATH)) {
      const raw = fs.readFileSync(ROUTINES_PATH, 'utf-8')
      const routines = JSON.parse(raw)
      res.json({ routines: Array.isArray(routines) ? routines : [] })
    } else {
      res.json({ routines: [] })
    }
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PUT /api/routines — save routines
router.put('/', (req, res) => {
  try {
    const { routines } = req.body
    if (!Array.isArray(routines)) {
      return res.status(400).json({ error: 'routines array required' })
    }
    const dir = path.dirname(ROUTINES_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(ROUTINES_PATH, JSON.stringify(routines, null, 2), 'utf-8')
    console.log('[routines] saved', routines.length, 'routines')
    res.json({ ok: true, count: routines.length })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
