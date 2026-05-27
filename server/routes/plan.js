const { Router } = require('express')
const router = Router()

router.get('/today', async (req, res) => {
  const planner = req.app.locals.plannerService
  try {
    const plan = await planner.getTodayPlan()
    res.json({
      date: plan.date,
      weekday: plan.weekday,
      slots: plan.slots.map(s => ({
        id: s.id,
        title: s.title,
        timeRange: s.timeRange,
        scene: s.scene,
        energy: s.energy
      }))
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
