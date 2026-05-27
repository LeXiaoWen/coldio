const express = require('express')
const path = require('path')
const healthRoutes = require('./routes/health')
const nowRoutes = require('./routes/now')
const playbackRoutes = require('./routes/playback')
const queueRoutes = require('./routes/queue')
const audioRoutes = require('./routes/audio')
const plannerRoutes = require('./routes/planner')
const chatRoutes = require('./routes/chat')
const hostRoutes = require('./routes/host')
const libraryRoutes = require('./routes/library')
const searchRoutes = require('./routes/search')
const songRoutes = require('./routes/song')
const recommendRoutes = require('./routes/recommend')
const planRoutes = require('./routes/plan')
const prefsRoutes = require('./routes/prefs')
const historyRoutes = require('./routes/history')
const memoryRoutes = require('./routes/memory')
const lyricRoutes = require('./routes/lyric')
const weatherRoutes = require('./routes/weather')
const favoritesRoutes = require('./routes/favorites')
const routinesRoutes = require('./routes/routines')
const ncmAuthRoutes = require('./routes/ncm-auth')

function createApp() {
  const app = express()

  app.use(express.json())

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range')
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    next()
  })

  app.use((req, res, next) => {
    const start = Date.now()
    res.on('finish', () => {
      const ms = Date.now() - start
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`)
    })
    next()
  })

  app.use(express.static(path.join(__dirname, '..', 'public')))
  app.use('/tts', express.static(path.join(__dirname, '..', 'cache', 'tts')))

  app.use('/api/health', healthRoutes)
  app.use('/api/now', nowRoutes)
  app.use('/api/playback', playbackRoutes)
  app.use('/api/queue', queueRoutes)
  app.use('/api/audio', audioRoutes)
  app.use('/api/planner', plannerRoutes)
  app.use('/api/chat', chatRoutes)
  app.use('/api/host', hostRoutes)
  app.use('/api/library', libraryRoutes)
  app.use('/api/search', searchRoutes)
  app.use('/api/song-url', songRoutes)
  app.use('/api/lyric', lyricRoutes)
  app.use('/api/recommend', recommendRoutes)
  app.use('/api/plan', planRoutes)
  app.use('/api/prefs', prefsRoutes)
  app.use('/api/history/plays', historyRoutes)
  app.use('/api/memory', memoryRoutes)
  app.use('/api/weather', weatherRoutes)
  app.use('/api/favorites', favoritesRoutes)
  app.use('/api/routines', routinesRoutes)
  app.use('/api/ncm/auth', ncmAuthRoutes)

  app.get('/api/prefetch/next', (req, res) => {
    const player = req.app.locals.playerService
    if (!player) return res.json({ url: null })
    const nextItem = player.getNextItem()
    if (!nextItem) return res.json({ url: null })
    res.json({ url: nextItem.url || null })
  })

  return app
}

module.exports = createApp
