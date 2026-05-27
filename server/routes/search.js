const { Router } = require('express')
const router = Router()

router.get('/', async (req, res) => {
  const ncm = req.app.locals.ncmService
  const { keywords, type, limit, offset } = req.query

  if (!keywords) return res.status(400).json({ error: 'keywords required' })

  const data = await ncm.search(keywords, parseInt(type) || 1, parseInt(limit) || 30, parseInt(offset) || 0)
  res.json(data || { error: 'search failed' })
})

module.exports = router
