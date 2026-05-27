const { Router } = require('express')
const router = Router()
const path = require('path')
const fs = require('fs')

// GET /api/library/tracks
router.get('/tracks', (req, res) => {
  const library = req.app.locals.libraryService
  const { search, tags } = req.query

  let tracks = library.getAllTracks()

  if (search) {
    const q = search.toLowerCase()
    tracks = tracks.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      (t.tags || []).some(tag => tag.toLowerCase().includes(q))
    )
  }

  if (tags) {
    const tagList = tags.split(',').map(t => t.trim()).filter(Boolean)
    if (tagList.length > 0) {
      tracks = tracks.filter(t =>
        (t.tags || []).some(tag => tagList.includes(tag))
      )
    }
  }

  res.json({ tracks, total: tracks.length })
})

// POST /api/library/tracks/:trackId/identity
router.post('/tracks/:trackId/identity', (req, res) => {
  const { title, artist } = req.body
  const { trackId } = req.params

  if (!title && !artist) {
    return res.status(400).json({ error: 'title or artist required' })
  }

  const overridesPath = path.join(__dirname, '..', '..', 'data', 'track-overrides.json')
  let overrides = {}
  try {
    if (fs.existsSync(overridesPath)) {
      overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf-8'))
    }
  } catch { }

  overrides[trackId] = {
    title: title || undefined,
    artist: artist || undefined,
    updatedAt: new Date().toISOString()
  }

  fs.writeFileSync(overridesPath, JSON.stringify(overrides, null, 2))
  res.json({ ok: true })
})

// POST /api/library/online-playlist/preview
router.post('/online-playlist/preview', async (req, res) => {
  const ncm = req.app.locals.ncmService
  const library = req.app.locals.libraryService
  const { url } = req.body

  if (!url) return res.status(400).json({ error: 'url required' })

  const playlistId = ncm.extractPlaylistId(url)
  if (!playlistId) {
    // Not a Netease URL — try generic JSON playlist
    try {
      const axios = require('axios')
      const resp = await axios.get(url, { timeout: 10000 })
      const body = resp.data
      if (body && Array.isArray(body.tracks || body.songs || body.items)) {
        const tracks = (body.tracks || body.songs || body.items).map(t => ({
          id: t.id || t.title,
          title: t.title || t.name || '',
          artist: t.artist || t.artists || '',
          album: t.album || '',
          duration: t.duration || t.dt || 0
        }))
        return res.json({ source: 'json', title: body.title || body.name || null, tracks })
      }
      return res.status(400).json({ error: 'unsupported playlist format' })
    } catch (e) {
      return res.status(400).json({ error: 'invalid playlist URL' })
    }
  }

  try {
    const data = await ncm.getPlaylistTracksWithFallback(playlistId)
    if (!data || !data.songs) {
      return res.json({ source: 'netease', title: null, tracks: [], note: 'playlist not accessible' })
    }

    const localTracks = library.getAllTracks()
    const matched = data.songs.map(song => {
      const local = findBestMatch(song, localTracks)
      return {
        id: song.id,
        title: song.name,
        artist: (song.ar || []).map(a => a.name).join(', '),
        album: song.al?.name,
        duration: Math.floor((song.dt || 0) / 1000),
        match: local ? { score: local.score, localTrackId: local.track.id } : null
      }
    })

    res.json({ source: 'netease', title: data.playlist?.name || null, tracks: matched })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Simple local matching
function findBestMatch(song, localTracks) {
  const songTitle = (song.name || '').toLowerCase()
  const songArtists = (song.ar || []).map(a => a.name.toLowerCase())

  let best = { score: 0, track: null }

  for (const track of localTracks) {
    const tTitle = track.title.toLowerCase()
    const tArtist = track.artist.toLowerCase()

    let score = 0

    if (tTitle === songTitle) score += 0.68
    else if (tTitle.includes(songTitle) || songTitle.includes(tTitle)) score += 0.4

    if (songArtists.some(a => tArtist.includes(a) || a.includes(tArtist))) score += 0.24

    const filename = (track.filename || '').toLowerCase()
    if (filename.includes(songTitle)) score += 0.16

    if (score > best.score) {
      best = { score: Math.min(score, 1), track }
    }
  }

  return best.track && best.score >= 0.5 ? best : null
}

module.exports = router
