# coldio — Your Private AI Radio. 24/7.

> 一个 24 小时在线的私人 AI 电台终端。不是音乐播放器，不是聊天 App，不是后台控制台——是三者融合后的电台设备界面。

---

## 目录

- [快速开始](#快速开始)
- [功能概览](#功能概览)
- [系统架构](#系统架构)
- [配置指南](#配置指南)
- [使用方法](#使用方法)
- [API 文档](#api-文档)
- [技术栈](#技术栈)
- [开发](#开发)

---

## 快速开始

### 前置依赖

- Node.js >= 20
- 可选：[NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi)（本地运行，端口 3000）

### 安装

```bash
git clone <repo-url> coldio
cd coldio
npm install
```

### 配置

复制环境变量模板并填入你的 API Key：

```bash
cp .env.example .env
```

至少需要以下配置才能完整运行：

| 配置项 | 必需 | 说明 |
|--------|------|------|
| `DEEPSEEK_API_KEY` | ✅ | AI 主持人对话模型 |
| `DOUBAO_TTS_API_KEY` | ✅ | 火山引擎语音合成 |
| `NCM_API_BASE` | 可选 | 网易云音乐 API 地址，默认 `http://localhost:3000` |
| `OPENWEATHER_API_KEY` | 可选 | 天气信息（无则跳过） |
| `RADIO_LIBRARY_DIRS` | 可选 | 本地音乐目录路径 |

### 启动

```bash
# 确保 NeteaseCloudMusicApi 已运行（可选）
cd NeteaseCloudMusicApi && node app.js &

# 启动 coldio
cd coldio
node server/index.js
```

浏览器打开 `http://localhost:3001`。

---

## 功能概览

### 播放器

| 功能 | 说明 |
|------|------|
| 播放/暂停 | 点击中央按钮或按 Space 键 |
| 上一首/下一首 | 键盘 ← / → 或点击按钮 |
| 24 段进度条 | 点击进度条任意段跳转 |
| 音量控制 | 10 段音量条 + 静音切换（M 键） |
| 歌曲收藏 | 心形按钮标记喜欢的曲目 |
| 歌词同步 | 自动获取并高亮当前歌词行（含翻译） |
| 音频电平 | 7 条柱状图实时可视化 |

### AI 主持人（Codio）

| 功能 | 说明 |
|------|------|
| 人格化对话 | DeepSeek 驱动，冷静、亲密、有品味 |
| 时段感知 | 6 个时段自动切换主持风格（清晨→深夜） |
| 天气感知 | 对话时自动携带天气上下文 |
| 启动动态播报 | 系统启动时根据天气+时间生成开场白 |
| 语音合成 | 火山引擎 TTS（高质量），浏览器 speechSynthesis 回退 |
| 意图理解 | 识别播放/查询/推荐/闲聊 4 种意图 |

### 节目编排

| 功能 | 说明 |
|------|------|
| 6 时段模板 | morning-wake → night-close 自适应切换 |
| Track Scoring | 8 因子加权评分（场景/能量/方向/偏好等） |
| Routine 集成 | 从 `user/routines.json` 加载自定义活动 |
| 自动生成+持久化 | 每日节目计划存入 SQLite |
| 手动再生 | 一键重新编排当天节目 |
| 节目面板 | 展开查看 6 时段详情，当前高亮 |

### 聊天互动

| 功能 | 说明 |
|------|------|
| 双向消息 | 主持人左/用户右气泡排版 |
| 消息持久化 | SQLite + localStorage 双重保障 |
| 语音输入 | Web Speech API 语音识别 |
| 反馈闭环 | 喜欢/不喜欢/多来点/少推荐 → 影响选曲 |
| 听者画像 | 自动聚合偏好/厌恶的方向/场景/风格 |

### 本地曲库

| 功能 | 说明 |
|------|------|
| 文件扫描 | 扫描指定目录的 mp3/flac/m4a/wav/ogg |
| 元数据推断 | 从文件名推断 mood/tags/energy/sceneFit/language |
| Artist-First 解析 | 智能判断中英文文件名格式 |
| 在线歌单导入 | 网易云歌单 + 通用 JSON 歌单 |
| Track Identity 纠正 | 手动修正识别错误的曲目信息 |

---

## 系统架构

```
┌─────────────────────────────────────────────┐
│                  Frontend                     │
│  index.html + app.js + styles.css            │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
│  │WebSocket  │ │ fetch()  │ │ Web Audio   │  │
│  │(状态同步)  │ │ (REST)   │ │ API (电平)   │  │
│  └──────────┘ └──────────┘ └─────────────┘  │
│  ┌──────────┐ ┌──────────────┐              │
│  │speechSyn.│ │SpeechRecog.  │              │
│  │(TTS回退)  │ │(语音输入)    │              │
│  └──────────┘ └──────────────┘              │
└──────────────────┬──────────────────────────┘
                   │ WebSocket + HTTP
┌──────────────────┴──────────────────────────┐
│              Backend (Express)               │
│                                              │
│  Services (9):                               │
│  ┌──────────────────────────────────────┐   │
│  │ HostService   ←→ DeepSeek API        │   │
│  │ PlayerService ←→ audio.js routes     │   │
│  │ PlannerService←→ NCMService+Library  │   │
│  │ ProfileService←→ DB listener_feedback│   │
│  │ TTSService    ←→ 火山引擎 API         │   │
│  │ WeatherService←→ OpenWeatherMap      │   │
│  │ LibraryService←→ Local filesystem    │   │
│  │ NCMService    ←→ NeteaseCloudMusicApi│   │
│  │ DB (SQLite)   ←→ better-sqlite3      │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### 播放队列模型

Planner 输出的播放队列采用 **voice + music 交替结构**：

```
[voice] → [music] → [voice] → [music] → [voice] → [music] → [voice]
 开场白     歌曲1     间奏1     歌曲2     间奏2     歌曲3     结束语
```

### 启动动态播报流程

```
系统启动
  │
  ├─ PlannerService.getTodayPlan() → 生成当天节目计划
  │
  ├─ PlayerService.start() → 展平计划为播放队列，从第一个 voice 项目开始
  │
  ├─ HostService.generateDynamicOpening()
  │   ├─ WeatherService.getWeather() → 获取当前天气
  │   ├─ 根据 hour 生成时段问候语
  │   ├─ NCMService.search() → 按天气+时段关键词搜索推荐曲目
  │   └─ return { greeting, ncmTrack }
  │
  ├─ PlayerService.overrideFirstVoice(greeting, ncmTrack)
  │   ├─ 替换首个 voice 项目的 hostText
  │   ├─ 在语音后插入 NCM 推荐曲目
  │   └─ 设置 hostIntroPlaying = true
  │
  ├─ 问候语写入 messages 表（聊天历史可见）
  │
  └─ 用户打开页面 → 点击 → 听到开场白 → 自动推进到推荐曲目
```

---

## 配置指南

完整配置项见 `.env.example`：

```env
# ── 服务端口 ──
PORT=3001
NODE_ENV=development

# ── NeteaseCloudMusicApi ──
NCM_API_BASE=http://localhost:3000

# ── DeepSeek ──
DEEPSEEK_API_KEY=sk-your-deepseek-api-key
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_API_BASE=https://api.deepseek.com

# ── 本地曲库 ──
RADIO_LIBRARY_DIRS=/path/to/your/music

# ── 豆包语音 TTS ──
DOUBAO_TTS_API_KEY=your-doubao-tts-api-key
DOUBAO_TTS_RESOURCE_ID=seed-tts-2.0
DOUBAO_TTS_VOICE=zh_female_xiaohe_uranus_bigtts
DOUBAO_TTS_ENDPOINT=https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse

# ── 天气 ──
OPENWEATHER_API_KEY=your-openweather-api-key
WEATHER_CITY=Chengdu
```

### 服务降级策略

| 服务不可用 | 降级行为 |
|-----------|---------|
| DeepSeek | 模板回复回退，标记 brainStatus: DEGRADED |
| 火山引擎 TTS | 浏览器 speechSynthesis 回退 |
| NeteaseCloudMusicApi | 纯本地曲库 + WAV tone 占位音 |
| 本地曲库 | 10 个虚拟示例曲目 |
| OpenWeatherMap | wttr.in 回退 / 无天气上下文 |
| 数据库损坏 | 自动重建，清空历史 |

---

## 使用方法

### 首次使用

1. 打开 `http://localhost:3001`
2. 点击页面任意位置激活音频（浏览器自动播放策略）
3. 系统自动播放 AI 主持人的动态开场白（含天气+时段信息）
4. 开场白结束后自动播放推荐歌曲

### 日常使用

- **听音乐**：系统 24 小时自动播放，按 6 时段切换节目风格
- **聊天**：在底部输入框告诉 Codio 你想听什么
- **反馈**：每条主持人消息下方有 4 个反馈按钮，帮助 AI 学习你的口味
- **快捷键**：Space(播放/暂停) ←(上一首) →(下一首) M(静音)
- **查看节目**：展开节目面板查看 6 时段详情
- **调整偏好**：偏好面板可查看/编辑听者画像

### 语音输入

点击输入框右侧的麦克风按钮，说话后自动提交（需浏览器支持 Web Speech API）。

### 睡眠定时器

点击 TIMER 按钮设置 30/60/90 分钟后自动停止播放。

### 自定义 Routine

编辑 `user/routines.json` 或在 UI 的 ROUTINES 面板中编辑，定义你的日常活动时段。

### PWA

支持安装到桌面（Chrome / Edge），离线时提供基本功能回退。

---

## API 文档

### 健康检查

```
GET /api/health
```

### 播放控制

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/now` | 当前播放状态 |
| POST | `/api/playback/toggle` | 播放/暂停 |
| POST | `/api/playback/next` | 下一首 |
| POST | `/api/playback/previous` | 上一首 |
| POST | `/api/playback/play` | 指定曲目播放 |
| POST | `/api/playback/volume` | 设置音量 `{ level: 0-100 }` |
| POST | `/api/playback/mute` | 静音切换 |
| POST | `/api/playback/sleeptimer` | 睡眠定时器 `{ minutes: 30/60/90 }` |
| POST | `/api/favorites/toggle` | 收藏/取消 `{ trackId }` |

### 音频服务

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/audio/music/:trackId` | 本地音乐播放（Range Request） |
| GET | `/api/audio/ncm/:id` | 网易云音频代理 |
| GET | `/api/audio/voice/:voiceId` | 主持人语音 TTS 音频 |
| GET | `/api/audio/voice/:voiceId/text` | 获取语音文本 |
| GET | `/api/audio/speak` | 任意文本 TTS `?text=...` |
| GET | `/api/audio/host-intro` | 当前时段开场白 `?segment=opening` |

### 聊天

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/chat` | 获取聊天历史 |
| POST | `/api/chat` | 发送消息 `{ message }` |

### 节目编排

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/planner/today` | 今日节目计划 |
| POST | `/api/planner/regenerate` | 重新编排 |
| GET | `/api/planner/current` | 当前时段 |

### 曲库

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/library/tracks` | 曲库列表 `?search=&tags=` |
| POST | `/api/library/tracks/:id/identity` | 纠正曲目标识 |
| POST | `/api/library/online-playlist/preview` | 在线歌单预览 |

### 记忆与反馈

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/memory/feedback` | 提交反馈 |
| GET | `/api/memory/profile` | 获取听者画像 |
| GET | `/api/memory/feedback` | 获取反馈状态 |

### WebSocket

```
ws://localhost:3001/stream
```

消息类型：
- `state` — 播放状态广播（含当前曲目、队列、进度、音量、hostIntroPlaying 等）
- `slot` — 当前节目时段

### 权限与安全说明

- 所有 API 为本地内网使用设计，无身份认证
- 不建议将服务暴露到公网
- `.env` 文件包含 API Key，请勿提交到版本控制

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Vanilla JS, CSS Custom Properties, WebSocket |
| 后端 | Express.js, better-sqlite3 |
| 音频 | Web Audio API, HTMLAudioElement, HTTP Range Request |
| AI | DeepSeek API, 火山引擎 TTS, OpenWeatherMap |
| 外部服务 | NeteaseCloudMusicApi |
| 缓存 | SHA256 文件缓存 + LRU 驱逐（50MB/500 文件） |
| PWA | Service Worker, manifest.webmanifest |
| 字体 | Doto (display), Space Grotesk (UI), Space Mono (mono) |

---

## 开发

### 项目结构

```
coldio/
├── server/
│   ├── index.js          # 入口，服务初始化
│   ├── app.js            # Express 应用
│   ├── db.js             # SQLite 数据库
│   ├── ws.js             # WebSocket 广播
│   ├── routes/           # API 路由
│   │   ├── audio.js      # 音频流（本地/NCM/TTS）
│   │   ├── chat.js       # 聊天消息
│   │   ├── library.js    # 曲库管理
│   │   ├── playback.js   # 播放控制
│   │   ├── planner.js    # 节目编排
│   │   ├── memory.js     # 记忆与反馈
│   │   └── ...           # 其他路由
│   └── services/
│       ├── HostService.js     # AI 主持人
│       ├── PlayerService.js   # 播放引擎
│       ├── PlannerService.js  # 节目编排引擎
│       ├── TTSService.js      # 语音合成
│       ├── WeatherService.js  # 天气
│       ├── LibraryService.js  # 本地曲库
│       ├── NCMService.js      # 网易云
│       └── ProfileService.js  # 听者画像
├── public/
│   ├── index.html        # 主页面
│   ├── app.js           # 前端应用
│   ├── styles.css       # 样式
│   ├── sw.js            # Service Worker
│   └── assets/          # 图标、字体
├── data/                # 运行时数据（SQLite, JSON）
├── user/
│   └── routines.json    # 自定义 Routine
├── .env.example         # 环境变量参考
├── REQUIREMENTS.md       # 产品需求文档
├── DEVELOPMENT_STATUS.md # 开发状态追踪
└── README.md             # 使用文档
```
