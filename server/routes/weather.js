const { Router } = require('express')
const router = Router()

// GET /api/weather — current weather
router.get('/', async (req, res) => {
  const weather = req.app.locals.weatherService
  if (!weather) {
    return res.json({ status: 'degraded', city: 'unknown', summary: 'weather service unavailable', temperature: null })
  }

  try {
    const data = await weather.getWeather()
    res.json(data)
  } catch (e) {
    res.json({ status: 'degraded', city: weather.city, summary: e.message, temperature: null })
  }
})

module.exports = router
