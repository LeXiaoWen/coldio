const { Router } = require('express')
const router = Router()

router.get('/', async (req, res) => {
  const ncm = req.app.locals.ncmService
  const data = await ncm.getRecommendations(parseInt(req.query.limit) || 30)
  res.json(data || { error: 'recommendation failed' })
})

module.exports = router
