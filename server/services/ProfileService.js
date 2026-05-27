class ProfileService {
  constructor(database) {
    this.db = database
    this._profileCache = null
  }

  recordFeedback(data) {
    const stmt = this.db.prepare(`
      INSERT INTO listener_feedback
        (message_id, feedback_type, user_message, host_reply, slot_id, slot_title,
         track_title, track_artist, track_source, music_direction, scene, mood)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      data.messageId || '',
      data.feedbackType || '',
      data.userMessage || '',
      data.hostReply || '',
      data.slotId || '',
      data.slotTitle || '',
      data.track?.title || '',
      data.track?.artist || '',
      data.track?.source || '',
      data.musicDirection || '',
      data.scene || '',
      data.mood || ''
    )

    this._profileCache = null
    console.log('[profile] feedback recorded:', data.feedbackType)
  }

  /**
   * Initialize profile with structured preference data.
   * Seeds synthetic feedback rows that combine with real feedback.
   */
  initProfile(data) {
    const stmt = this.db.prepare(`
      INSERT INTO listener_feedback
        (message_id, feedback_type, music_direction, scene)
      VALUES (?, ?, ?, ?)
    `)

    const insertMany = this.db.transaction((rows) => {
      for (const row of rows) {
        stmt.run(row.messageId, row.feedbackType, row.musicDirection, row.scene)
      }
    })

    const rows = []

    // Preferred directions → more_like_this (+2)
    for (const dir of (data.preferredDirections || [])) {
      rows.push({ messageId: 'init-profile', feedbackType: 'more_like_this', musicDirection: dir, scene: '' })
    }

    // Disliked directions → less_like_this (-2)
    for (const dir of (data.dislikedDirections || [])) {
      rows.push({ messageId: 'init-profile', feedbackType: 'less_like_this', musicDirection: dir, scene: '' })
    }

    // Favorite scenes → more_like_this
    for (const scene of (data.favoriteScenes || [])) {
      rows.push({ messageId: 'init-profile', feedbackType: 'more_like_this', musicDirection: '', scene })
    }

    // Avoided scenes → less_like_this
    for (const scene of (data.avoidedScenes || [])) {
      rows.push({ messageId: 'init-profile', feedbackType: 'less_like_this', musicDirection: '', scene })
    }

    // Energy preference handled via synthetic direction
    const energyDirMap = {
      'low': 'ambient',
      'low-to-medium': 'chill',
      'medium': 'steady-groove'
    }
    const energyDir = energyDirMap[data.preferredEnergy]
    if (energyDir && !(data.preferredDirections || []).includes(energyDir)) {
      rows.push({ messageId: 'init-profile', feedbackType: 'more_like_this', musicDirection: energyDir, scene: '' })
    }

    if (rows.length > 0) {
      insertMany(rows)
    }

    this._profileCache = null
    console.log('[profile] initialized with', rows.length, 'seed entries')
    return this.getProfile()
  }

  getProfile() {
    if (this._profileCache) return this._profileCache
    this._profileCache = this._aggregate()
    return this._profileCache
  }

  _aggregate() {
    // Direction preference
    const dirPrefs = this.db.prepare(`
      SELECT music_direction,
             SUM(CASE
               WHEN feedback_type = 'like' THEN 1
               WHEN feedback_type = 'dislike' THEN -1
               WHEN feedback_type = 'more_like_this' THEN 2
               WHEN feedback_type = 'less_like_this' THEN -2
               ELSE 0 END) as score
      FROM listener_feedback
      WHERE music_direction IS NOT NULL AND music_direction != ''
      GROUP BY music_direction
      ORDER BY score DESC
    `).all()

    // Tag preference (derived from music_direction)
    const allTags = []
    for (const row of this.db.prepare(`
      SELECT feedback_type, music_direction FROM listener_feedback
      WHERE music_direction IS NOT NULL AND music_direction != ''
    `).all()) {
      const dirs = row.music_direction.split(',').map(d => d.trim()).filter(Boolean)
      for (const dir of dirs) {
        allTags.push({ tag: dir, type: row.feedback_type })
      }
    }

    const preferredDirections = dirPrefs.filter(d => d.score > 0).map(d => ({
      direction: d.music_direction,
      score: d.score
    }))
    const dislikedDirections = dirPrefs.filter(d => d.score < 0).map(d => ({
      direction: d.music_direction,
      score: d.score
    }))

    // Track preferences
    const favTracks = this.db.prepare(`
      SELECT track_title, track_artist, COUNT(*) as count
      FROM listener_feedback
      WHERE feedback_type IN ('like', 'more_like_this')
        AND track_title != ''
      GROUP BY track_title, track_artist
      ORDER BY count DESC
      LIMIT 10
    `).all()

    const disTracks = this.db.prepare(`
      SELECT track_title, track_artist, COUNT(*) as count
      FROM listener_feedback
      WHERE feedback_type IN ('dislike', 'less_like_this')
        AND track_title != ''
      GROUP BY track_title, track_artist
      ORDER BY count DESC
      LIMIT 10
    `).all()

    // Scene preference
    const scenePrefs = this.db.prepare(`
      SELECT scene,
             SUM(CASE
               WHEN feedback_type IN ('like', 'more_like_this') THEN 1
               WHEN feedback_type IN ('dislike', 'less_like_this') THEN -1
               ELSE 0 END) as score
      FROM listener_feedback
      WHERE scene IS NOT NULL AND scene != ''
      GROUP BY scene
    `).all()

    return {
      preferredDirections,
      dislikedDirections,
      preferredTags: preferredDirections.map(d => d.direction),
      dislikedTags: dislikedDirections.map(d => d.direction),
      favoriteScenes: scenePrefs.filter(s => s.score > 0).map(s => s.scene),
      avoidedScenes: scenePrefs.filter(s => s.score < 0).map(s => s.scene),
      preferredEnergy: this._inferPreferredEnergy(dirPrefs),
      preferredLanguage: 'chinese',
      favoriteTracks: favTracks.map(t => ({ title: t.track_title, artist: t.track_artist, count: t.count })),
      dislikedTracks: disTracks.map(t => ({ title: t.track_title, artist: t.track_artist, count: t.count }))
    }
  }

  _inferPreferredEnergy(dirPrefs) {
    const energyMap = {
      'steady-groove': 'medium',
      'light-electronic': 'medium',
      'instrumental': 'low-to-medium',
      'piano': 'low',
      'ambient': 'low',
      'chill': 'low-to-medium',
      'warm-vocal': 'low-to-medium',
      'rhythm-pop': 'medium',
      'acoustic': 'low-to-medium',
      'neo-classical': 'low',
      'late-night': 'low',
      'mandarin-pop': 'low-to-medium',
    }

    let bestEnergy = 'medium'
    let bestScore = -Infinity
    const scores = { low: 0, 'low-to-medium': 0, medium: 0 }

    for (const d of dirPrefs) {
      const e = energyMap[d.music_direction]
      if (e && d.score > 0) {
        scores[e] = (scores[e] || 0) + d.score
      }
    }

    for (const [e, s] of Object.entries(scores)) {
      if (s > bestScore) { bestScore = s; bestEnergy = e }
    }

    return bestEnergy
  }

  enrichProfileForPlanning() {
    const profile = this.getProfile()
    return {
      preferredTags: profile.preferredTags,
      dislikedTags: profile.dislikedTags,
      preferredEnergy: profile.preferredEnergy,
      preferredLanguage: profile.preferredLanguage,
      favoriteScenes: profile.favoriteScenes,
      avoidedScenes: profile.avoidedScenes
    }
  }
}

module.exports = ProfileService
