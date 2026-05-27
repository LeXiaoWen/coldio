const { Router } = require('express')
const router = Router()

router.get('/', (req, res) => {
  const player = req.app.locals.playerService
  const planner = req.app.locals.plannerService

  res.json({
    ...(player ? player.getBroadcastState() : {}),
    currentSlot: planner ? planner.getCurrentSlot() : null
  })
})

module.exports = router
