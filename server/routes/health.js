const { Router } = require('express')
const router = Router()

router.get('/', (req, res) => {
  const locals = req.app.locals
  const player = locals.playerService
  const planner = locals.plannerService
  const library = locals.libraryService
  const ncm = locals.ncmService
  const weather = locals.weatherService

  const state = player ? player.getState() : {}

  res.json({
    status: 'ok',
    uptime: process.uptime(),
    services: {
      netease: ncm ? ncm.status : 'unknown',
      deepseek: process.env.DEEPSEEK_API_KEY ? 'configured' : 'unconfigured',
      tts: locals.ttsService?.configured ? 'configured' : 'fallback',
      weather: weather?.configured ? 'configured' : 'unconfigured',
      library: { count: library ? library.getTrackCount() : 0 },
      planner: { status: planner ? 'ready' : 'unavailable' }
    },
    player: {
      playing: state.playing || false,
      currentTrack: state.current?.title || null,
      queueLength: (state.queue || []).length
    }
  })
})

module.exports = router
