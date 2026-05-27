# coldio 产品需求文档

> 版本：v0.2
> 更新日期：2026-05-25
> 状态：评审中

---

## 目录

1. [产品概述](#1-产品概述)
2. [用户画像](#2-用户画像)
3. [功能需求总览](#3-功能需求总览)
4. [播放器功能](#4-播放器功能)
5. [AI 电台主持](#5-ai-电台主持)
6. [聊天互动](#6-聊天互动)
7. [节目编排](#7-节目编排)
8. [本地曲库](#8-本地曲库)
9. [听者记忆与反馈](#9-听者记忆与反馈)
10. [UI 设计规范](#10-ui-设计规范)
11. [API 接口](#11-api-接口)
12. [数据模型](#12-数据模型)
13. [非功能需求](#13-非功能需求)

---

## 1. 产品概述

### 1.1 产品定位

coldio 是一个**竖向 AI 电台设备界面**。用户面对一台 24 小时在线的私人 AI 电台终端。它不是普通的音乐播放器，不是聊天 App，也不是后台控制台。它是三者融合后的电台设备界面。

### 1.2 核心价值

- **24h 在线陪伴**：全天候不间断播放，按时段自动切换节目风格
- **AI 主持人**：主持人 Codio 根据用户状态和偏好自主选曲、串词、调整氛围
- **持续学习**：通过与用户的聊天互动和反馈，逐步积累音乐口味画像
- **本地优先**：优先使用本地音频文件，网易云等在线服务作为补充

### 1.4 播放体系结构

coldio 采用**双轨播放结构**：

1. **Planner（节目编排层）** — 每日 6 个时段（slot）的动态调度系统，负责曲目选择、评分、画像适配
2. **Program（播放执行层）** — 实际播放队列，由 voice（主持人语音）和 music（音乐）交替组成，格式为 `voice-music-voice-music-voice-music-voice`

两条轨道的关系：
- Planner 在每日首次请求时生成当日计划（plan_json 持久化）
- Program 从 planner 的 slot.tracks 提取曲目，嵌入 host voice 段，构成交替播放队列
- 用户反馈 → Memory Profile → Planner 画像适配 → 次日计划再生

### 1.3 产品名称与品牌

| 项目 | 值 |
|------|-----|
| 产品名称 | coldio |
| AI 主持人 | Codio |
| Slogan | Your private AI radio. 24/7. |
| 视觉风格 | 深色、复古点阵、终端感、电台设备感、克制高级 |

---

## 2. 用户画像

### 2.1 核心用户

**知识工作者 / 创作者**
- 长时间在电脑前工作（编程、写作、设计、研究）
- 需要背景音乐但不想手动选歌
- 对音乐品味有一定要求，厌烦算法推荐的大众化内容
- 偏好独立音乐、小众流派、氛围音乐

### 2.2 使用场景

| 场景 | 时段 | 音乐需求 |
|------|------|---------|
| 晨间清醒 | 07:00-09:00 | 干净、轻柔、有推进感的音乐 |
| 深度工作 | 09:00-12:00 | 不抢注意力、有稳定律动、少人声 |
| 午间休憩 | 12:00-13:30 | 温暖、松弛、伴饭背景音 |
| 下午续航 | 13:30-18:00 | 中等能量、节奏明快、防止困倦 |
| 晚间放松 | 18:00-21:00 | 低频、留白、陪伴感强 |
| 深夜收束 | 21:00-00:00 | 安静、氛围、慢节奏 |

---

## 3. 功能需求总览

| 模块 | 优先级 | 复杂度 | 说明 |
|------|--------|--------|------|
| 播放器 | P0 | 中 | 核心功能，音频播放、进度控制、音量 |
| AI 主持 | P0 | 高 | Codio 人格化交互、选曲编排 |
| 聊天互动 | P0 | 高 | 多轮对话、主持人消息/用户消息 |
| 节目编排 | P0 | 高 | 6 时段动态编排、track scoring |
| 本地曲库 | P1 | 中 | 本地音频扫描、元数据推断 |
| 记忆反馈 | P1 | 中 | 反馈收集、口味画像 |
| 语音输入 | P2 | 低 | Web Speech API 语音指令 |
| PWA | P1 | 低 | 离线缓存、安装到桌面 |

---

## 4. 播放器功能

### 4.1 播放控制

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 播放/暂停 | 点击中央播放按钮切换状态 | P0 |
| 上一首/下一首 | 切换曲目，循环队列 | P0 |
| 分段进度条 | 24 段分段式进度条，支持点击/拖拽跳转 | P0 |
| 音量控制 | 10 段音量条 + 静音切换 | P0 |
| 收藏喜欢 | Heart 按钮标记当前曲目为喜欢 | P1 |
| 键盘快捷键 | Space(播放/暂停)、←(上一首)、→(下一首)、M(静音) | P1 |

### 4.2 当前播放信息

| 字段 | 说明 | 优先级 |
|------|------|--------|
| 曲目标题 | 当前播放歌曲名称 | P0 |
| 艺术家 | 歌手/乐队名 | P0 |
| 来源标签 | 如 "Codio Selection" / "Local Library" | P0 |
| 节目时段 | 当前所属节目段名称和时间范围 | P0 |
| 音乐方向 | 当前音乐风格描述（如 "light-electronic / mandarin-pop"） | P1 |
| ON AIR 标签 | 正在直播指示器 | P1 |
| HOST VOICE | 主持人语音进行中指示器 | P1 |

### 4.3 歌词

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 歌词获取 | 根据当前曲目 ID 获取歌词 | P1 |
| 歌词展示 | 同步滚动展示歌词文本 | P2 |

---

## 5. AI 电台主持

### 5.1 主持人设定

| 属性 | 值 |
|------|-----|
| 姓名 | Codio |
| 身份 | 私人 AI 电台主持兼音乐策展人 |
| 性格 | 冷静、亲密、准确、略带夜间气质 |
| 语言 | 中文（自然口语，非播音腔） |
| 风格 | 不啰嗦、不油滑、有温度、有品味 |

### 5.2 主持能力

| 能力 | 说明 | 优先级 |
|------|------|--------|
| 选曲编排 | 根据用户状态和时段选择合适曲目 | P0 |
| 串词播报 | 切换曲目或时段时自然口播引导 | P0 |
| 意图理解 | 识别用户是想了解当前曲目、切换节目、求推荐还是闲聊 | P0 |
| 状态推断 | 从用户输入推断场景（工作/雨天/夜间/健身/放松）和情绪 | P0 |
| 节奏控制 | 根据时段控制播报频率和语速 | P1 |
| Host Opening | 每时段开始时自动播放开场白 | P1 |
| Host Speech Ducking | 主持人语音播放时自动降低音乐音量，结束后恢复 | P1 |
| 推荐候选评分 | 用户请求推荐时，对本地曲库按 mood/关键词/来源评分排序 | P1 |

### 5.3 语音输出

| 方式 | 说明 | 优先级 |
|------|------|--------|
| TTS 合成 | 豆包/火山引擎 API 合成自然语音（备选：MiniMax） | P0 |
| 缓存复用 | 相同文本命中缓存直接播放 | P0 |
| 浏览器语音 | TTS API 不可用时回退到 speechSynthesis | P1 |
| 语音压制 | Host 说话时自动降低音乐音量（duck/restore） | P1 |

### 5.4 音频播放服务

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 本地文件播放 | 直接播放本地音频文件，支持 HTTP Range Request 拖拽定位 | P0 |
| WAV Tone 回退 | 本地文件不可用时生成正弦波 WAV 占位音 | P1 |
| 多源回退链 | 查库 → 本地文件 → WAV tone，逐级降级 | P1 |
| 音频电平 | AudioContext analyser 实时分析 → CSS `--audio-level` 驱动视觉反馈 | P2 |

---

## 6. 聊天互动

### 6.1 聊天界面

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 主持人在左 | 主持人消息显示在左侧，带头像 | P0 |
| 用户在右 | 用户消息显示在右侧，带头像 | P0 |
| 气泡式消息 | 圆角气泡包裹消息文本 | P0 |
| 时间戳 | 每条消息显示发送时间 | P0 |
| 主持人状态 | 在线指示器 + Connected to Codio planner | P0 |
| 底部输入框 | 文本输入 + 发送按钮 + 麦克风按钮 | P0 |
| 输入占位符 | "告诉主持人你现在的状态，或者想听什么氛围..." | P0 |

### 6.2 初始消息

系统启动时展示 3 条预置消息建立语境：

1. **主持人开场**：自我介绍 + 使用引导
2. **用户演示输入**：示例输入如"今天下雨，想听一点松弛的歌"
3. **主持人回复**：针对示例输入的自然回复，附带 `HostMemoryEntry`

### 6.3 消息持久化

| 功能 | 说明 | 优先级 |
|------|------|--------|
| localStorage 存储 | 聊天记忆本地持久化 | P0 |
| 历史加载 | 页面刷新后恢复历史消息 | P0 |
| 服务器端存储 | 消息记录存入 SQLite | P1 |

### 6.4 意图检测

聊天系统需要识别用户输入的 4 种意图并做出不同响应：

| 意图 | 触发关键词 | 响应行为 |
|------|-----------|---------|
| current_track | "现在放""正在放""歌名""什么歌""now playing" | 仅回复当前曲目信息，不推荐其他 |
| program_slot | "节目""时段""节目单""slot" | 回复当前时段标题、时间范围、音乐方向 |
| recommendation | "推荐""想听""来点""换一首""适合" | 对本地曲库评分排序，推荐 1-3 首候选 |
| chat | 以上皆非 | 结合当前语境做自然聊天回复 |

推荐请求的评分逻辑：

| 因子 | 权重 | 说明 |
|------|------|------|
| Mood 匹配 | +16 | track.mood 匹配用户输入推断的请求 mood |
| 关键词命中 | +5/词 | 用户输入命中 track title/artist/filename/mood |
| 来源优先级 | +1.2 | 网易云来源曲目 |
| 去重 | -6 | 已在播放列表中 |
| 版本加分 | +1.5 | remix/bootleg/cover/钢琴/纯音等版本 |

### 6.5 语音输入（可选）

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 语音识别 | Web Speech API 语音转文字 | P2 |
| 输入切换 | 麦克风按钮切换语音/文字模式 | P2 |
| 波形动画 | 录音时显示音频波形动画 | P2 |

---

## 7. 节目编排

### 7.1 时段模板

系统内置 6 个固定时段模板，按当天时间段自动切换：

| ID | 时段 | 标题 | 场景 | 能量 | 音乐方向 |
|----|------|------|------|------|---------|
| morning-wake | 07:00-09:00 | Morning Wake | morning | low-to-medium | light-electronic, mandarin-pop, piano |
| deep-work | 09:00-12:00 | Deep Work | work | medium | steady-groove, light-electronic, instrumental |
| noon-breath | 12:00-13:30 | Noon Breath | noon | low | mandarin-pop, acoustic, relax |
| afternoon-drive | 13:30-18:00 | Afternoon Drive | afternoon | medium | rhythm-pop, light-electronic, city |
| evening-soften | 18:00-21:00 | Evening Soften | evening | low-to-medium | warm-vocal, neo-classical, chill |
| night-close | 21:00-00:00 | Night Close | night | low | late-night, ambient, piano |

### 7.2 Track Scoring

曲目选择使用 8 因子加权评分：

| 因子 | 权重 | 说明 |
|------|------|------|
| 场景匹配 | +12 | track.sceneFit 匹配 slot.scene |
| 时段关联 | +4 | track.sceneFit 匹配 slot 关联场景 |
| 能量匹配 | +6 | track.energy 匹配 slot.energy |
| 方向匹配 | +5/个 | track.tags 命中 slot.musicDirection |
| 偏好匹配 | +4/个 | 命中用户偏好的风格标签 |
| 厌恶标签 | -12/个 | 命中用户不喜欢的风格标签 |
| 语言匹配 | +3 | 匹配用户偏好的语言 |
| 本地优先 | +8 | 本地可播放曲目优先于在线曲目 |

### 7.3 Routine 集成

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 内置 routine | 6 个内置 routine block（工作/学习/健身等） | P0 |
| 用户自定义 | 从 `user/routines.json` 加载自定义 routine | P1 |
| Routine 适配 | 根据 routine 调整 slot 的 hostOpening 和音乐方向 | P1 |

每个 slot 应用 routine 后产生 `routineContext`，该对象贯穿 planner → chat → host copy：

```js
routineContext = {
  source: "local-routine-v1",     // 来源（内置或 user/routines.json）
  label: "深度工作",              // 中文活动标签
  activity: "编程 / 写作 / 长时间专注",  // 具体活动描述
  intent: "把注意力稳定下来，减少被歌词打断的概率",  // 意图
  musicIntent: "优先选择少人声、稳定律动、轻电子和器乐方向",  // 音乐策略
  displayStyles: ["稳定律动", "少人声", "轻电子"],  // UI 展示标签
  timeRange: "09:00-12:00"        // 应用时段
}
```

### 7.4 节目计划

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 自动生成 | 每日首次请求时自动生成当日计划 | P0 |
| 手动再生 | 用户可触发重新编排 | P1 |
| 计划持久化 | plan_json 存入 SQLite `daily_programs` 表 | P0 |
| 节目面板 UI | 可展开的面板展示 6 时段 + 当前高亮 | P1 |

### 7.5 播放执行模型

Planner 输出播放队列时使用 voice + music 交替结构：

```
播放队列: [voice] → [music] → [voice] → [music] → [voice] → [music] → [voice]
             开场白      歌曲1      间奏1      歌曲2      间奏2      歌曲3      结束语
```

| 元素 | 类型 | 来源 | 说明 |
|------|------|------|------|
| 开场白 | voice | hostCopy | 主持人介绍当前时段和第一首歌 |
| 歌曲 | music | library / NCM | 实际音乐曲目 |
| 间奏 | voice | hostCopy | 过渡串词，衔接曲目 |
| 结束语 | voice | hostCopy | 时段收束（依时段不同有不同文案） |

hostCopy 生成策略：
- 同步模式：根据时段模板 + 曲目信息生成固定格式口播
- 异步模式（AI）：DeepSeek 生成，含歌曲名/艺人/版本/推荐理由，130-210 字符，适合 TTS

---

## 8. 本地曲库

### 8.1 音频扫描

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 目录扫描 | 扫描指定目录下的音频文件，递归子目录 | P1 |
| 支持格式 | .mp3, .flac, .m4a, .m4r, .wav, .ogg | P1 |
| 来源配置 | `RADIO_LIBRARY_DIRS` 环境变量指定多个扫描目录 | P1 |
| 文件名解析 | 从文件名推断 艺术家 - 歌曲名，支持中英文 | P1 |
| Artist-First 检测 | 对网易云/中文曲库目录优先采用"艺术家-歌曲名"解析而非"歌曲名-艺术家" | P2 |

**Artist-First 文件名解析规则：**

```
文件名: "周杰伦 - 七里香.mp3"
Artist-First 模式 → 艺术家: "周杰伦", 歌曲名: "七里香"

文件名: "City Light - Bombay Bicycle Club.mp3"
非 Artist-First 模式 → 歌曲名: "City Light", 艺术家: "Bombay Bicycle Club"

文件名: "Piano Tribute Conservatory - Love Story.mp3"
检测到钢琴/器乐特征 → 歌曲名: "Love Story", 艺术家: "Piano Tribute Conservatory"
```

| 规则 | 条件 | 行为 |
|------|------|------|
| 目录含网易云/CloudMusic | sourceDir 匹配 | 强制 Artist-First |
| 文件名 中文-英文 | 左侧含中文、右侧为英文 | 判定为 Artist-First |
| 左侧为"艺人名格式" | 匹配 `[A-Z][name] [A-Z][name]` | 左侧为艺术家 |
| 右侧含版本词 | remix/cover/live/edit 等 | 左侧为艺术家 |

### 8.2 元数据推断

从文件名和路径推断以下元数据：

| 字段 | 可选值 |
|------|--------|
| mood | midnight, morning, focus, drive, warm, open |
| tags | piano, instrumental, ambient, light-electronic, mandarin-pop, rainy-day, relax, chill, city, acoustic, neo-classical, warm-vocal, late-night, steady-groove, rhythm-pop |
| energy | low, low-to-medium, medium |
| sceneFit | morning, work, noon, afternoon, evening, night, daily |
| language | chinese, instrumental, unknown |

### 8.3 在线歌单导入

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 网易云歌单 | 支持通过歌单 ID 或 URL 导入 | P1 |
| JSON 歌单 | 支持通用 JSON 格式歌单 URL | P2 |
| 三级回退获取 | API → 官方接口 → 页面解析（3 级逐步降级） | P1 |
| 本地匹配评分 | 在线曲目与本地曲库自动匹配（Levenshtein 相似度） | P1 |

**网易云歌单三级获取策略：**

| 级别 | 方式 | 说明 |
|------|------|------|
| Tier 1 | NeteaseCloudMusicApi `/playlist/track/all` | 最快，需本地部署 NeteaseCloudMusicApi |
| Tier 2 | music.163.com `/api/playlist/detail` | 直连网易云 API |
| Tier 3 | 页面解析 + Song Detail API | 解析 HTML，再获取每首歌的详细信息 |

**在线→本地匹配评分：**

| 因子 | 权重 | 说明 |
|------|------|------|
| 标题相似度 | 68% | Levenshtein 距离归一化后加权 |
| 歌手相似度 | 24% | 同上 |
| 文件名包含标题 | +16% | 文件名包含在线曲目标题 |
| 文件名包含歌手 | +8% | 文件名包含在线歌手 |
| 子串包含 | +8% | 一方完全含另一方的标题 |

匹配阈值：>= 0.82 → auto-matched, >= 0.5 → review, < 0.5 → missing

### 8.4 Track Identity 纠正

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 覆盖配置 | 从 `data/track-overrides.json` 加载纠正映射 `{ trackId: { title, artist, updatedAt } }` | P2 |
| API 修改 | 通过 `POST /api/library/tracks/:trackId/identity` 保存纠正 | P2 |

---

## 9. 听者记忆与反馈

### 9.1 反馈类型

用户可在每条主持人消息下方选择以下 4 种反馈：

| 标签 | 类型 | 评分分值 |
|------|------|---------|
| 喜欢 | like | +1 |
| 不喜欢 | dislike | -1 |
| 多来点这种 | more_like_this | +2 |
| 少推荐这种 | less_like_this | -2 |

### 9.2 反馈记录

每次反馈保存以下上下文：

| 字段 | 说明 |
|------|------|
| message_id | 被反馈的消息 ID |
| feedback_type | like / dislike / more_like_this / less_like_this |
| user_message | 用户原始输入 |
| host_reply | 主持人回复内容 |
| slot_id / slot_title | 当前节目时段 |
| track 信息 | 当前播放曲目 |
| music_direction | 当前音乐方向 |
| scene / mood | 当前场景和情绪 |

### 9.3 听者画像

从反馈数据聚合生成画像：

| 输出 | 说明 |
|------|------|
| preferredDirections | 用户偏好的音乐方向（加权排序） |
| dislikedDirections | 用户不喜欢的音乐方向 |
| preferredTags | 用户偏好的标签 |
| favoriteScenes | 用户偏好的场景 |
| avoidedScenes | 用户回避的场景 |
| preferredEnergy | 用户偏好的能量级别 |
| preferredLanguage | 用户偏好的语言 |
| favoriteTracks | 用户喜欢的曲目 |
| dislikedTracks | 用户不喜欢的曲目 |

### 9.4 反馈→编排闭环

画像数据自动注入 Planner 的 `enrichProfileForPlanning()`，影响次日的曲目选择和时段适配。

---

## 10. UI 设计规范

### 10.1 整体结构

```
┌────────────────────┐
│  ┌──────────────┐  │
│  │  Host Avatar │  │  ← 主持人头像 + "Codio" + DARK/LIGHT
│  └──────────────┘  │
│                     │
│  ┌──────────────┐  │
│  │   时间显示    │  │  ← 大号点阵时钟 + 日期/星期
│  └──────────────┘  │
│                     │
│  ┌──────────────┐  │
│  │  ON AIR      │  │  ← 当前节目段 + Now Playing
│  │  歌曲名      │  │
│  │  艺术家      │  │
│  │  Codio Sel.  │  │
│  │  进度条      │  │
│  │  ◁ ▷ ▶ ♡ ◉  │  │  ← 播放控制
│  └──────────────┘  │
│                     │
│  ┌──────────────┐  │
│  │  Codio 在线  │  │  ← 聊天状态栏
│  ├──────────────┤  │
│  │  [Codio] xxx │  │  ← 主持人消息（左）
│  │  [你]   xxx  │  │  ← 用户消息（右）
│  │  [反馈]      │  │  ← 反馈按钮组
│  ├──────────────┤  │
│  │  [输入框]    │  │  ← 底部发送区
│  └──────────────┘  │
│                     │
│  CODIO FM.         │  ← 底部状态
│  CONNECTED.         │
└────────────────────┘
```

### 10.2 尺寸规范

| 属性 | 值 |
|------|-----|
| 设备卡片宽度 | 430px-520px（桌面居中） |
| 手机端 | 自适应宽度，保留 16px 边距 |
| 圆角 | --radius-md: 16px（卡片），--radius-full: 999px（按钮） |

### 10.3 视觉风格

**关键词：** 深色、复古点阵屏幕、终端感、电台设备感、克制、高级

**颜色系统：**

| Token | 暗色值 | 亮色值 | 用途 |
|-------|--------|--------|------|
| --black | #000000 | #f5f5f5 | 背景 |
| --surface | #111111 | #ffffff | 面板背景 |
| --surface-raised | #1a1a1a | #f0f0f0 | 高亮面板 |
| --border | #222222 | #e8e8e8 | 弱分隔 |
| --border-visible | #333333 | #cccccc | 可见边框 |
| --text-display | #ffffff | #000000 | 主要文本（Doto） |
| --text-primary | #e8e8e8 | #1a1a1a | 正文 |
| --text-secondary | #999999 | #666666 | 标签/元数据 |
| --text-disabled | #666666 | #999999 | 禁用/时间戳 |
| --accent | #d71921 | | 强调色（每屏最多一次） |
| --success | #4a9e5c | | 成功状态 |
| --warning | #d4a843 | | 警告状态 |

**字体体系：**

| 层级 | 字体 | 字号 | 颜色 | 用途 |
|------|------|------|------|------|
| 主层级 | Doto | 72-96px | --text-display | 时间显示 |
| 次层级 | Space Grotesk | 24-40px | --text-display | 歌曲名、标题 |
| 第三层级 | Space Mono | 11-12px | --text-secondary | 标签、元数据、状态 |

**间距：** 8px 基准 — xs(4), sm(8), md(16), lg(24), xl(32), 2xl(48), 3xl(64), 4xl(96)

**动画：** 150-250ms 微动效、300-400ms 转场、`cubic-bezier(0.25, 0.1, 0.25, 1)`

### 10.4 点阵时钟规范

时间显示采用复古 7-segment 点阵样式：

```
 .   .   .   .
 01110  01110  0
 10001  00001  1    ← 每个数字由 7 行 5 列的点阵组成
 10001  00001
 01110  01110
 00001  00001
 10001  00001
 01110  01110
```

- 时分之间闪烁冒号
- 不使用标准字体渲染，使用 grid 点阵模拟

### 10.5 聊天消息规范

```
[Codio 头像]    [你 头像]
   Codio           你
   14:30           14:32
   ┌─────────┐   ┌────────────┐
   │ 收到。   │   │ 今天下雨，  │
   │ 雨天我会  │   │ 想听一点    │
   │ 先避开... │   │ 松弛的歌。  │
   └─────────┘   └────────────┘
   [喜欢][不喜欢]
   [多来点][少推荐]
```

| 属性 | 主持人消息 | 用户消息 |
|------|-----------|---------|
| 对齐 | 左 | 右 |
| 头像 | 左侧显示 | 右侧显示 |
| 气泡颜色 | --surface | --surface-raised |
| 反馈按钮 | 显示在气泡下方 | 不显示 |

### 10.6 反馈按钮规范

在每条主持人消息气泡下方显示 4 个反馈按钮：

```
[喜欢] [不喜欢] [多来点这种] [少推荐这种]
```

- 点击后按钮变灰，显示"已记住你的反馈"
- 再次点击可切换反馈类型
- 反馈数据通过 API 同步到服务器

### 10.7 绝对不要出现的设计

- 产品官网首页或顶部导航
- 大面积表单或推荐理由面板
- 音乐偏好设置卡片或系统分析字段
- 默认 HTML 样式或白底页面
- 渐变色、阴影、模糊效果（数据状态颜色除外）
- 骨架屏加载（使用 `[LOADING...]` 文字或分段转盘）
- Toast 弹窗（使用内联状态文字 `[SAVED]`）
- emoji 作为 UI 元素
- 填充图标或多色图标

---

## 11. API 接口

### 11.1 现有接口（无需修改）

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/health` | 健康检查 + 服务状态 |
| GET | `/api/now` | 当前播放状态 |
| POST | `/api/playback/toggle` | 暂停/继续 |
| POST | `/api/playback/next` | 下一曲 |
| POST | `/api/playback/previous` | 上一曲 |
| POST | `/api/playback/play` | 点播指定曲目 |
| POST | `/api/queue/add` | 添加曲目到队列 |
| POST | `/api/queue/reshape` | 重新编排队列 |
| POST | `/api/prefetch/next` | 预取下一曲 URL |
| GET | `/api/search` | 搜索音乐 |
| GET | `/api/song-url` | 获取歌曲播放 URL |
| GET | `/api/lyric` | 获取歌词 |
| GET | `/api/recommend` | 获取推荐 |
| GET | `/api/plan/today` | 今日节目计划（后续由 planner 替代） |
| GET | `/api/prefs` | 读取偏好 |
| PUT | `/api/prefs/:key` | 保存偏好 |
| GET | `/api/history/plays` | 播放历史 |
| WS | `/stream` | 状态广播 |

### 11.2 新增接口

**Library 曲库：**

| 方法 | 路径 | 请求体 | 响应 |
|------|------|--------|------|
| GET | `/api/library/tracks` | — | `[{ id, title, artist, tags, energy, sceneFit, language, source }]` |
| POST | `/api/library/tracks/:trackId/identity` | `{ title, artist }` | `{ ok: true }` |
| POST | `/api/library/online-playlist/preview` | `{ url }` | `{ source, title, tracks: [...] }` |

**Audio 服务：**

| 方法 | 路径 | 参数 | 响应 |
|------|------|------|------|
| GET | `/api/audio/music/:trackId` | — | WAV binary (支持 Range Request) |
| GET | `/api/audio/host-intro` | `?segment=opening` | WAV binary |

**Planner 编排：**

| 方法 | 路径 | 响应 |
|------|------|------|
| GET | `/api/planner/today` | `{ date, slots, routine, libraryAnalysis, listenerProfile }` |
| POST | `/api/planner/regenerate` | `{ date, slots, ... }`（重新编排） |
| GET | `/api/planner/current` | `{ id, timeRange, title, tracks, ... }`（当前时段） |

**Memory 记忆：**

| 方法 | 路径 | 请求体 | 响应 |
|------|------|--------|------|
| POST | `/api/memory/feedback` | `{ messageId, feedbackType, userMessage, hostReply, slotId, track, ... }` | `{ ok: true }` |
| GET | `/api/memory/profile` | — | `{ preferredDirections, dislikedDirections, preferredTags, favoriteScenes, ... }` |

**Host 主持人：**

| 方法 | 路径 | 请求体 | 响应 |
|------|------|--------|------|
| POST | `/api/host/intro-copy` | `{ slotId, tracks, timeContext }` | `{ opening, break, closing }` |

---

## 12. 数据模型

### 12.1 数据库表

**messages（已有）：**
```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**plays（已有）：**
```sql
CREATE TABLE plays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  source TEXT NOT NULL,
  played_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**prefs（已有）：**
```sql
CREATE TABLE prefs (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

**listener_feedback（新增）：**
```sql
CREATE TABLE listener_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT NOT NULL,
  feedback_type TEXT NOT NULL,
  user_message TEXT,
  host_reply TEXT,
  slot_id TEXT,
  slot_title TEXT,
  track_title TEXT,
  track_artist TEXT,
  track_source TEXT,
  music_direction TEXT,
  scene TEXT,
  mood TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**daily_programs（新增）：**
```sql
CREATE TABLE daily_programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  weekday TEXT NOT NULL,
  host TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  source TEXT NOT NULL,
  plan_json TEXT NOT NULL
);
```

### 12.2 前端状态模型

```js
// 电台状态
coolState = {
  playing: false,
  progress: 0,           // 0-24 分段进度
  current: {              // 当前曲目
    id, title, artist, source, url, duration
  },
  queue: [],              // 播放队列
  assistantLine: "",      // 主持人播报文本
  brainStatus: "",        // DeepSeek 状态
  ttsStatus: "",          // TTS 状态
  services: [],           // 服务状态列表

  // 以下为新增状态
  messages: [],           // 聊天消息 { id, role, nickname, text, time, memory }
  memory: [],             // 记忆条目（localStorage 同步）
  feedbackByMessage: {},  // { messageId: feedbackLabel }
  plannerSlot: null,      // 当前节目时段
  plannerDay: null,       // 今日节目计划
  plannerStatus: "",      // loading / ready / error
  libraryTracks: []       // 本地曲库
}

// 音频状态
audioState = {
  currentUrl: "",
  userInteracted: false,
  syncing: false,
  volume: 80,             // 0-100
  muted: false,
  hostIntroPlaying: false  // 主持人语音播放中
}
```

---

## 13. 非功能需求

### 13.1 性能

| 指标 | 要求 |
|------|------|
| 页面加载 | 首次渲染 < 2s（含字体加载） |
| API 响应 | 非 AI 接口 < 200ms，AI 接口 < 3s |
| 音频切换 | 切歌延迟 < 500ms（含 URL 解析） |
| WebSocket | 状态变更广播延迟 < 100ms |

### 13.2 可用性

| 场景 | 行为 |
|------|------|
| DeepSeek 离线 | 本地关键词降级，标记 brainStatus: DEGRADED |
| 网易云不可用 | 使用本地曲库 + WAV tone 降级 |
| TTS 不可用 | 回退到 browser speechSynthesis |
| Planner 离线 | 使用本地 radio 模式（简单队列循环） |
| 数据库损坏 | 自动重建，清空历史数据 |
| 网络断开 | 前端独立运行，WS 重连后同步状态 |

### 13.3 兼容性

| 平台 | 支持 |
|------|------|
| Chrome / Edge (桌面) | ✅ 首选 |
| Safari (桌面) | ✅ |
| Firefox | ✅ |
| 手机浏览器 | ✅ 响应式适配 |
| 服务端 | Node.js >= 20 |

### 13.4 PWA 要求

| 功能 | 说明 |
|------|------|
| manifest.webmanifest | 应用名称、图标、theme_color: #000000、display: standalone |
| Service Worker | 缓存 app shell（index.html, styles.css, app.js, 字体） |
| 离线体验 | 缓存命中时基本功能可用 |
| 可安装性 | 满足 PWA 安装条件 |

---

## 附录

### A. 术语表

| 术语 | 说明 |
|------|------|
| Codio | AI 电台主持人 |
| Slot | 节目时段，一天分为 6 个时段 |
| Scene | 场景标签（morning / work / noon / afternoon / evening / night） |
| Energy | 能量级别（low / low-to-medium / medium） |
| SceneFit | 曲目适用的场景列表 |
| MusicDirection | 音乐风格方向（如 light-electronic, mandarin-pop） |
| Routine | 用户日常活动安排（工作、学习、健身等） |
| HostMemoryEntry | 主持人记忆条目，包含用户输入、回复、场景、情绪、方向 |
| ListenerFeedback | 听众反馈记录 |

### B. 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v0.1 | 初始 | 基础播放器 + 后端框架 |
| v0.2 | 2026-05-25 | 完整需求：Planner / Memory / Library / Host / Chat / UI 重构 |
