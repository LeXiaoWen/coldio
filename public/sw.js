const CACHE_NAME = 'coldio-v3'
const APP_SHELL = [
  '/',
  '/styles.css',
  '/app.js',
  '/assets/icons/codio-avatar.svg',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/heart.svg',
  '/assets/icons/play.svg',
  '/assets/icons/pause.svg',
  '/assets/icons/prev.svg',
  '/assets/icons/next.svg',
  '/assets/icons/volume.svg',
  '/assets/icons/mute.svg',
  '/assets/icons/mic.svg',
  '/assets/icons/send.svg',
  '/assets/icons/search.svg'
]

// API endpoints that should be cached for offline use
const CACHED_API_PATHS = [
  '/api/chat',
  '/api/planner/today',
  '/api/favorites',
  '/api/history/plays',
  '/api/library/tracks',
  '/api/prefs'
]

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  )
})

function isApiPath(url) {
  return url.pathname.startsWith('/api/')
}

function isAudioPath(url) {
  return url.pathname.startsWith('/api/audio/')
}

function isCachedApiPath(url) {
  return CACHED_API_PATHS.some(p => url.pathname.startsWith(p))
}

// Provide meaningful offline fallback JSON
function offlineResponse(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)

  // Skip audio streams — too large to cache
  if (isAudioPath(url)) return

  // Cache-first for app shell (HTML, CSS, JS, assets)
  if (!isApiPath(url)) {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).catch(() => {
        // Absolute fallback: return the cached index.html
        return caches.match('/')
      }))
    )
    return
  }

  // Network-first for cached API endpoints
  if (e.request.method === 'GET' && isCachedApiPath(url)) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          const clone = r.clone()
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone))
          return r
        })
        .catch(() =>
          caches.match(e.request).then(r => {
            if (r) return r
            // Meaningful per-endpoint fallbacks
            if (url.pathname === '/api/chat') {
              return offlineResponse({ messages: [] })
            }
            if (url.pathname === '/api/planner/today') {
              return offlineResponse({ slots: [], date: new Date().toISOString().slice(0, 10) })
            }
            if (url.pathname === '/api/favorites') {
              return offlineResponse({ favorites: [] })
            }
            if (url.pathname === '/api/history/plays') {
              return offlineResponse({ plays: [] })
            }
            return offlineResponse({ error: 'offline' })
          })
        )
    )
    return
  }

  // Other API requests: network only
  e.respondWith(fetch(e.request).catch(() => offlineResponse({ error: 'offline' })))
})
