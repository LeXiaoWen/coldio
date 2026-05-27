# coldio 使用指南

你的私人 AI 电台，24/7 在线。

---

## 快速启动

```bash
# 安装依赖
npm install

# 启动服务器（默认 http://localhost:3001）
npm start

# 开发模式（文件修改后自动重启）
npm run dev
```

浏览器打开 `http://localhost:3001` 即可使用。

---

## 配置

在项目根目录的 `.env` 文件中配置：

| 变量 | 必填 | 说明 |
|------|------|------|
| `PORT` | 否 | 服务端口，默认 3001 |
| `DEEPSEEK_API_KEY` | **是** | 主持人 AI 对话能力 |
| `DOUBAO_TTS_API_KEY` | 否 | 语音合成（不配置则回退到浏览器 speechSynthesis） |
| `OPENWEATHER_API_KEY` | 否 | 天气感知（主持人会提及当前天气） |
| `WEATHER_CITY` | 否 | 城市，默认 Shanghai |
| `RADIO_LIBRARY_DIRS` | 否 | 本地音乐目录，多个用逗号分隔（不配置则使用内置 sample 曲目） |

### 核心依赖说明

| 服务 | 用途 | 推荐配置 |
|------|------|---------|
| **DeepSeek** | AI 主持人的聊天回复、文案生成 | 必须，否则只能模板回复 |
| **豆包 TTS** | 主持人语音朗读 | 强烈推荐，体验远优于浏览器 speechSynthesis |
| **OpenWeatherMap** | 天气感知选曲 | 可选，免费注册即可 |
| **网易云 API** | 在线音乐搜索/播放 | 可选，见下方说明 |

---

## 功能说明

### 主界面布局

```
┌─────────────────────────┐
│  Codio · ON AIR         │  ← 主持人在线状态
│                         │
│  ╭──────╮              │
│  │ 08:30 │  点阵时钟    │  ← 当前时间
│  ╰──────╯               │
│  2026-05-25 Monday      │
│                         │
│  ── ON AIR ──           │
│  Morning Wake            │  ← 当前节目时段
│  07:00-09:00             │
│                         │
│  歌曲标题                │  ← 当前播放信息
│  艺术家                  │
│  light-electronic / piano│
│  ▓▓▓▓▓▓▓░░░░░░░         │  ← 24段进度条
│  ◁ ▷ ▶ ♡ 🔊            │  ← 控制按钮
│                         │
│  ── Chat ──              │
│  Codio  14:30            │  ← 主持人消息
│  ┌──────────────┐       │
│  │ 早上好。今天…│       │
│  └──────────────┘       │
│  [喜欢][不喜欢]         │  ← 反馈按钮
│  [多来点][少推荐]       │
│                         │
│         你  14:32        │  ← 用户消息
│         ┌──────────┐    │
│         │ 今天想听…  │    │
│         └──────────┘    │
│                         │
│  ── tell me how you're  │  ← 输入框
│  feeling... [🎤] [➤]   │
│                         │
│  CODIO FM. CONNECTED.   │  ← 底部状态
└─────────────────────────┘
```

### 播放控制

| 操作 | 方式 |
|------|------|
| 播放/暂停 | 点击中央 ▶/⏸ 按钮，或按空格键 |
| 下一曲 | 点击 ▷ 或按 → 键 |
| 上一曲 | 点击 ◁ 或按 ← 键 |
| 音量 | 点击 10 段音量条调整，点击喇叭图标静音（或按 M 键） |
| 进度跳转 | 点击进度条的任一段 |
| 收藏曲目 | 点击 ♡ 按钮 |

### 聊天互动

在底部输入框打字与主持人 Codio 交流，支持：

- **点歌** — _"放一首 周杰伦 的 七里香"_，_"来点钢琴曲"_
- **推荐** — _"推荐点适合工作的音乐"_，_"想听放松的"_  
- **查节目** — _"现在在放什么"_，_"今天什么时段"_
- **闲聊** — _"早上好"_，_"今天天气不错"_

主持人会根据当前时段调整回复风格：
- 工作时段 → 简短不打扰（15-30字）
- 傍晚 → 温暖柔和，可多说一点（40-80字）
- 深夜 → 安静低沉，深夜电台感

每条主持人消息下方有 4 个反馈按钮，帮助你调教推荐：

| 反馈 | 效果 |
|------|------|
| 喜欢 | 当前方向 +1 |
| 不喜欢 | 当前方向 -1 |
| 多来点这种 | 当前方向 +2 |
| 少推荐这种 | 当前方向 -2 |

### 节目编排

系统每日自动生成 6 个时段的播放计划：

| 时段 | 时间 | 风格 |
|------|------|------|
| Morning Wake | 07:00-09:00 | 轻电子 / 华语流行 / 钢琴 |
| Deep Work | 09:00-12:00 | 稳定律动 / 轻电子 / 器乐 |
| Noon Breath | 12:00-13:30 | 华语流行 / 木吉他 / 放松 |
| Afternoon Drive | 13:30-18:00 | 节奏流行 / 轻电子 / 城市 |
| Evening Soften | 18:00-21:00 | 温暖人声 / 新古典 / Chill |
| Night Close | 21:00-00:00 | 深夜 / 氛围 / 钢琴 |

点击左上角时段名称可展开时段面板，查看全天节目。

### Routine 模式

在 `user/routines.json` 中可自定义 Routine。每个 Routine 匹配一个时间范围，会自动覆盖该时段的音乐方向。

内置示例：

```json
{
  "label": "深度工作",
  "timeRange": "09:00-12:00",
  "musicIntent": "优先选择少人声、稳定律动、轻电子和器乐方向"
}
```

### 在线搜索

点击搜索图标 🔍 搜索网易云音乐曲目，搜索结果可直接点播。

---

## 本地音乐库

如果你想使用自己的音乐文件，在 `.env` 中配置：

```
RADIO_LIBRARY_DIRS=/Users/你的名字/Music,/Volumes/SSD/音乐
```

支持格式：`.mp3` `.flac` `.m4a` `.m4r` `.wav` `.ogg`

文件名自动解析元数据：

```
周杰伦 - 七里香.mp3        → 艺术家: 周杰伦, 曲目: 七里香
Rainy Day Piano - Relax.mp3 → 艺术家: Relax, 曲目: Rainy Day Piano
```

元数据标签推断包括：mood（情绪）、energy（能量）、tags（风格标签）、sceneFit（适用场景）、language（语言）。支持 `data/track-overrides.json` 手动纠正识别错误的曲名。

---

## 网易云音乐集成

coldio 内置 NCM API 自动守护。启动 coldio 时，系统会自动检测端口 3000：

- **端口空闲** → coldio 自动拉起 `NeteaseCloudMusicApi/app.js`
- **端口已被占用**（如你手动启动了 NCM API）→ 跳过拉起，直接使用

启动后每 30 秒健康检查一次，如果 NCM API 崩溃，系统会自动重启（最多连续重试 3 次，之后冷却 30 秒再试）。关闭 coldio 时自动清理子进程。

如需手动管理：

```bash
# 方式一：让 coldio 自动管理（推荐）
npm start        # coldio 自动拉起 NCM API

# 方式二：手动分别启动
npm run ncm      # 先启动 NCM API（默认端口 3000）
npm start        # 再启动 coldio

# 使用公共网易云 API 镜像
# 在 .env 中配置 NCM_API_BASE 指向你的镜像地址
```

---

## 主持人语音

TTS 使用豆包语音大模型，在 `.env` 中配置：

```env
DOUBAO_TTS_API_KEY=你的API密钥
DOUBAO_TTS_RESOURCE_ID=seed-tts-2.0
DOUBAO_TTS_VOICE=zh_female_xiaohe_uranus_bigtts
```

不配置 TTS 时自动回退到浏览器 `speechSynthesis`（中文语音效果较差）。

---

## 开发相关

```bash
# 启动开发模式（文件修改自动重启）
npm run dev

# 默认端口
# coldio 服务: http://localhost:3001
# 网易云 API:  http://localhost:3000（coldio 自动管理）

# 如需手动管理网易云 API（不依赖自动守护）
npm run ncm
```

### 技术栈

| 层 | 技术 |
|------|-----------|
| 后端 | Node.js + Express + SQLite (better-sqlite3) |
| 前端 | 原生 HTML + CSS + JavaScript |
| 实时通信 | WebSocket (ws) |
| AI | DeepSeek API (主持对话) / 豆包 TTS (语音合成) |
| 音乐来源 | 本地文件 / 网易云音乐 API |

### 项目结构

```
server/              后端
  index.js           入口，服务初始化
  app.js             Express 应用配置
  db.js              SQLite 数据库
  ws.js              WebSocket 广播
  routes/            API 路由
  services/          业务服务
    HostService.js    AI 主持人
    PlannerService.js  节目编排
    PlayerService.js  播放控制
    TTSService.js      语音合成
    LibraryService.js  本地曲库
    ProfileService.js  听者画像
    NCMService.js      网易云音乐
    WeatherService.js  天气服务
public/              前端
  index.html         主页面
  app.js             前端逻辑
  styles.css         样式
  sw.js              Service Worker
user/
  routines.json      自定义 Routine
data/
  coldio.db         SQLite 数据库文件
  routines.json      Routine 回退文件
cache/tts/           TTS 音频缓存
```

---

## 常见问题

**Q: 音乐播放时听到蜂鸣音？**
未配置 `RADIO_LIBRARY_DIRS`，使用的 sample 曲目是虚拟的。配置真实音乐目录即可。

**Q: 主持人没有声音？**
检查 TTS 配置（豆包语音）。不配置时会使用浏览器 speechSynthesis，在部分浏览器上可能无声或效果差。

**Q: 主持人回复很机械？**
`DEEPSEEK_API_KEY` 未配置时会回退到模板回复。配置后使用 AI 回复，更自然。

**Q: 如何让推荐更准确？**
对主持人的每条消息做反馈（喜欢/不喜欢/多来点/少推荐），系统会自动学习你的偏好。

**Q: 支持离线使用？**
首次加载后，Service Worker 会缓存应用外壳和部分 API 数据。音频流需要在线。

**Q: 网易云音乐搜索/播放突然无法使用？**
系统内置了 NCM API 自动守护，每 30 秒检查一次，崩溃后自动重启。如果遇到搜歌失败，等待最多 30 秒即可自动恢复。如果 30 秒后仍未恢复，检查 `NeteaseCloudMusicApi/` 目录是否存在且正确部署。
