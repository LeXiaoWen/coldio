const { Router } = require('express')
const router = Router()

router.get('/', async (req, res) => {
  const ncm = req.app.locals.ncmService
  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'id required' })
  const data = await ncm.getLyric(id)
  res.json(data || { error: 'lyric not found' })
})

module.exports = router
