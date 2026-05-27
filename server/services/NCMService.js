const axios = require('axios')
const fs = require('fs')
const path = require('path')

class NCMService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl || process.env.NCM_API_BASE || 'http://localhost:3000'
    this._status = 'unknown'
    this._cookies = ''
    this._cookieFilePath = path.join(__dirname, '..', '..', 'data', 'ncm-cookies.txt')
    this._loadCookies()
    this._statusCallback = null
  }

  get isLoggedIn() {
    return !!this._cookies && this._cookies.length > 0
  }

  get status() { return this._status }

  _loadCookies() {
    try {
      if (fs.existsSync(this._cookieFilePath)) {
        this._cookies = fs.readFileSync(this._cookieFilePath, 'utf-8').trim()
        console.log('[ncm] loaded cookies, length:', this._cookies.length)
      }
    } catch (e) {
      console.warn('[ncm] cookie load failed:', e.message)
    }
  }

  _saveCookies() {
    try {
      fs.writeFileSync(this._cookieFilePath, this._cookies, 'utf-8')
    } catch (e) {
      console.warn('[ncm] cookie save failed:', e.message)
    }
  }

  setStatusCallback(fn) {
    this._statusCallback = fn
  }

  clearCookies() {
    this._cookies = ''
    try { fs.unlinkSync(this._cookieFilePath) } catch { /* ignore */ }
  }

  _extractCookies(res) {
    if (res.headers && res.headers['set-cookie']) {
      const cookieStr = res.headers['set-cookie']
        .map(c => c.split(';')[0])
        .filter(Boolean)
        .join('; ')
      if (cookieStr) {
        this._cookies = cookieStr
        this._saveCookies()
      }
    }
  }

  async _getAxios() {
    return axios
  }

  async _request(endpoint, params = {}) {
    try {
      const axios = await this._getAxios()
      const headers = {}
      if (this._cookies) {
        headers['Cookie'] = this._cookies
      }
      const res = await axios.get(`${this.baseUrl}${endpoint}`, {
        params,
        timeout: 8000,
        validateStatus: () => true,
        headers
      })

      // Extract Set-Cookie headers for session persistence
      this._extractCookies(res)

      if (res.status >= 200 && res.status < 500) {
        this._status = 'ok'
        this._statusCallback?.('ok')
        return res.data
      }
      this._status = 'error'
      this._statusCallback?.('degraded')
      return null
    } catch (err) {
      this._status = 'error'
      this._statusCallback?.('degraded')
      console.warn('[ncm] request failed:', endpoint, err.message)
      return null
    }
  }

  async checkLoginStatusOnStartup() {
    if (!this.isLoggedIn) return false
    try {
      const data = await this.getLoginStatus()
      const ok = data?.data?.account ? true : false
      console.log('[ncm] login status:', ok ? 'authenticated' : 'session expired')
      if (!ok) this.clearCookies()
      return ok
    } catch {
      return false
    }
  }

  // ── Health ──

  async checkHealth() {
    try {
      const axios = await this._getAxios()
      await axios.get(this.baseUrl, { timeout: 3000 })
      this._status = 'ok'
      return true
    } catch {
      this._status = 'error'
      return false
    }
  }

  // ── Search & Content ──

  async search(keywords, type = 1, limit = 30, offset = 0) {
    return this._request('/search', { keywords, type, limit, offset })
  }

  async getSongUrl(id, br = 999000) {
    return this._request('/song/url', { id, br })
  }

  async getLyric(id) {
    return this._request('/lyric', { id })
  }

  async getSongDetail(ids) {
    return this._request('/song/detail', { ids })
  }

  async getSongComments(id, limit = 20) {
    return this._request('/comment/music', { id, limit })
  }

  async getPlaylistDetail(id) {
    return this._request('/playlist/detail', { id })
  }

  async getPlaylistTracks(id, limit = 1000, offset = 0) {
    return this._request('/playlist/track/all', { id, limit, offset })
  }

  /**
   * Get playlist tracks with 3-tier fallback:
   *   Tier 1: NeteaseCloudMusicApi /playlist/track/all
   *   Tier 2: music.163.com official API (direct)
   *   Tier 3: Parse HTML page + song detail API
   */
  async getPlaylistTracksWithFallback(id) {
    // Tier 1: Local NeteaseCloudMusicApi
    try {
      const data = await this.getPlaylistTracks(id)
      if (data && data.songs && data.songs.length > 0) {
        console.log('[ncm] Tier 1 playlist fetch succeeded:', id)
        return data
      }
    } catch { /* fall through */ }
    console.log('[ncm] Tier 1 failed, trying Tier 2 for playlist:', id)

    // Tier 2: Direct music.163.com API
    try {
      const axios = await this._getAxios()
      const res = await axios.get(`https://music.163.com/api/playlist/detail?id=${id}`, {
        timeout: 8000,
        headers: {
          'Referer': 'https://music.163.com/',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
        }
      })
      if (res.data && res.data.result && res.data.result.tracks) {
        console.log('[ncm] Tier 2 playlist fetch succeeded:', id)
        const tracks = res.data.result.tracks
        return {
          songs: tracks.map(t => ({
            id: t.id,
            name: t.name,
            ar: (t.artists || []).map(a => ({ id: a.id, name: a.name })),
            al: t.album ? { id: t.album.id, name: t.album.name } : undefined,
            dt: t.duration,
            artists: (t.artists || []).map(a => ({ id: a.id, name: a.name }))
          })),
          playlist: { name: res.data.result.name }
        }
      }
    } catch { /* fall through */ }
    console.log('[ncm] Tier 2 failed, trying Tier 3 for playlist:', id)

    // Tier 3: Parse HTML page, extract track IDs, fetch details
    try {
      const axios = await this._getAxios()
      const htmlRes = await axios.get(`https://music.163.com/playlist?id=${id}`, {
        timeout: 8000,
        headers: {
          'Referer': 'https://music.163.com/',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
        }
      })

      const titleMatch = htmlRes.data.match(/<title[^>]*>([^<]+)<\/title>/)
      const playlistName = titleMatch ? titleMatch[1].replace(/^\s*|\s*$/g, '') : null

      const initStateMatch = htmlRes.data.match(/window\.__INITIAL_STATE__\s*=\s*({[^<]+});/)
      let trackIds = []
      if (initStateMatch) {
        try {
          const initState = JSON.parse(initStateMatch[1])
          if (initState.playlist && initState.playlist.trackIds) {
            trackIds = initState.playlist.trackIds.map(t => t.id)
          }
        } catch { /* try next method */ }
      }

      if (trackIds.length === 0) {
        const jsonMatch = htmlRes.data.match(/var\s+playlist\s*=\s*(\[.+?\]);/)
        if (jsonMatch) {
          try {
            const rawTracks = JSON.parse(jsonMatch[1])
            trackIds = rawTracks.map(t => t.id)
          } catch { /* give up */ }
        }
      }

      if (trackIds.length === 0) {
        throw new Error('could not extract track IDs from page')
      }

      const batchSize = 50
      const allSongs = []
      for (let i = 0; i < trackIds.length; i += batchSize) {
        const batch = trackIds.slice(i, i + batchSize)
        const detailData = await this.getSongDetail(batch.join(','))
        if (detailData && detailData.songs) {
          allSongs.push(...detailData.songs)
        }
        if (i + batchSize < trackIds.length) {
          await new Promise(r => setTimeout(r, 300))
        }
      }

      if (allSongs.length > 0) {
        console.log('[ncm] Tier 3 playlist fetch succeeded:', id, `(${allSongs.length} tracks)`)
        return { songs: allSongs, playlist: { name: playlistName } }
      }
    } catch (e) {
      console.warn('[ncm] Tier 3 failed:', e.message)
    }

    console.warn('[ncm] all tiers failed for playlist:', id)
    return null
  }

  async getRecommendations(limit = 30) {
    return this._request('/personalized', { limit })
  }

  // ── Authentication ──

  async getQrKey() {
    return this._request('/login/qr/key', { timestamp: Date.now() })
  }

  async getQrCreate(key) {
    return this._request('/login/qr/create', { key, qrimg: true, timestamp: Date.now() })
  }

  async checkQrStatus(key) {
    return this._request('/login/qr/check', { key, timestamp: Date.now() })
  }

  async getLoginStatus() {
    return this._request('/login/status')
  }

  async refreshLogin() {
    return this._request('/login/refresh', { timestamp: Date.now() })
  }

  async logout() {
    return this._request('/logout')
  }

  /** Extract playlist ID from various Netease URL formats */
  extractPlaylistId(url) {
    const match = url.match(/playlist[=\/](\d+)/)
    return match ? match[1] : null
  }
}

module.exports = NCMService
