const { Router } = require('express')
const router = Router()

router.get('/', async (req, res) => {
  const ncm = req.app.locals.ncmService
  const { id, br } = req.query

  if (!id) return res.status(400).json({ error: 'id required' })

  const data = await ncm.getSongUrl(id, parseInt(br) || 999000)
  res.json(data || { error: 'failed to get song url' })
})

module.exports = router
