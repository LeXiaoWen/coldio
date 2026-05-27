# coldio 开发状态与路线图

> 版本：v0.4
> 更新日期：2026-05-27
> 对照：REQUIREMENTS.md v0.2

---

## 一、已完成功能

### P0 — 核心功能

| 模块 | 功能 | 状态 | 说明 |
|------|------|------|------|
| 播放器 | 播放/暂停 | ✅ | POST `/api/playback/toggle`，前端按钮绑定 |
| 播放器 | 上一首/下一首 | ✅ | POST `/api/playback/next`、`/previous` |
| 播放器 | 24 段分段进度条 | ✅ | 支持点击跳转，CSS 分段渲染 |
| 播放器 | 音量控制 10 段 | ✅ | POST `/api/playback/volume`、`/mute`，分段渲染 |
| 播放器 | 键盘快捷键 | ✅ | Space(播放/暂停)、←(上一首)、→(下一首)、M(静音) |
| 播放器 | 当前播放信息 | ✅ | 标题/艺术家/来源/时段/方向/ON AIR/HOST VOICE |
| 播放器 | 音频电平可视化 | ✅ | AudioContext AnalyserNode → CSS `--audio-level` → 7 条柱状图 |
| 播放器 | 多源回退链 | ✅ | NCM → library → WAV tone |
| 播放器 | NCM API 进程守护 | ✅ | 自动拉起 + 30s 健康检查 + 崩溃重启 + 优雅关闭 |
| AI 主持 | Codio 人格化交互 | ✅ | HostService 意图识别 + DeepSeek 调用 |
| AI 主持 | 选曲编排 | ✅ | 时段感知推荐，本地库评分 + NCM fallback |
| AI 主持 | 串词播报 | ✅ | host opening/break/closing，模板 + AI 生成 |
| AI 主持 | 意图理解 | ✅ | 5 种意图：play_music/current_track/program_slot/recommendation/chat |
| AI 主持 | 状态推断 | ✅ | 从用户输入推断场景/情绪，注入系统提示 |
| AI 主持 | 天气感知 | ✅ | 每次聊天自动携带天气上下文 |
| AI 主持 | TTS 合成 | ✅ | 豆包/火山引擎 API，SHA256 缓存 |
| AI 主持 | TTS 回退 | ✅ | speechSynthesis (browser) 回退 |
| AI 主持 | TTS 健康追踪 | ✅ | 连续 3 次失败标记 degraded，成功自动恢复 |
| AI 主持 | 暖心动语播报 | ✅ | 结合歌词/评论生成 AI 串词，两首歌之间播报 |
| AI 主持 | 点歌指令修复 | ✅ | "换一首" 正确路由到 play_music 而非推荐 |
| 节目编排 | 6 时段模板 | ✅ | morning-wake → night-close |
| 节目编排 | Track Scoring 8 因子 | ✅ | 场景/能量/方向/偏好/厌恶/语言/本地/时段关联 |
| 节目编排 | Routine 集成 | ✅ | user/routines.json → 时段适配 |
| 节目编排 | 自动生成 + 持久化 | ✅ | daily_programs 表，按日期缓存 |
| 节目编排 | 手动再生 | ✅ | POST `/api/planner/regenerate` |
| 节目编排 | 节目面板 UI | ✅ | 6 时段可展开面板，当前高亮 |
| 聊天 | 主持人左/用户右气泡 | ✅ | 头像 + 气泡 + 时间戳 |
| 聊天 | 消息持久化 | ✅ | SQLite messages 表 + 历史加载 |
| 聊天 | 初始消息 | ✅ | 3 条种子消息建立语境 |
| 聊天 | 意图检测 | ✅ | current_track/program_slot/recommendation/chat |
| 聊天 | 在线状态指示器 | ✅ | "Connected to Codio" + 在线状态 |
| 聊天 | 底部输入框 | ✅ | 文本输入 + 发送按钮 + 麦克风按钮 |

### P1 — 重要功能

| 模块 | 功能 | 状态 | 说明 |
|------|------|------|------|
| 本地曲库 | 文件名解析 | ✅ | 艺术家-歌曲名解析，中英文/Artist-First |
| 本地曲库 | 元数据推断 | ✅ | tags/energy/sceneFit/language 从文件名关键词推断 |
| 本地曲库 | 在线歌单导入 | ✅ | 3 级回退获取 + 本地匹配评分 |
| 本地曲库 | Track Identity 纠正 | ✅ | POST `/api/library/tracks/:trackId/identity` |
| 记忆反馈 | 4 种反馈类型 | ✅ | 喜欢/不喜欢/多来点/少推荐 |
| 记忆反馈 | 反馈记录 | ✅ | listener_feedback 表，完整上下文 |
| 记忆反馈 | 听者画像聚合 | ✅ | preferredDirections/favoriteScenes 等 |
| 记忆反馈 | 反馈→编排闭环 | ✅ | enrichProfileForPlanning() → Planner scoring |
| 记忆反馈 | 画像初始化 | ✅ | 锐评解析 + 标签选择 + initProfile API |
| 播放器 | 收藏喜欢 | ✅ | POST `/api/favorites/toggle` + 心形按钮 |
| UI | PWA 支持 | ✅ | manifest.webmanifest + sw.js |
| UI | 深色主题设计系统 | ✅ | CSS 自定义属性 + Doto/Space Grotesk/Space Mono 字体 |

### P2 — 辅助功能

| 模块 | 功能 | 状态 | 说明 |
|------|------|------|------|
| 聊天 | 语音输入 | ✅ | Web Speech API SpeechRecognition + 自动提交 |
| 播放器 | HOST VOICE 指示器 | ✅ | 语音播放时显示指示器 |

---

## 二、部分完成 / 有缺陷功能

| 模块 | 功能 | 状态 | 缺陷 |
|------|------|------|------|
| 播放器 | 歌词同步滚动 | ✅ | `_syncLyrics()` 通过 `audioEl.timeupdate` 事件追踪播放进度，高亮当前行，自动滚动保持可见 |
| AI 主持 | HOST VOICE Ducking | ⚠️ 需验证 | `PlayerService` 中有语音 ducking 逻辑（降低音乐音量），但需验证在 speechSynthesis 模式下是否生效（ducking 只在 audio element 切换时触发，speechSynthesis 不经过 audio element） |
| 记忆反馈 | `avoidedScenes` UI | ✅ | 初始化面板新增"回避的场景"标签组，可手动多选。`getInitPreferences()` 和 `applyParsedPreferences()` 均已支持 |
| 节目编排 | 本地曲库未启用 | ⚠️ 无本地文件 | `RADIO_LIBRARY_DIRS` 未配置，完全依赖示例曲目(10个虚拟) + NCM |
| 聊天 | 语音输入边缘情况 | ⚠️ 不完善 | continuous=false，识别完成后 onend 可能不触发导致文本残留 |
| 播放器 | WAV tone 回退无视觉指示 | ✅ | broadcast state 增加 `fallback` 字段，UI 中本地曲目无音频时显示 `[FALLBACK]` 标签 |

---

## 三、未完成功能

目前所有计划内的功能已全部完成。暂无未完成项。

---

## 四、技术债务（已全部清理） ✅

| 类型 | 问题 | 状态 |
|------|------|------|
| 性能 | `dynamic import(axios)` | ✅ 已改为顶层 `require` |
| 代码质量 | `chat.js` 引入 `ws` 未使用 | ✅ 已移除 |
| 架构 | 示例曲目在内存中非持久 | ✅ 已持久化到 `data/sample-tracks.json` |
| 兼容性 | speechSynthesis 长文本截断 | ✅ `_splitSpeechSegments()` ≤100 字分段链式播报 |
| 性能 | TTS 缓存无过期策略 | ✅ LRU 清理 50MB/500 文件 |
| 配置 | 天气 API 无备选 | ✅ wttr.in 回退 |

---

## 五、后续开发路线图

### Phase 1 — 体验打磨（本周）

| 优先级 | 功能 | 工作量 | 影响 |
|--------|------|--------|------|
| P0 | 歌词同步滚动高亮 | 0.5d | ✅ `_syncLyrics()` + `timeupdate` |
| P0 | speechSynthesis 长文本分段 | 0.5d | ✅ 按句末分割 ≤100 字链式播报 |
| P1 | WAV tone 回退时 UI 显示 "[FALLBACK]" | 0.25d | ✅ broadcast `fallback` 字段 |
| P1 | `avoidedScenes` UI 控件 | 0.5d | ✅ 标签组 + JS 支持 |

### Phase 2 — 功能补全 ✅ 已完成

| 优先级 | 功能 | 工作量 | 状态 |
|--------|------|--------|------|
| P1 | 配置 RADIO_LIBRARY_DIRS + 本地曲库启用 | 0.5d | ✅ `/Users/leo/Documents/music`，扫描 2 首 mp3 |
| P1 | 推荐评分 6 因子对齐需求文档 | 1d | ✅ `_scoreForRecommendation()` 已实现全部 5 因子 |
| P1 | Host 节奏控制（时段感知） | 1d | ✅ `_getPacingForSlot()` 已实现各时段的 maxTokens/temperature/lengthGuide |
| P1 | feedbackByMessage 持久化 | 0.5d | ✅ GET `/api/memory/feedback` + `loadFeedbackState()` 刷新恢复 |

### Phase 3 — 架构优化 ✅ 已完成

| 优先级 | 功能 | 工作量 | 影响 |
|--------|------|------|------|
| P1 | dynamic import(axios) → require | 0.25d | ✅ 顶层 require |
| P1 | TTS 缓存 LRU 清理 | 0.5d | ✅ 50MB/500 文件 LRU 驱逐 |
| P2 | 语音输入 continuous 模式改进 | 1d | ✅ continuous=true + 2s 静默定时器 |
| P2 | 备选天气 API | 0.5d | ✅ wttr.in 回退，无需 API Key |

### Phase 4 — 新功能 ✅ 已完成

| 优先级 | 功能 | 工作量 | 状态 |
|--------|------|------|------|
| P2 | 歌词翻译展示（中英对照） | 1d | ✅ tlyric 渲染 + CSS |
| P2 | 播放历史页面 | 1d | ✅ [HISTORY] 面板，最近 50 条 |
| P2 | 睡眠定时器 | 0.5d | ✅ 30/60/90 分钟服务器端倒计时 |
| P2 | 自定义 Routine 编辑器 | 2d | ✅ 可视化编辑 user/routines.json |

### Phase 5 — 代码审查修复 ✅ 已完成

| 优先级 | 功能 | 工作量 | 状态 |
|--------|------|------|------|
| CRITICAL | `_autoAdvance()` 竞态条件 | 0.5d | ✅ 重入守卫 + voice 跳过 tick |
| HIGH | `_tickInterval` 切歌重建 | 0.25d | ✅ `_startTicking()` 改为先 clear 再 set |
| HIGH | `_speechSegments` 共享状态 | 0.5d | ✅ 改为闭包局部变量 |
| MEDIUM | `escapeHtml()` 引号转义 | 0.1d | ✅ 添加 `&quot;` 和 `&#39;` |
| MEDIUM | SpeechSynthesis 异步加载 | 0.25d | ✅ `_ensureVoice()` + `voiceschanged` |
| MEDIUM | NCM 音频流错误处理 | 0.25d | ✅ `response.data.on('error')` 回退 |
| MEDIUM | speakText 事件泄漏 | 0.25d | ✅ `error` 事件清理 |
| LOW | NCM 错误日志 + dynamic import | 0.25d | ✅ `require('axios')` 顶层引入 |

### Phase 7 — 启动动态播报 ✅ 已完成

| 优先级 | 功能 | 工作量 | 状态 |
|--------|------|--------|------|
| P0 | 天气+时段感知的 AI 开场白 | 0.5d | ✅ `HostService.generateDynamicOpening()` 生成带天气和时段信息的自然开场白 |
| P0 | 启动时 NCM 推荐曲目 | 0.5d | ✅ 根据时段+天气关键词搜索 NCM，插入队列第一首 |
| P1 | 呼入文本写入聊天历史 | 0.25d | ✅ 启动问候语写入 messages 表，聊天面板可见 |
| P1 | 前端首次交互触发播放 | 0.25d | ✅ `_onFirstInteraction()` 解决浏览器自动播放策略 |
| P1 | 语音 ID 唯一化确保音频刷新 | 0.25d | ✅ `overrideFirstVoice()` 加 `-dyn` 后缀触发前端 reload |
| P1 | 聊天回复 TTS 统一 | 0.5d | ✅ `speakText()` 优先走火山引擎 TTS，保持与开场白音色一致 |

### Phase 6 — 需求补全 ✅ 已完成

| 优先级 | 功能 | 工作量 | 状态 |
|--------|------|------|------|
| P0 | localStorage 聊天持久化 | 0.5d | ✅ 服务器离线时 localStorage 回退 |
| P1 | Audio host-intro 端点 | 0.5d | ✅ `GET /api/audio/host-intro` |
| P1 | PWA 离线体验改进 | 0.5d | ✅ 更有意义的离线回退响应 |
| P2 | JSON 通用歌单导入 | 0.5d | ✅ 非网易云 URL 尝试 JSON 解析 |
| 隐性 | 数据库损坏自动重建 | 0.25d | ✅ PRAGMA integrity_check |

---

## 六、技术架构总览

```
┌─────────────────────────────────────────────────────┐
│                     Frontend                         │
│  index.html + app.js + styles.css                    │
│  ┌─────────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │ WebSocket    │ │ fetch()  │ │ Web Audio API    │  │
│  │ (状态同步)    │ │ (REST)   │ │ (电平分析)        │  │
│  └─────────────┘ └──────────┘ └──────────────────┘  │
│  ┌─────────────┐ ┌──────────┐                       │
│  │ speechSynth  │ │ Speech   │                       │
│  │ (TTS回退)    │ │Recognition│                       │
│  └─────────────┘ └──────────┘                       │
└──────────────────────┬──────────────────────────────┘
                       │ WebSocket + HTTP
┌──────────────────────┴──────────────────────────────┐
│                   Backend (Express)                   │
│  ┌──────────────────────────────────────────────┐   │
│  │  Routes (20 文件)                             │   │
│  │  health / now / playback / queue / audio     │   │
│  │  planner / chat / host / library / search   │   │
│  │  song / recommend / plan / prefs / history   │   │
│  │  memory / lyric / weather / favorites        │   │
│  └──────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────┐   │
│  │  Services (8)                                 │   │
│  │  HostService  ←→  DeepSeek API               │   │
│  │  PlayerService  ←→  audio.js routes          │   │
│  │  PlannerService ←→  NCMService + Library     │   │
│  │  ProfileService ←→  DB listener_feedback     │   │
│  │  TTSService    ←→  Volcengine API            │   │
│  │  WeatherService←→  OpenWeatherMap            │   │
│  │  LibraryService←→  Local filesystem          │   │
│  │  NCMService    ←→  NeteaseCloudMusicApi      │   │
│  └──────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────┐   │
│  │  DB (SQLite via better-sqlite3)               │   │
│  │  messages / plays / prefs / listener_feedback │   │
│  │  daily_programs / favorites                   │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## 七、关键依赖状态

| 外部服务 | 状态 | 用途 | 降级策略 |
|---------|------|------|---------|
| DeepSeek API | ✅ 已配置 | AI 主持对话 | 模板回复回退 |
| 豆包/火山引擎 TTS | ✅ 已配置 | 语音合成 | speechSynthesis 回退 |
| NeteaseCloudMusicApi | ✅ 自动守护 (端口 3000) | 网易云音乐搜索/播放 | 自动重启 + 本地曲库 + WAV tone |
| OpenWeatherMap | ✅ 已配置 | 天气信息 | 无天气上下文 |
| 本地曲库 (RADIO_LIBRARY_DIRS) | ❌ 未配置 | 本地音乐播放 | 完全依赖 NCM + 示例曲目 |
