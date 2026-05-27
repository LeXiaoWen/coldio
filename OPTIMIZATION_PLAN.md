# coldio 5 项优化 — 实施完成

## 概述

基于用户提出的 5 项体验优化，按依赖关系分 Sprint 实施。以下记录每项任务的改动范围和涉及文件。

---

## Task 1: 界面色彩与面板布局优化

### 色彩扩展
- 新增 `--accent-secondary` (blue), `--accent-tertiary` (amber), `--overlay-bg`, `--panel-bg` 设计 tokens
- 文件: `public/styles.css`

### 面板改为 Overlay/Slideover 系统
- 新增 `.panel-overlay` (fixed 遮罩 + backdrop-filter blur)
- 新增 `.panel-slideover` (右侧滑入面板, 340px, z-index 101)
- 新增 `.panel-slideover-top` (顶部滑入面板, 50vh)
- Slots 面板 → 顶部滑入; Profile/History/Routines → 右侧滑入
- Escape 键 + 点击遮罩关闭
- 文件: `public/styles.css`, `public/app.js` (`closeAllOverlays()`, `_openOverlay()`)

---

## Task 2: 音频电平增强

### CSS (`public/styles.css`)
- 容器高度: 16px → 32px
- 条宽度: 3px → 6px, border-radius: 1px → 2px
- 单 `--audio-level` 变量 → 每段独立 `--audio-level-{0-6}`
- HSL 颜色渐变: 低频蓝(220°) → 中频绿(120°) → 高频红(0°)
- 每段独立 `box-shadow` 随电平脉动

### JS (`public/app.js` `_startLevelMeter()`)
- 频谱数据 (128 bins) 分为 7 个频段
- 每段独立计算平均值和平滑 (smoothing 0.25)
- 设置 `--audio-level-{n}` 变量

---

## Task 3: 天气融入每日节目生成

### 后端 (`server/services/PlannerService.js`)
- 构造函数接收 `weatherService` (第4参数)
- 新增 `WEATHER_MOOD_MAP` 常量: 雨→chill/-1能量, 晴→energetic/+1能量, 雪→warm/-1能量, 热→relax/-1能量, 少云/多云→ambient
- 新增 `_mapWeatherToMood(weather)` 方法
- `generateTodayPlan()` 获取天气, 在 slot.musicDirection 头部插入天气 tags, 微调 energy 级别
- 计划对象添加 `weather` 字段

### 服务器入口 (`server/index.js`)
- `PlannerService` 实例化时传入 `weatherService`

---

## Task 4: AI 主持 Overlay 模式

### 后端

**NCMService.js** — 新增 `getSongComments(id, limit)` 调用 `/comment/music`

**HostService.js** — 新增 `_generateTrackCommentary()`:
- 获取 NCM 热评, 调用 DeepSeek 生成口播文案
- Prompt 包含: title/artist/weather/comments
- 回退模板: "接下来是 artist 的《title》。"

**PlayerService.js** — Overlay 队列架构:
- 新增 `hostOverlayPlaying/hostOverlayText/hostOverlayId` 状态
- `_consumeVoiceAsOverlay()`: 设置 overlay 状态, 推进 queueIndex 越过 voice, setTimeout 结束
- `start()`: 首个 voice 立即消费为 overlay
- `_autoAdvance()`: voice 项调用 `_consumeVoiceAsOverlay()` 而非停止音乐
- `_clearOverlay()` 统一清理

### 前端

**双音频源架构** (`public/app.js`):
- 新增 `overlayAudioEl` 独立 `<audio>` 元素
- `applyState()` ducking: `hostOverlayPlaying` → music volume * 0.3 + overlay TTS 播放
- `speakOverlayText()` 备用 speechSynthesis

---

## Task 5: 网易云登录

### 后端

**NCMService.js** — Cookie 管理:
- `_cookies` 字段, `_loadCookies()/_saveCookies()` 持久化到 `data/ncm-cookies.txt`
- `_request()` 附带 Cookie header, 提取 set-cookie
- 新增方法: `getQrKey()`, `getQrCreate()`, `checkQrStatus()`, `getLoginStatus()`, `logout()`

**路由** (`server/routes/ncm-auth.js`):
- `GET /api/ncm/auth/qr-key`, `/qr-create`, `/qr-check`, `/status`
- 注册在 `server/app.js`

### 前端
- Header NCM 登录徽章 (`[NCM]` / `[NCM OK]`)
- QR 登录弹窗 + 2s 轮询
- 状态流转: 等待扫码(801)→已扫码(802)→登录成功(803)/过期(800)
- 文件: `public/index.html`, `public/app.js`, `public/styles.css`

---

## 验证方式

1. **Task 3**: 启动日志 `[planner] weather: 晴 32°C → mood: sunny`
2. **Task 5**: NCM 徽章 → 二维码 → 手机扫码 → 变绿 → cookie 持久化
3. **Task 4**: AI 播报时音乐闪避 → 播报内容含热评
4. **Task 2**: 7 条彩色电平条随频段跳动
5. **Task 1**: 面板从右侧/顶部滑入, blur 遮罩
