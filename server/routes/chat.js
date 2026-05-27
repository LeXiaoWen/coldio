const { Router } = require('express')
const router = Router()

router.post('/', async (req, res) => {
  const host = req.app.locals.hostService
  const player = req.app.locals.playerService
  const db = req.app.locals.db

  const { message } = req.body
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'message required' })
  }

  // Save user message
  const userNow = new Date().toISOString().replace('T', ' ').slice(0, 19)
  db.prepare('INSERT INTO messages (role, nickname, content, created_at) VALUES (?, ?, ?, ?)').run('user', '你', message.trim(), userNow)

  // Generate reply
  try {
    const result = await host.handleChat(message.trim())

    // Save host reply with its own timestamp
    const hostNow = new Date().toISOString().replace('T', ' ').slice(0, 19)
    db.prepare('INSERT INTO messages (role, nickname, content, created_at) VALUES (?, ?, ?, ?)').run('host', 'Codio', result.reply, hostNow)

    res.json({
      reply: result.reply,
      intent: result.intent,
      slot: result.slot,
      timestamp: hostNow
    })
  } catch (e) {
    console.error('[chat] error:', e)
    res.status(500).json({ error: 'failed to generate reply', reply: '抱歉，我有点卡顿了。稍后再试试？' })
  }
})

// Get message history
router.get('/', (req, res) => {
  const db = req.app.locals.db
  const messages = db.prepare('SELECT * FROM messages ORDER BY created_at ASC').all()
  res.json({ messages })
})

// DELETE /api/chat — clear all messages and re-seed initial 3
router.delete('/', (req, res) => {
  const db = req.app.locals.db
  db.prepare('DELETE FROM messages').run()

  const insert = db.prepare('INSERT INTO messages (role, nickname, content, created_at) VALUES (?, ?, ?, ?)')
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  insert.run('host', 'Codio', '你好，我是 Codio，你的私人 AI 电台主持。我会 24 小时为你放音乐、聊聊天，根据你的状态调整氛围。试试告诉我你现在想听什么样的音乐吧。', now)
  insert.run('user', '你', '今天下雨，想听一点松弛的歌。', now)
  insert.run('host', 'Codio', '收到。雨天真的很适合把节奏放慢。我挑了几首带雨声元素的 chill 曲目，先从钢琴和轻电子开始，让氛围慢慢铺开。', now)

  console.log('[chat] messages cleared, re-seeded')
  res.json({ ok: true })
})

module.exports = router
