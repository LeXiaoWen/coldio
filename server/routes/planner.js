const { Router } = require('express')
const router = Router()

router.get('/today', async (req, res) => {
  const planner = req.app.locals.plannerService
  try {
    const plan = await planner.getTodayPlan()
    res.json(plan)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/regenerate', async (req, res) => {
  const planner = req.app.locals.plannerService
  try {
    const plan = await planner.regeneratePlan()
    res.json(plan)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/current', (req, res) => {
  const planner = req.app.locals.plannerService
  res.json(planner.getCurrentSlot())
})

module.exports = router
