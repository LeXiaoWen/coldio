const axios = require('axios')

class HostService {
  constructor(plannerService, playerService, ncmService, weatherService) {
    this.plannerService = plannerService
    this.playerService = playerService
    this.ncmService = ncmService
    this.weatherService = weatherService
  }

  /**
   * Detect user intent from message
   */
  detectIntent(userMessage) {
    const msg = userMessage.trim().toLowerCase()

    // play_music — user wants specific music NOW
    if (/播放|放一首|播一首|帮我放|唱一首|来一首|换一首/.test(msg)) {
      return 'play_music'
    }

    // current_track
    if (/^[现在|正在|目前].*[放唱播听]/.test(msg) ||
        /歌名|什么歌/.test(msg) ||
        /^(what|now playing|current)/.test(msg)) {
      return 'current_track'
    }

    // program_slot
    if (/节目|时段|节目单|slot|现在.*段/.test(msg)) {
      return 'program_slot'
    }

    // recommendation
    if (/推荐|想听|来点|换一首|适合|有没有|放点|推荐.*歌/.test(msg)) {
      return 'recommendation'
    }

    return 'chat'
  }

  getSystemPrompt() {
    const slot = this.plannerService.getCurrentSlot()
    const current = this.playerService.getState().current
    const pacing = this._getPacingForSlot(slot)

    let trackInfo = ''
    if (current) {
      trackInfo = `当前播放：${current.title} - ${current.artist}`
    }

    return `你叫Codio，是用户的私人AI电台主持兼音乐策展人。你的性格冷静、亲密、准确、略带夜间气质。
用中文自然口语交流，不要播音腔。不啰嗦、不油滑、有温度、有品味。
${pacing.lengthGuide}不用表情符号，不用markdown。

当前场景：${slot.title}（${slot.timeRange}）
${trackInfo}`
  }

  /**
   * Return pacing parameters based on current time slot
   */
  _getPacingForSlot(slot) {
    const slotId = slot?.id || ''
    const map = {
      'morning-wake': {
        lengthGuide: '回复简洁明快，20-40字。语速轻快有活力。',
        maxTokens: 150,
        temperature: 0.7
      },
      'deep-work': {
        lengthGuide: '回复尽量简短，15-30字。少打扰，不拖沓。',
        maxTokens: 100,
        temperature: 0.6
      },
      'noon-breath': {
        lengthGuide: '回复温和放松，30-60字。语气舒缓。',
        maxTokens: 200,
        temperature: 0.75
      },
      'afternoon-drive': {
        lengthGuide: '回复简洁有节奏，20-40字。保持适度活力。',
        maxTokens: 150,
        temperature: 0.7
      },
      'evening-soften': {
        lengthGuide: '回复温暖柔和，40-80字。可以稍微多说一点。',
        maxTokens: 250,
        temperature: 0.8
      },
      'night-close': {
        lengthGuide: '回复安静低沉，30-60字。语速放缓，像深夜电台。',
        maxTokens: 200,
        temperature: 0.75
      }
    }
    return map[slotId] || {
      lengthGuide: '回复简洁自然，40-80字之间。',
      maxTokens: 200,
      temperature: 0.8
    }
  }

  /**
   * Handle a chat message: detect intent and generate reply
   */
  async handleChat(userMessage) {
    const intent = this.detectIntent(userMessage)
    const context = this._buildContext()

    // Always fetch weather context so the host is weather-aware in every reply
    if (this.weatherService) {
      try {
        context.weather = await this.weatherService.getWeather()
      } catch { /* degraded */ }
    }

    let reply = ''

    switch (intent) {
      case 'current_track':
        reply = this._replyCurrentTrack(context)
        break
      case 'program_slot':
        reply = this._replyProgramSlot(context)
        break
      case 'play_music':
        reply = await this._replyPlayMusic(userMessage, context)
        break
      case 'recommendation':
        reply = await this._replyRecommendation(userMessage, context)
        break
      default:
        reply = await this._replyChat(userMessage, context)
    }

    return { reply, intent, slot: context.currentSlot }
  }

  _buildContext() {
    const state = this.playerService.getState()
    return {
      currentTrack: state.current,
      currentSlot: this.plannerService.getCurrentSlot(),
      allTracks: this.libraryService ? this.libraryService.getAllTracks() : [],
      queueIds: state.queue.map(q => q.id),
      weather: { fetched: false } // placeholder, lazily loaded in _replyChat
    }
  }

  _replyCurrentTrack(context) {
    const track = context.currentTrack
    if (!track) return '当前没有在播放曲目。'
    return `现在播放的是 ${track.artist} 的《${track.title}》。${track.source === 'local' ? '来自本地曲库' : '在线精选'}。`
  }

  _replyProgramSlot(context) {
    const slot = context.currentSlot
    if (!slot) return '当前没有节目时段。'
    return `现在是「${slot.title}」时段（${slot.timeRange}），音乐方向：${slot.musicDirection?.join('、') || '混合'}。`
  }

  /**
   * Extract artist and song title from a play request message
   */
  _extractMusicRequest(userMessage) {
    const msg = userMessage.trim()

    // Strip known play-verb prefixes
    const verbRe = /^(?:帮我放一首|帮我播放|帮我放|放一首|播放|播一首|来一首|唱一首|换一首)\s*/
    const afterVerb = msg.replace(verbRe, '')

    if (afterVerb === msg) {
      // No verb found — try to extract anyway (fallback to full msg)
    }

    // Pattern: ARTIST 的《SONG》
    const withBrackets = afterVerb.match(/^(.+?)的?[《（](.+?)[》）]/)
    if (withBrackets) {
      return { artist: withBrackets[1].trim(), song: withBrackets[2].trim() }
    }

    // Pattern: ARTIST 的 SONG (unless SONG is a generic term like 歌/音乐/曲子)
    const withDe = afterVerb.match(/^(.+?)的(.+)/)
    if (withDe) {
      const song = withDe[2].trim()
      if (!/^(歌|音乐|曲子|曲调|旋律)$/.test(song)) {
        return { artist: withDe[1].trim(), song }
      }
    }

    // Pattern: ARTIST 的歌/音乐/曲子 (no specific song request)
    const artistOnly = afterVerb.match(/^(.+?)(?:的歌|的音乐|的曲子)?$/)
    if (artistOnly) {
      return { artist: artistOnly[1].trim(), song: null }
    }

    return { artist: null, song: afterVerb || null }
  }

  async _replyPlayMusic(userMessage, context) {
    const request = this._extractMusicRequest(userMessage)

    // Try local library first
    let track = this._findLocalTrack(request)
    if (track) {
      this.playerService.playTrack(track)
      return `${track.artist}的《${track.title}》，马上开始播放。`
    }

    // Try NCM search
    if (this.ncmService) {
      try {
      // Include both artist and song in search for better results
      const keyword = request.song
        ? `${request.artist || ''} ${request.song}`
        : (request.artist || '')
      const data = await this.ncmService.search(keyword, 1, 10)
      const songs = data?.result?.songs
      if (songs && songs.length > 0) {
        let match = songs[0]
        // If we have a specific song title, find the best match
        if (request.song) {
          const lowerSong = request.song.toLowerCase()
          match = songs.find(s =>
            (s.name || '').toLowerCase().includes(lowerSong)
          ) || songs[0]
        }

          const ncmTrack = {
            id: `ncm-${match.id}`,
            title: match.name || '',
            artist: (match.artists || match.ar || []).map(a => a.name).join(', '),
            source: 'netease',
            duration: Math.floor((match.duration || match.dt || 0) / 1000) || 30,
            ncmId: match.id,
            album: match.album?.name || match.al?.name || ''
          }

          this.playerService.playTrack(ncmTrack)
          const artistName = (match.artists || match.ar || []).map(a => a.name).join(', ')
          return `${artistName}的《${match.name}》，马上开始播放。`
        }
      } catch (e) {
        console.warn('[host] ncm search failed:', e.message)
      }
    }

    return '没有找到这首歌的在线资源。要不换个关键词再试试？'
  }

  _findLocalTrack(request) {
    const tracks = this._libraryService?.getAllTracks() || []
    if (tracks.length === 0) return null

    let best = null

    for (const track of tracks) {
      const titleMatch = request.song
        ? track.title.includes(request.song) || request.song.includes(track.title)
        : true
      const artistMatch = request.artist
        ? track.artist.includes(request.artist) || request.artist.includes(track.artist)
        : true

      if (titleMatch && artistMatch) {
        if (!best) {
          best = track
        } else {
          // Prefer exact artist match
          const bestArtistHit = request.artist && best.artist.includes(request.artist)
          const curArtistHit = request.artist && track.artist.includes(request.artist)
          const bestTitleHit = request.song && best.title.includes(request.song)
          const curTitleHit = request.song && track.title.includes(request.song)
          if (curArtistHit && !bestArtistHit) best = track
          else if (curTitleHit && !bestTitleHit) best = track
        }
      }
    }

    return best
  }

  async _replyRecommendation(userMessage, context) {
    const tracks = context.allTracks

    // Try local library first
    if (tracks.length > 0) {
      const scored = tracks.map(track => ({
        ...track,
        score: this._scoreForRecommendation(track, userMessage, context)
      }))
      scored.sort((a, b) => b.score - a.score)
      const top = scored.slice(0, 3).filter(t => t.score > 0)

      // Use local track if found and it has a real audio file
      if (top.length > 0) {
        const best = top[0]
        if (best.filepath) {
          this.playerService.playTrack(best)
          return `找到了，先放一首${best.artist}的《${best.title}》，希望你喜欢。`
        }
      }
    }

    // No good local match — search NCM with mood/time keywords from the message
    if (this.ncmService) {
      try {
        const keywords = this._extractRecommendationKeywords(userMessage)
        const data = await this.ncmService.search(keywords, 1, 10)
        const songs = data?.result?.songs
        if (songs && songs.length > 0) {
          const match = songs[0]
          const ncmTrack = {
            id: `ncm-${match.id}`,
            title: match.name || '',
            artist: (match.artists || match.ar || []).map(a => a.name).join(', '),
            source: 'netease',
            duration: Math.floor((match.duration || match.dt || 0) / 1000) || 30,
            ncmId: match.id,
            album: match.album?.name || match.al?.name || ''
          }
          this.playerService.playTrack(ncmTrack)
          const artistName = (match.artists || match.ar || []).map(a => a.name).join(', ')
          return `找到了，先放一首${artistName}的《${match.name}》，希望你喜欢。`
        }
      } catch (e) {
        console.warn('[host] ncm recommendation search failed:', e.message)
      }
    }

    // Fallback: just reply with a recommendation text, don't force-play
    if (tracks.length > 0) {
      const scored = tracks.map(track => ({
        ...track,
        score: this._scoreForRecommendation(track, userMessage, context)
      }))
      scored.sort((a, b) => b.score - a.score)
      const best = scored[0]
      return `推荐你听听${best.artist}的《${best.title}》，和现在的氛围很搭。`
    }

    return '暂时没有找到特别匹配的曲目。要不要换个关键词试试？'
  }

  _extractRecommendationKeywords(userMessage) {
    const msg = userMessage.toLowerCase()
    // Strip common chat prefixes before keyword matching
    const stripped = msg.replace(/^(中午了|下午了|晚上了|早上好|晚安|你好|hi|hello)\s*/, '').replace(/，|,/, ' ')
    // Extract meaningful mood/time keywords for NCM search
    const moodMap = {
      '凌晨': '深夜 安静 钢琴',
      '早上': '清晨 醒神 电子',
      '中午': '午后 轻音乐 安静',
      '下午': '午后 轻快 氛围',
      '晚上': '夜晚 安静 钢琴',
      'morning': '清晨 轻快',
      'night': '深夜 安静',
      '晚': '夜晚 安静 钢琴',
      '下雨': '雨 钢琴 安静',
      '雨': '雨 钢琴 安静',
      '放松': '放松 轻音乐',
      'relax': '放松 轻音乐',
      '工作': '专注 轻电子',
      'work': '专注 纯音乐',
      '学习': '专注 轻音乐',
      'study': '专注 轻音乐',
      '运动': '节奏 动感',
      'sad': '伤感 钢琴',
      '开心': '轻快 欢快',
      'happy': '轻快 upbeat',
      'chill': 'chill 氛围',
      '安静': '安静 钢琴'
    }

    for (const [key, vals] of Object.entries(moodMap)) {
      if (stripped.includes(key) || msg.includes(key)) return vals
    }

    // Default: extract non-trivial words as search terms
    const terms = msg.match(/[a-zA-Z]{2,}|[一-鿿]{2,}/g) || ['轻音乐']
    // Filter out common chat verbs, keep meaningful terms
    const filtered = terms.filter(t =>
      !/^(推荐|来一首|帮|换一首|放点|有没有|一首|人了)$/.test(t)
    )
    return (filtered.length > 0 ? filtered : terms).slice(0, 3).join(' ')
  }

  _scoreForRecommendation(track, userMessage, context) {
    let score = 0
    const msg = userMessage.toLowerCase()

    // Mood match: +16
    const moodKeywords = {
      'morning': ['早上', '清醒', 'morning', '起床', '晨'],
      'focus': ['专注', 'focus', '工作', 'work', '学习', 'study', '编程', 'code'],
      'drive': ['开车', 'drive', '路上', '通勤', '下午'],
      'warm': ['温暖', 'warm', '放松', 'relax', '晚上', 'evening'],
      'midnight': ['深夜', 'midnight', '安静', '安静', 'sleep', 'night', '晚'],
      'open': []
    }

    for (const [mood, keywords] of Object.entries(moodKeywords)) {
      if (keywords.some(k => msg.includes(k)) && track.mood === mood) {
        score += 16
        break
      }
    }

    // Keyword hits: +5
    const keywords = msg.split(/[\s,，。、]+/).filter(k => k.length > 1)
    for (const kw of keywords) {
      if ([track.title, track.artist, track.filename, track.mood].some(
        f => (f || '').toLowerCase().includes(kw.toLowerCase())
      )) {
        score += 5
      }
    }

    // Source priority: +1.2
    if (track.source === 'netease') score += 1.2

    // Dedup: -6
    if (context.queueIds && context.queueIds.includes(track.id)) score -= 6

    // Version bonus: +1.5
    const versionRegex = /remix|bootleg|cover|piano|instrumental|纯音|翻唱/i
    if (versionRegex.test(track.title || '') || versionRegex.test(track.filename || '')) score += 1.5

    return score
  }

  async _replyChat(userMessage, context) {
    // Try DeepSeek, fall back to template
    if (process.env.DEEPSEEK_API_KEY) {
      try {
        return await this._callDeepSeek(userMessage, context)
      } catch (e) {
        console.warn('[host] deepseek failed:', e.message)
      }
    }
    return this._templateReply(userMessage, context)
  }

  async _callDeepSeek(userMessage, context) {
    const apiKey = process.env.DEEPSEEK_API_KEY
    const apiBase = process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com/v1'
    const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

    const slot = context.currentSlot
    const pacing = this._getPacingForSlot(slot)

    // Build weather context line
    let weatherLine = ''
    const w = context.weather
    if (w && w.status === 'ready') {
      weatherLine = `当前天气：${w.city}，${w.summary}，${w.temperature}°C`
    }

    const sysPrompt = weatherLine
      ? this.getSystemPrompt() + `\n${weatherLine}`
      : this.getSystemPrompt()

    const res = await axios.post(`${apiBase}/chat/completions`, {
      model,
      messages: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: pacing.maxTokens,
      temperature: pacing.temperature
    }, {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 15000
    })

    const reply = res.data?.choices?.[0]?.message?.content
    if (reply) return reply

    throw new Error('empty deepseek response')
  }

  _templateReply(userMessage, context) {
    // Keyword matching for fallback
    const msg = userMessage.toLowerCase()
    const track = context.currentTrack
    const slot = context.currentSlot

    if (/你好|hi|hello|嗨/i.test(msg)) return '你好，我是 Codio。今天想听什么感觉的音乐？'
    if (/谢谢|thank/i.test(msg)) return '不客气。有需要随时叫我。'

    // Weather-aware replies
    if (/天气|下雨|晴天|雨|雪|多云|阴天/i.test(msg)) {
      const w = context.weather
      if (w && w.status === 'ready') {
        if (/下雨|雨/.test(msg) || /雨/.test(w.summary)) {
          return `外面${w.summary}，${w.temperature}°C。雨天适合听些安静的音乐，我调整一下选曲方向。`
        }
        if (/雪/.test(w.summary)) {
          return `外面${w.summary}，${w.temperature}°C。下雪天特别适合听一些温暖松弛的曲子，我帮你挑。`
        }
        return `外面${w.summary}，${w.temperature}°C。天气好的时候，音乐也会更明朗一些。`
      }
      return '雨天适合听些安静的音乐。我调整一下选曲方向。'
    }
    if (/心情|emo|难过|累|疲惫/i.test(msg)) return '听点舒缓的，让节奏慢下来。我帮你选一些温柔的曲目。'
    if (/工作|学习|写代码|专注/i.test(msg)) return '进入专注模式。我会选少人声、稳定律动的曲目。'

    return `现在是「${slot?.title || '当前'}」时段，${track ? `正在播放 ${track.artist} 的《${track.title}》` : '旋律正在流淌'}。有什么想听的告诉我。`
  }

  /**
   * Generate a dynamic startup greeting with weather context and NCM track
   */
  async generateDynamicOpening() {
    let weather = null
    if (this.weatherService) {
      try {
        weather = await this.weatherService.getWeather()
      } catch { /* degraded */ }
    }

    const hour = new Date().getHours()
    let timeGreeting, timeSuffix

    if (hour < 6) {
      timeGreeting = '凌晨好'
      timeSuffix = '夜深人静，让音乐温柔地包裹你。'
    } else if (hour < 9) {
      timeGreeting = '早上好'
      timeSuffix = '早晨刚刚开始，用音乐唤醒一天的灵感吧。'
    } else if (hour < 12) {
      timeGreeting = '上午好'
      timeSuffix = '上午的时光，让轻松的氛围陪伴你。'
    } else if (hour < 14) {
      timeGreeting = '中午好'
      timeSuffix = '午间时分，让音乐陪你慢慢呼吸。'
    } else if (hour < 17) {
      timeGreeting = '下午好'
      timeSuffix = '来点音乐给节奏加点变化。'
    } else if (hour < 20) {
      timeGreeting = '傍晚好'
      timeSuffix = '傍晚时分，让节奏慢慢放缓。'
    } else {
      timeGreeting = '晚上好'
      timeSuffix = '夜深了，用音乐给今天画一个温柔的句号。'
    }

    let greeting
    if (weather && weather.status === 'ready') {
      greeting = `${timeGreeting}，我是 Codio。现在外面${weather.summary}，${weather.temperature}°C。${timeSuffix}先送上一首合适的曲子。`
    } else {
      const slot = this.plannerService.getCurrentSlot()
      greeting = `${timeGreeting}，我是 Codio，你的私人音乐搭档。现在是「${slot?.title || '当前'}」时段，已经为你准备好了合适的音乐。先送上一首。`
    }

    // Search NCM for a matching track based on time + weather
    let ncmTrack = null
    if (this.ncmService) {
      try {
        const keywords = this._getTimeWeatherKeywords(weather)
        const data = await this.ncmService.search(keywords, 1, 5)
        const songs = data?.result?.songs
        if (songs && songs.length > 0) {
          const match = songs[0]
          ncmTrack = {
            id: `ncm-${match.id}`,
            title: match.name || '',
            artist: (match.artists || match.ar || []).map(a => a.name).join(', '),
            source: 'netease',
            duration: Math.floor((match.duration || match.dt || 0) / 1000) || 30,
            ncmId: match.id,
            album: match.album?.name || match.al?.name || ''
          }
          console.log('[host] startup found NCM track:', match.name, 'by', ncmTrack.artist)
        }
      } catch (e) {
        console.warn('[host] startup ncm search failed:', e.message)
      }
    }

    return { greeting, ncmTrack }
  }

  _getTimeWeatherKeywords(weather) {
    const hour = new Date().getHours()
    let base = '轻音乐'

    if (hour < 6) base = '深夜 安静 钢琴'
    else if (hour < 9) base = '清晨 醒神 轻快'
    else if (hour < 13) base = '轻音乐 安静'
    else if (hour < 18) base = '午后 轻快 氛围'
    else base = '夜晚 安静 钢琴'

    if (weather && weather.status === 'ready') {
      const summary = weather.summary || ''
      if (summary.includes('雨')) return `${base} 下雨 治愈`
      if (summary.includes('雪')) return `${base} 雪 温暖`
      if (summary.includes('阴') || summary.includes('多云')) return `${base} 安静`
      if (summary.includes('晴')) return `${base} 阳光`
    }

    return base
  }

  /**
   * Generate host copy for a slot
   */
  async generateIntroCopy(slotId, tracks, timeContext) {
    const slot = this.plannerService.getSlotById(slotId) || this.plannerService.getCurrentSlot()

    if (process.env.DEEPSEEK_API_KEY && tracks && tracks.length > 0) {
      try {
        return await this._generateAICopy(slot, tracks)
      } catch (e) {
        console.warn('[host] AI copy failed, using template:', e.message)
      }
    }

    return this._generateSyncCopy(slot, tracks)
  }

  _generateSyncCopy(slot, tracks) {
    const opening = slot.opening || `现在是「${slot.title}」时段。`
    const firstTrack = tracks && tracks[0]
    const openingWithTrack = firstTrack
      ? `${opening}第一首带来 ${firstTrack.artist} 的《${firstTrack.title}》。`
      : opening

    const closing = slot.closing || `「${slot.title}」时段接近尾声。`

    return { opening: openingWithTrack, closing, break: '' }
  }

  async _generateAICopy(slot, tracks) {
    const tracksInfo = tracks.map((t, i) => `${i + 1}. ${t.artist} - ${t.title}`).join('\n')
    const pacing = this._getPacingForSlot(slot)

    const prompt = `
当前时段：${slot.title}（${slot.timeRange}）
场景：${slot.scene}，能量：${slot.energy}
音乐方向：${slot.musicDirection.join(', ')}

曲目列表：
${tracksInfo}

请生成三段口播文案：
1. 开场白：介绍这个时段和第一首歌${pacing.maxTokens < 150 ? '（50-80字，简洁）' : '（130-210字）'}
2. 间奏过渡：串词衔接曲目${pacing.maxTokens < 150 ? '（30-50字，简短）' : '（80-150字）'}
3. 结束语：时段收束${pacing.maxTokens < 150 ? '（40-60字）' : '（80-130字）'}

直接用中文回复，三段之间用 === 分隔。`

    const res = await axios.post(`${process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com/v1'}/chat/completions`, {
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      messages: [
        { role: 'system', content: '你叫Codio，是私人AI电台主持。回复简洁自然，适合TTS朗读。不用表情符号，不用markdown。' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 800,
      temperature: 0.8
    }, {
      headers: { 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 15000
    })

    const content = res.data?.choices?.[0]?.message?.content || ''
    const parts = content.split('===').map(s => s.trim()).filter(Boolean)

    return {
      opening: parts[0] || slot.opening,
      break: parts[1] || '',
      closing: parts[2] || slot.closing
    }
  }

  /**
   * Generate a warm, heartfelt commentary for a track using DeepSeek.
   * Includes song background, lyrics excerpt, and popular NCM comments.
   * Used as the AI host's 暖心话语 when transitioning between songs.
   */
  async generateTrackCommentary(track, slot) {
    if (!process.env.DEEPSEEK_API_KEY) {
      return `${track.artist}的《${track.title}》，一首很特别的歌，希望你能感受到它带来的温度。`
    }

    // Fetch NCM hot comments
    let hotComments = []
    if (this.ncmService && track.ncmId) {
      try {
        const [commentsData, lyricData] = await Promise.all([
          this.ncmService.getSongComments(track.ncmId, 10),
          this.ncmService.getLyric(track.ncmId).catch(() => null)
        ])
        hotComments = (commentsData?.hotComments || []).slice(0, 3).map(c => c.content)
      } catch (e) {
        console.warn('[host] comment/lyric fetch failed:', e.message)
      }
    }

    const weatherLine = ''
    // Helper to extract a meaningful lyric excerpt (skip time tags, instrumental markers)

    const prompt = `你叫Codio，是用户的私人AI电台主持兼音乐策展人。性格冷静、亲密、温暖，略带夜间气质。

为歌曲《${track.title}》- ${track.artist} 播报一段暖心的话。
${track.album ? `专辑：${track.album}` : ''}
时段：${slot?.title || '当前'}（${slot?.timeRange || ''}）
${weatherLine}

${hotComments.length > 0 ? `这首歌下的听众留言：
${hotComments.map(c => `- ${c}`).join('\n')}` : ''}

要求：
1. 从歌曲的情绪或意境出发，说一段温暖人心的话
2. ${hotComments.length > 0 ? '自然地融合一条留言的感受，像在分享自己的触动，不要生硬"有听众说"' : '描述这首歌带来的氛围和温度'}
3. 让听众感到被陪伴、被理解——像朋友在深夜分享一首好歌
4. 30-65字，适合TTS语音朗读，自然口语
5. 不用表情符号，不用markdown，不要播音腔
6. 不评价歌曲本身好不好听，而是分享它带来的感觉

直接输出文案。`

    try {
      const res = await axios.post(`${process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com/v1'}/chat/completions`, {
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是Codio，私人AI电台主持。用自然口语，温暖克制，适合TTS语音播报。不用表情符号，不用markdown。' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.85
      }, {
        headers: { 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 15000
      })

      const reply = res.data?.choices?.[0]?.message?.content?.trim()
      if (reply) {
        console.log('[host] generated warm commentary for:', track.title)
        return reply
      }
    } catch (e) {
      console.warn('[host] warm commentary gen failed:', e.message)
    }

    return `${track.artist}的《${track.title}》，在这个${slot?.title || '时刻'}，让旋律替你说话。`
  }
}

// For LibraryService access
Object.defineProperty(HostService.prototype, 'libraryService', {
  get() { return this._libraryService },
  set(v) { this._libraryService = v }
})

module.exports = HostService
