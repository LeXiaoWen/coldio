const { Router } = require('express')
const router = Router()

// POST /api/memory/feedback
router.post('/feedback', (req, res) => {
  const profile = req.app.locals.profileService
  const data = req.body

  if (!data.messageId || !data.feedbackType) {
    return res.status(400).json({ error: 'messageId and feedbackType required' })
  }

  try {
    profile.recordFeedback(data)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/memory/feedback — get all feedback records (for persistence across refreshes)
router.get('/feedback', (req, res) => {
  const db = req.app.locals.db
  try {
    const rows = db.prepare('SELECT message_id, feedback_type, created_at FROM listener_feedback ORDER BY created_at ASC').all()
    res.json({ feedback: rows })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/memory/profile
router.get('/profile', (req, res) => {
  const profile = req.app.locals.profileService
  res.json(profile.getProfile())
})

// POST /api/memory/parse-review — parse a "锐评" text into structured preferences via DeepSeek
router.post('/parse-review', async (req, res) => {
  const { text } = req.body
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'text required' })
  }

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return res.status(503).json({ error: 'DeepSeek not configured' })
  }

  try {
    const axios = require('axios')
    const apiBase = process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com/v1'
    const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

    const prompt = `你是一个音乐品味分析助手。用户会给你一段对听歌品味的"锐评"文本，请提取出以下结构化信息，用 JSON 格式返回（只返回 JSON，不要其他内容）：

{
  "preferredDirections": ["偏好的音乐方向标签数组"],
  "dislikedDirections": ["不喜欢的音乐方向标签数组"],
  "favoriteScenes": ["偏好的场景，morning/work/noon/afternoon/evening/night"],
  "avoidedScenes": ["回避的场景"],
  "preferredEnergy": "low | low-to-medium | medium"
}

可用的音乐方向标签：
piano, ambient, light-electronic, instrumental, chill, relax, city, acoustic, warm-vocal, neo-classical, steady-groove, rhythm-pop, mandarin-pop, rainy-day, late-night

用户的锐评：
${text}`

    const response = await axios.post(`${apiBase}/chat/completions`, {
      model,
      messages: [
        { role: 'system', content: '你提取音乐品味偏好，只返回 JSON。' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 500,
      temperature: 0.3
    }, {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 15000
    })

    const content = response.data?.choices?.[0]?.message?.content || '{}'
    // Extract JSON from response (handle markdown code fences)
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content)

    res.json({
      ok: true,
      preferences: {
        preferredDirections: parsed.preferredDirections || [],
        dislikedDirections: parsed.dislikedDirections || [],
        favoriteScenes: parsed.favoriteScenes || [],
        avoidedScenes: parsed.avoidedScenes || [],
        preferredEnergy: parsed.preferredEnergy || 'medium'
      }
    })
  } catch (e) {
    console.warn('[memory] parse-review failed:', e.message)
    res.status(500).json({ error: 'parse failed: ' + e.message })
  }
})

// POST /api/memory/init-profile — initialize listener profile with structured preferences
router.post('/init-profile', (req, res) => {
  const profile = req.app.locals.profileService
  const planner = req.app.locals.plannerService
  const { preferredDirections, dislikedDirections, favoriteScenes, avoidedScenes, preferredEnergy } = req.body

  try {
    const result = profile.initProfile({
      preferredDirections: preferredDirections || [],
      dislikedDirections: dislikedDirections || [],
      favoriteScenes: favoriteScenes || [],
      avoidedScenes: avoidedScenes || [],
      preferredEnergy: preferredEnergy || 'medium'
    })

    // Regenerate today's plan with updated profile
    if (planner) {
      planner.regeneratePlan().catch(e => console.warn('[memory] plan regen after init:', e.message))
    }

    res.json({ ok: true, profile: result })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
