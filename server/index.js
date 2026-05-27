require('dotenv').config()
const http = require('http')
const { spawn } = require('child_process')
const net = require('net')
const path = require('path')
const createApp = require('./app')
const db = require('./db')

const PORT = parseInt(process.env.PORT || '3001', 10)

async function main() {
  console.log('[coldio] starting...')

  // Initialize database
  const database = db.init()

  // Initialize services in dependency order
  const LibraryService = require('./services/LibraryService')
  const PlannerService = require('./services/PlannerService')
  const PlayerService = require('./services/PlayerService')
  const HostService = require('./services/HostService')
  const TTSService = require('./services/TTSService')
  const WeatherService = require('./services/WeatherService')
  const ProfileService = require('./services/ProfileService')
  const NCMService = require('./services/NCMService')

  const libraryService = new LibraryService()
  const profileService = new ProfileService(database)
  const ncmService = new NCMService()
  const weatherService = new WeatherService()
  const plannerService = new PlannerService(libraryService, profileService, ncmService, weatherService)
  const playerService = new PlayerService(libraryService, plannerService)
  const ttsService = new TTSService()
  const hostService = new HostService(plannerService, playerService, ncmService, weatherService)
  hostService.libraryService = libraryService

  // Set TTS status based on credential availability
  if (ttsService.configured) {
    playerService.updateServiceStatus('tts', 'ok')
    console.log('[tts] configured, endpoint:', ttsService.endpoint)
  } else {
    playerService.updateServiceStatus('tts', 'degraded')
    console.log('[tts] not configured — using browser speechSynthesis fallback')
  }

  await libraryService.init()
  await plannerService.init()

  // Create Express app and inject services
  const app = createApp()
  app.locals.db = database
  app.locals.libraryService = libraryService
  app.locals.plannerService = plannerService
  app.locals.playerService = playerService
  app.locals.hostService = hostService
  app.locals.ttsService = ttsService
  app.locals.weatherService = weatherService
  app.locals.profileService = profileService
  app.locals.ncmService = ncmService


  // Create HTTP server and attach WebSocket
  const server = http.createServer(app)
  const ws = require('./ws')
  ws.attachWebSocket(server)

  // ── NCM API Auto-Daemon ──
  let _ncmChild = null
  let _ncmFailCount = 0
  let _ncmHealthTimer = null
  let _ncmEverHealthy = false
  const NCM_API_PATH = path.join(__dirname, '..', 'NeteaseCloudMusicApi', 'app.js')
  const NCM_HEARTBEAT_MS = 30000
  const MAX_NCM_RESTARTS = 3
  const NCM_COOLDOWN_MS = 30000

  async function _isPortInUse(port) {
    return new Promise(resolve => {
      const s = net.connect(port, '127.0.0.1', () => { s.end(); resolve(true) })
      s.on('error', () => resolve(false))
    })
  }

  function _startNcmApi() {
    if (_ncmChild) return
    console.log('[ncm-daemon] spawning NCM API...')
    _ncmChild = spawn('node', [NCM_API_PATH], {
      cwd: path.dirname(NCM_API_PATH),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: '3000' }
    })
    _ncmChild.stdout.on('data', d => {
      const msg = d.toString()
      process.stdout.write('[ncm-api] ' + msg)
      if (msg.includes('server running') || msg.includes('listening')) {
        playerService.updateServiceStatus('netease', 'ok')
        console.log('[ncm-daemon] NCM API is ready')
      }
    })
    _ncmChild.stderr.on('data', d => process.stderr.write('[ncm-api-err] ' + d.toString()))
    _ncmChild.on('exit', (code, sig) => {
      console.log(`[ncm-daemon] NCM API exited (code:${code} signal:${sig})`)
      _ncmChild = null
      playerService.updateServiceStatus('netease', 'degraded')
    })
    _ncmChild.on('error', err => {
      console.error('[ncm-daemon] spawn error:', err.message)
      _ncmChild = null
    })
  }

  async function _ncmHealthCheck() {
    const ok = await ncmService.checkHealth()
    if (ok) {
      _ncmFailCount = 0
      _ncmEverHealthy = true
      playerService.updateServiceStatus('netease', 'ok')
      return
    }
    if (!_ncmEverHealthy) {
      console.log('[ncm-daemon] waiting for NCM API to start...')
      return
    }
    _ncmFailCount++
    console.warn(`[ncm-daemon] health check #${_ncmFailCount} failed`)
    playerService.updateServiceStatus('netease', 'degraded')

    if (_ncmFailCount >= MAX_NCM_RESTARTS) {
      console.log(`[ncm-daemon] ${MAX_NCM_RESTARTS} consecutive failures, cooling down ${NCM_COOLDOWN_MS / 1000}s...`)
      if (_ncmHealthTimer) {
        clearInterval(_ncmHealthTimer)
        _ncmHealthTimer = null
      }
      _ncmFailCount = 0
      setTimeout(() => {
        _ncmHealthTimer = setInterval(_ncmHealthCheck, NCM_HEARTBEAT_MS)
        _startNcmApi()
      }, NCM_COOLDOWN_MS)
      return
    }

    if (_ncmChild) {
      console.log('[ncm-daemon] killing unresponsive NCM API...')
      _ncmChild.kill('SIGKILL')
      _ncmChild = null
    }
    _startNcmApi()
  }

  async function initNcmDaemon() {
    ncmService.setStatusCallback((status) => {
      playerService.updateServiceStatus('netease', status)
    })
    const inUse = await _isPortInUse(3000)
    if (inUse) {
      console.log('[ncm-daemon] port 3000 already in use — NCM API is running externally')
      playerService.updateServiceStatus('netease', 'ok')
    } else {
      _startNcmApi()
    }
    // Delay health check to let NCM API breathe during startup
    setTimeout(() => {
      if (!_ncmHealthTimer) {
        _ncmHealthTimer = setInterval(_ncmHealthCheck, NCM_HEARTBEAT_MS)
      }
    }, 5000)
  }

  initNcmDaemon()

  // Give services access to broadcast
  playerService.setBroadcastFn((data) => ws.broadcast(data))
  playerService.setWsModule(ws)
  playerService.setHostService(hostService)

  server._playerService = playerService
  server._plannerService = plannerService
  server._ws = ws

  // Seed initial data on first run
  const msgCount = database.prepare('SELECT COUNT(*) as c FROM messages').get().c
  if (msgCount === 0) {
    seedInitialMessages(database, hostService)
  }

  // Generate today's plan and start player
  try {
    await plannerService.getTodayPlan()
    await playerService.start()
  } catch (e) {
    console.log('[planner] plan generation deferred:', e.message)
  }

  // Dynamic opening: weather-aware greeting + NCM track recommendation
  try {
    const opening = await hostService.generateDynamicOpening()
    if (opening.greeting) {
      playerService.overrideFirstVoice(opening.greeting, opening.ncmTrack)
      console.log('[startup] dynamic opening applied —', opening.greeting.slice(0, 60) + '...')
      if (opening.ncmTrack) {
        console.log('[startup] NCM track queued:', opening.ncmTrack.title, '-', opening.ncmTrack.artist)
      }

      // Also insert greeting as a chat message so it's visible in the chat panel
      const greetingTime = new Date().toISOString().replace('T', ' ').slice(0, 19)
      database.prepare('INSERT INTO messages (role, nickname, content, created_at) VALUES (?, ?, ?, ?)').run('host', 'Codio', opening.greeting, greetingTime)
      console.log('[startup] greeting saved to chat')
    }
  } catch (e) {
    console.warn('[startup] dynamic opening failed:', e.message)
  }

  server.listen(PORT, () => {
    console.log(`[coldio] listening on http://localhost:${PORT}`)
  })

  // Graceful shutdown
  const shutdown = () => {
    console.log('[coldio] shutting down...')
    ws.broadcast({ type: 'shutdown' })
    if (_ncmChild) {
      console.log('[ncm-daemon] stopping NCM API...')
      _ncmChild.kill('SIGTERM')
      _ncmChild = null
    }
    if (_ncmHealthTimer) {
      clearInterval(_ncmHealthTimer)
      _ncmHealthTimer = null
    }
    server.close(() => process.exit(0))
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

function seedInitialMessages(database, hostService) {
  const insert = database.prepare(
    'INSERT INTO messages (role, nickname, content, created_at) VALUES (?, ?, ?, ?)'
  )
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const intro = `你好，我是 Codio，你的私人 AI 电台主持。我会 24 小时为你放音乐、聊聊天，根据你的状态调整氛围。试试告诉我你现在想听什么样的音乐吧。`

  insert.run('host', 'Codio', intro, now)
  insert.run('user', '你', '今天下雨，想听一点松弛的歌。', now)
  insert.run(
    'host',
    'Codio',
    '收到。雨天真的很适合把节奏放慢。我挑了几首带雨声元素的 chill 曲目，先从钢琴和轻电子开始，让氛围慢慢铺开。',
    now
  )

  console.log('[seed] 3 initial messages created')
}

main().catch((err) => {
  console.error('[coldio] fatal:', err)
  process.exit(1)
})
