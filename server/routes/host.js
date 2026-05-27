const { Router } = require('express')
const router = Router()

router.post('/intro-copy', async (req, res) => {
  const host = req.app.locals.hostService
  const { slotId, tracks, timeContext } = req.body

  try {
    const copy = await host.generateIntroCopy(slotId, tracks, timeContext)
    res.json(copy)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
