const { Router } = require('express')
const router = Router()

// GET /api/ncm/auth/qr-key — get unikey for QR login
router.get('/qr-key', async (req, res) => {
  const ncm = req.app.locals.ncmService
  const data = await ncm.getQrKey()
  res.json({ unikey: data?.data?.unikey || null })
})

// GET /api/ncm/auth/qr-create?key=xxx — create QR code image (base64)
router.get('/qr-create', async (req, res) => {
  const ncm = req.app.locals.ncmService
  const { key } = req.query
  if (!key) return res.status(400).json({ error: 'key required' })
  const data = await ncm.getQrCreate(key)
  res.json({ qrimg: data?.data?.qrimg || null })
})

// GET /api/ncm/auth/qr-check?key=xxx — poll QR scan status
//   800=expired, 801=waiting, 802=scanning, 803=authorized
router.get('/qr-check', async (req, res) => {
  const ncm = req.app.locals.ncmService
  const { key } = req.query
  if (!key) return res.status(400).json({ error: 'key required' })
  const data = await ncm.checkQrStatus(key)
  res.json({ code: data?.code || 801, message: data?.message || '' })
})

// GET /api/ncm/auth/status — current login status
router.get('/status', async (req, res) => {
  const ncm = req.app.locals.ncmService
  const data = await ncm.getLoginStatus()
  const loggedIn = data?.data?.account ? true : false
  res.json({ loggedIn, profile: data?.data?.profile || null })
})

// POST /api/ncm/auth/refresh — refresh login session
router.post('/refresh', async (req, res) => {
  const ncm = req.app.locals.ncmService
  const data = await ncm.refreshLogin()
  res.json({ ok: data?.code === 200 })
})

// POST /api/ncm/auth/logout — logout
router.post('/logout', async (req, res) => {
  const ncm = req.app.locals.ncmService
  await ncm.logout()
  ncm.clearCookies()
  res.json({ ok: true })
})

module.exports = router
