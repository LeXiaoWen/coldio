# 网易云音乐 API 文档

> 基于 [NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi) **v4.32.0**
>
> 基础 URL：`http://localhost:3000`
> 所有接口支持 `GET` 和 `POST`（参数放 query 或 body 均可）

---

## 运行

```bash
npm install
node app.js        # 默认端口 3000
# PORT=4000 node app.js
```

首次启动会自动获取匿名 Token（MUSIC_A），无需登录即可使用绝大多数接口。

---

## 目录

- [搜索](#搜索)
- [歌曲](#歌曲)
- [专辑](#专辑)
- [歌手](#歌手)
- [歌单](#歌单)
- [排行榜](#排行榜)
- [推荐](#推荐)
- [MV/视频](#mv视频)
- [评论](#评论)
- [电台](#电台)
- [相似推荐](#相似推荐)
- [用户](#用户)
- [登录/账号](#登录账号)
- [云盘](#云盘)
- [VIP](#vip)
- [云贝](#云贝)
- [音乐人](#音乐人)
- [一起听](#一起听)
- [语音](#语音)
- [广播](#广播)
- [风格](#风格)
- [其他](#其他)
- [错误码](#错误码)

---

## 搜索

### 搜索

```
GET /search?keywords={keywords}&type={type}&limit={limit}&offset={offset}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `keywords` | string | **必填** | 搜索关键词 |
| `type` | number | 1 | 1-单曲, 10-专辑, 100-歌手, 1000-歌单, 1002-用户, 1004-MV, 1006-歌词, 1009-电台, 1014-视频 |
| `limit` | number | 30 | 返回数量 |
| `offset` | number | 0 | 偏移量 |

### 云搜索（搜索更全）

```
GET /cloudsearch?keywords={keywords}&type={type}&limit={limit}&offset={offset}
```

参数同上，结果更丰富。

### 搜索建议

```
GET /search/suggest?keywords={keywords}&type={type}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `keywords` | string | **必填** | 搜索关键词 |
| `type` | string | "web" | `mobile` 或 `web` |

### 多类型搜索

```
GET /search/multimatch?keywords={keywords}
```

### 搜索匹配

```
GET /search/match?keywords={keywords}
```

返回最佳匹配结果。

### 热门搜索

```
GET /search/hot
```

### 热门搜索详情

```
GET /search/hot/detail
```

### 默认搜索

```
GET /search/default
```

---

## 歌曲

### 歌曲详情

```
GET /song/detail?ids={ids}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `ids` | string | **必填** | 歌曲 id（多个用逗号分隔） |

### 歌曲链接（标准版）

```
GET /song/url?id={id}&br={br}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | string | **必填** | 歌曲 id |
| `br` | number | 999000 | 码率：128000, 192000, 320000, 999000(无损) |

### 歌曲链接（v1 — 新版音质等级）

```
GET /song/url/v1?id={id}&level={level}&encodeType={encodeType}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | string | **必填** | 歌曲 id |
| `level` | string | **必填** | 音质等级：`standard`, `exhigh`, `lossless`, `hires`, `jyeffect`(高清环绕声), `sky`(沉浸环绕声), `jymaster`(超清母带) |
| `encodeType` | string | "flac" | 编码格式 |

### 歌曲下载链接

```
GET /song/download/url?id={id}&br={br}
```

### 歌词

```
GET /lyric?id={id}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | string | **必填** | 歌曲 id |

### 新歌词（新版接口）

```
GET /lyric/new?id={id}
```

### 歌曲可用性检查

```
GET /check/music?id={id}&br={br}
```

返回 `{ success: true/false, message: "..." }`。

### 听歌打卡

```
GET /scrobble?id={id}&sourceid={sourceid}&time={time}
```

### 红心/取消红心

```
GET /like?like={like}&id={id}&alg={alg}&time={time}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `like` | bool | **必填** | `true` 喜欢，`false` 取消 |
| `id` | string | **必填** | 歌曲 id |

### 喜欢列表

```
GET /likelist?uid={uid}
```

### 歌曲检测是否已收藏

```
GET /song/like/check?id={id}
```

### 歌曲创作者

```
GET /song/creators?id={id}
```

### 副歌信息

```
GET /song/chorus?id={id}
```

### 歌曲 Wiki

```
GET /song/wiki/summary?id={id}
```

### 购买过的歌曲

```
GET /song/purchased?limit={limit}&offset={offset}
```

### 动态封面

```
GET /song/dynamic/cover?id={id}
```

### 歌词标记

```
GET /song/lyrics/mark?id={id}
POST /song/lyrics/mark/add?id={id}&content={content}
POST /song/lyrics/mark/del?id={id}
```

---

## 专辑

### 专辑内容

```
GET /album?id={id}
```

### 专辑详情

```
GET /album/detail?id={id}
```

### 专辑动态

```
GET /album/detail/dynamic?id={id}
```

### 最新专辑

```
GET /album/newest
```

### 专辑列表

```
GET /album/list?type={type}&limit={limit}&offset={offset}&area={area}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `type` | string | "hot" | `hot`, `new` |
| `limit` | number | 30 | 返回数量 |

### 新专辑

```
GET /album/new?limit={limit}&offset={offset}
```

### 收藏/取消收藏专辑

```
GET /album/sub?id={id}&t={t}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `t` | number | **必填** | 1-收藏，其他-取消 |

### 收藏专辑列表

```
GET /album/sublist?limit={limit}&offset={offset}
```

### 专辑版权

```
GET /album/privilege?id={id}
```

### 专辑销售榜

```
GET /album/songsaleboard?type={type}&albumId={albumId}
```

---

## 歌手

### 歌手单曲

```
GET /artists?id={id}
```

### 歌手全部歌曲

```
GET /artist/songs?id={id}&limit={limit}&offset={offset}&order={order}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `order` | string | "hot" | `hot`(热门), `time`(时间) |

### 歌手专辑

```
GET /artist/album?id={id}&limit={limit}&offset={offset}
```

### 歌手 MV

```
GET /artist/mv?id={id}&limit={limit}&offset={offset}
```

### 歌手最新 MV

```
GET /artist/new/mv?id={id}&limit={limit}&offset={offset}
```

### 歌手最新歌曲

```
GET /artist/new/song?id={id}&limit={limit}&offset={offset}
```

### 歌手热门歌曲

```
GET /artist/top/song?id={id}
```

### 歌手描述

```
GET /artist/desc?id={id}
```

### 歌手详情

```
GET /artist/detail?id={id}
```

### 歌手动态

```
GET /artist/detail/dynamic?id={id}
```

### 歌手粉丝

```
GET /artist/fans?id={id}&limit={limit}&offset={offset}
```

### 歌手关注数量

```
GET /artist/follow/count?id={id}
```

### 歌手视频

```
GET /artist/video?id={id}&limit={limit}&offset={offset}
```

### 歌手分类

```
GET /artist/list?type={type}&area={area}&initial={initial}&limit={limit}&offset={offset}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `type` | number | -1 | 1-男歌手, 2-女歌手, 3-乐队 |
| `area` | number | -1 | 7-华语, 96-欧美, 8-日本, 16-韩国 |
| `initial` | string | 无 | 首字母 a-z |

### 收藏/取消收藏歌手

```
GET /artist/sub?t={t}&id={id}
```

### 收藏歌手列表

```
GET /artist/sublist?limit={limit}&offset={offset}
```

---

## 歌单

### 分类歌单

```
GET /top/playlist?cat={cat}&order={order}&limit={limit}&offset={offset}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `cat` | string | "全部" | 全部, 华语, 欧美, 流行, 摇滚, 民谣, 电子, 说唱, 轻音乐, 古风 等 |
| `order` | string | "hot" | `hot`(最热), `new`(最新) |
| `limit` | number | 50 | 返回数量 |

### 精品歌单

```
GET /top/playlist/highquality?cat={cat}&limit={limit}&before={before}
```

### 歌单详情

```
GET /playlist/detail?id={id}&s={s}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | number | **必填** | 歌单 id |
| `s` | number | 8 | 最近收藏者数量 |

### 歌单动态

```
GET /playlist/detail/dynamic?id={id}
```

### 歌单所有歌曲

```
GET /playlist/track/all?id={id}&limit={limit}&offset={offset}
```

获取歌单全部歌曲（不受歌单项数限制）。

### 歌单订阅者

```
GET /playlist/subscribers?id={id}&limit={limit}&offset={offset}
```

### 相关歌单

```
GET /related/playlist?id={id}
```

### 歌单分类

```
GET /playlist/catlist
```

### 热门歌单分类

```
GET /playlist/hot
```

### 精品歌单标签

```
GET /playlist/highquality/tags
```

### 歌单分类列表

```
GET /playlist/category/list
```

### 创建歌单

```
GET /playlist/create?name={name}&privacy={privacy}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `name` | string | **必填** | 歌单名称 |
| `privacy` | number | 0 | 0-普通, 10-隐私 |

### 删除歌单

```
GET /playlist/delete?id={id}
```

### 收藏/取消收藏歌单

```
GET /playlist/subscribe?t={t}&id={id}
```

### 歌单内歌曲操作

```
GET /playlist/tracks?op={op}&pid={pid}&tracks={tracks}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `op` | string | **必填** | `del` 删除, `add` 添加 |
| `pid` | string | **必填** | 歌单 id |
| `tracks` | string | **必填** | 歌曲 id（逗号分隔） |

### 添加歌曲到歌单

```
GET /playlist/track/add?id={id}&pid={pid}
```

### 删除歌单歌曲

```
GET /playlist/track/delete?id={id}&pid={pid}
```

### 编辑歌单

```
GET /playlist/update?id={id}&name={name}&desc={desc}&tags={tags}
```

### 更新歌单名称

```
GET /playlist/name/update?id={id}&name={name}
```

### 更新歌单描述

```
GET /playlist/desc/update?id={id}&desc={desc}
```

### 更新歌单标签

```
GET /playlist/tags/update?id={id}&tags={tags}
```

### 更新歌单封面

```
GET /playlist/cover/update?id={id}  (POST form-data: imgFile)
```

### 设置歌单隐私

```
GET /playlist/privacy?id={id}&privacy={privacy}
```

### 歌单排序

```
GET /playlist/order/update?ids={ids}
```

### 喜欢列表歌单

```
GET /playlist/mylike?time={time}&limit={limit}&offset={offset}
```

### 最近播放视频

```
GET /playlist/video/recent
```

---

## 排行榜

### 所有榜单

```
GET /toplist
```

### 榜单详情

```
GET /toplist/detail
```

### 排行榜详情

```
GET /top/list?id={id}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | number | **必填** | 歌单 id（从 toplist/detail 中获取） |

> **v4 变更**：不再支持 `idx` 参数，请使用 `toplist/detail` 接口获取榜单对应 `id`。

常用榜单 ID：3779629(新歌榜), 3778678(热歌榜), 2884035(原创榜), 19723756(飙升榜)

### 歌手榜

```
GET /toplist/artist
```

---

## 推荐

### 推荐歌单

```
GET /personalized?limit={limit}
```

### 推荐新音乐

```
GET /personalized/newsong
```

### 推荐 MV

```
GET /personalized/mv
```

### 推荐电台

```
GET /personalized/djprogram
```

### 独家放送

```
GET /personalized/privatecontent
```

### 独家放送列表

```
GET /personalized/privatecontent/list?limit={limit}&offset={offset}
```

### 每日推荐歌单

```
GET /recommend/resource
```

（需要登录）

### 每日推荐歌曲

```
GET /recommend/songs
```

（需要登录）

### 不喜欢推荐歌曲

```
GET /recommend/songs/dislike?id={id}
```

### 历史推荐歌曲

```
GET /history/recommend/songs
GET /history/recommend/songs/detail
```

---

## MV/视频

### MV 详情

```
GET /mv/detail?mvid={mvid}
```

### MV 详情信息

```
GET /mv/detail/info?mvid={mvid}
```

### MV 地址

```
GET /mv/url?id={id}&res={res}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `res` | number | 1080 | 分辨率：1080, 720, 480, 240 |

### 最新 MV

```
GET /mv/first?limit={limit}&area={area}
```

### MV 排行榜

```
GET /top/mv?limit={limit}&offset={offset}&area={area}
```

### 全部 MV

```
GET /mv/all?limit={limit}&offset={offset}&area={area}&type={type}&order={order}
```

### 独家 MV

```
GET /mv/exclusive/rcmd?limit={limit}&offset={offset}
```

### 收藏/取消收藏 MV

```
GET /mv/sub?t={t}&mvid={mvid}
```

### 已收藏 MV 列表

```
GET /mv/sublist?limit={limit}&offset={offset}
```

### 视频详情

```
GET /video/detail?id={id}
```

### 视频详情信息

```
GET /video/detail/info?id={id}
```

### 视频地址

```
GET /video/url?id={id}&res={res}
```

### 视频分组

```
GET /video/group?id={id}&offset={offset}
```

### 视频分组列表

```
GET /video/group/list
```

### 视频分类

```
GET /video/category/list
```

### 视频时间线（推荐）

```
GET /video/timeline/recommend?offset={offset}
```

### 视频时间线（全部）

```
GET /video/timeline/all?offset={offset}
```

### 相关视频

```
GET /related/allvideo?id={id}
```

### 收藏/取消收藏视频

```
GET /video/sub?t={t}&id={id}
```

---

## 评论

### 歌曲评论

```
GET /comment/music?id={id}&limit={limit}&offset={offset}
```

### 专辑评论

```
GET /comment/album?id={id}&limit={limit}&offset={offset}
```

### 歌单评论

```
GET /comment/playlist?id={id}&limit={limit}&offset={offset}
```

### MV 评论

```
GET /comment/mv?id={id}&limit={limit}&offset={offset}
```

### 电台评论

```
GET /comment/dj?id={id}&limit={limit}&offset={offset}
```

### 视频评论

```
GET /comment/video?id={id}&limit={limit}&offset={offset}
```

### 热门评论

```
GET /comment/hot?id={id}&type={type}&limit={limit}&offset={offset}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `type` | number | 0 | 0-歌曲, 1-MV, 2-歌单, 3-专辑, 4-电台, 5-视频 |

### 新版评论

```
GET /comment/new?type={type}&id={id}&sortType={sortType}&limit={limit}&offset={offset}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `sortType` | number | 2 | 1-推荐, 2-最新 |
| `type` | number | **必填** | 0-歌曲, 1-MV, 2-歌单, 3-专辑, 4-电台, 5-视频 |

### 楼层评论

```
GET /comment/floor?type={type}&id={id}&parentCommentId={parentCommentId}&limit={limit}&offset={offset}
```

### 发送/删除评论

```
GET /comment?t={t}&type={type}&id={id}&content={content}&commentId={commentId}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `t` | number | **必填** | 1-发送, 2-回复, 其他-删除 |

### 点赞/取消点赞评论

```
GET /comment/like?t={t}&type={type}&id={id}&cid={cid}
```

### 点赞/取消点赞资源

```
GET /resource/like?t={t}&type={type}&id={id}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `type` | number | **必填** | 1-MV, 4-电台, 5-视频 |

### 动态评论

```
GET /comment/event?threadId={threadId}
```

### 评论点赞列表

```
GET /comment/hug/list?type={type}&id={id}&cid={cid}
```

---

## 电台

### 热门电台

```
GET /dj/hot?limit={limit}&offset={offset}
```

### 精选电台

```
GET /dj/recommend
```

### 电台分类

```
GET /dj/catelist
```

### 分类推荐

```
GET /dj/recommend/type?type={type}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `type` | number | **必填** | 分类 id（从 dj/catelist 获取） |

### 电台详情

```
GET /dj/detail?rid={rid}
```

### 电台节目列表

```
GET /dj/program?rid={rid}&limit={limit}&offset={offset}&asc={asc}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `asc` | bool | `false` | 是否升序 |

### 电台节目详情

```
GET /dj/program/detail?id={id}
```

### 付费电台

```
GET /dj/paygift?limit={limit}&offset={offset}
```

### 推荐节目

```
GET /program/recommend?limit={limit}&offset={offset}
```

### 电台排行榜

```
GET /dj/toplist?limit={limit}
```

### 电台 24 小时榜

```
GET /dj/toplist/hours?limit={limit}
```

### 电台新人榜

```
GET /dj/toplist/newcomer?limit={limit}
```

### 电台热门榜

```
GET /dj/toplist/popular?limit={limit}
```

### 付费电台榜

```
GET /dj/toplist/pay?limit={limit}
```

### 电台订阅者

```
GET /dj/subscriber?id={id}&limit={limit}&offset={offset}
```

### 订阅/取消订阅电台

```
GET /dj/sub?t={t}&rid={rid}
```

### 订阅电台列表

```
GET /dj/sublist?limit={limit}&offset={offset}
```

### DJ 今日优选

```
GET /dj/today/perfered?page={page}
```

### 个性推荐

```
GET /dj/personalize/recommend?limit={limit}
```

### 类别推荐

```
GET /dj/category/recommend
```

### 类别热门

```
GET /dj/category/excludehot
```

### 电台 Banner

```
GET /dj/banner
```

### 订阅电台列表

```
GET /dj/radio/hot?categoryId={categoryId}&limit={limit}&offset={offset}
```

### DIFM 频道

```
GET /dj/difm/all/style/channel
GET /dj/difm/channel/subscribe?channelId={channelId}
GET /dj/difm/channel/unsubscribe?channelId={channelId}
GET /dj/difm/subscribe/channels/get
GET /dj/difm/playing/tracks/list?channelId={channelId}
```

---

## 相似推荐

### 相似歌曲

```
GET /simi/song?id={id}&limit={limit}&offset={offset}
```

### 相似歌单

```
GET /simi/playlist?id={id}&limit={limit}&offset={offset}
```

### 相似 MV

```
GET /simi/mv?mvid={mvid}
```

### 相似歌手

```
GET /simi/artist?id={id}
```

### 相似用户

```
GET /simi/user?id={id}&limit={limit}&offset={offset}
```

---

## 用户

### 用户详情

```
GET /user/detail?uid={uid}
```

### 用户歌单

```
GET /user/playlist?uid={uid}&limit={limit}&offset={offset}
```

### 用户创建的歌单

```
GET /user/playlist/create?uid={uid}&limit={limit}&offset={offset}
```

### 用户收藏的歌单

```
GET /user/playlist/collect?uid={uid}&limit={limit}&offset={offset}
```

### 听歌排行

```
GET /user/record?uid={uid}&type={type}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `type` | number | 1 | 0-所有时间, 1-最近一周 |

### 用户动态

```
GET /user/event?uid={uid}&limit={limit}&offset={offset}
```

### 用户电台

```
GET /user/dj?uid={uid}&limit={limit}&offset={offset}
```

### 用户创建的电台

```
GET /user/audio?uid={uid}
```

### 粉丝列表

```
GET /user/followeds?uid={uid}&limit={limit}&offset={offset}
```

### 关注列表

```
GET /user/follows?uid={uid}&limit={limit}&offset={offset}
```

### 关注/取消关注用户

```
GET /follow?t={t}&id={id}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `t` | number | **必填** | 1-关注，其他-取消 |

### 收藏计数

```
GET /user/subcount
```

### 用户等级

```
GET /user/level
```

### 用户账号信息

```
GET /user/account
```

### 用户详情（新版）

```
GET /user/detail/new?uid={uid}
```

### 用户绑定信息

```
GET /user/binding
```

### 用户绑定手机

```
GET /user/bindingcellphone
```

### 用户替换手机

```
GET /user/replacephone?phone={phone}&captcha={captcha}
```

### 用户评论历史

```
GET /user/comment/history?uid={uid}&limit={limit}&offset={offset}
```

### 用户勋章

```
GET /user/medal?uid={uid}
```

### 社交状态

```
GET /user/social/status?uid={uid}
POST /user/social/status/edit?content={content}
GET /user/social/status/rcmd
POST /user/social/status/support?statusId={statusId}
```

### 编辑用户信息

```
POST /user/update?nickname={nickname}&birthday={birthday}&city={city}&gender={gender}&province={province}&signature={signature}
```

### 获取用户 ID

```
POST /get/userids?nicknames={nicknames}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `nicknames` | string | **必填** | 用户名列表（逗号分隔） |

---

## 登录/账号

### 手机登录

```
GET /login/cellphone?phone={phone}&password={password}&captcha={captcha}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `password` | string | **必填** | 密码（MD5 加密后传入） |
| `captcha` | string | 可选 | 验证码 |

### 邮箱登录

```
GET /login?email={email}&password={password}
```

### 二维码登录

```
GET /login/qr/key
GET /login/qr/create?key={key}&qrimg={qrimg}
GET /login/qr/check?key={key}
```

三步流程：获取 key → 生成二维码 → 轮询扫码状态。

### 登录状态

```
GET /login/status
```

### 刷新登录

```
GET /login/refresh
```

### 退出登录

```
GET /logout
```

### 发送验证码

```
GET /captcha/sent?phone={phone}
```

### 验证验证码

```
GET /captcha/verify?phone={phone}&captcha={captcha}
```

### 手机号存在检查

```
GET /cellphone/existence/check?phone={phone}
```

### 注册（手机）

```
GET /register/cellphone?phone={phone}&password={password}&captcha={captcha}&nickname={nickname}
```

### 签到

```
GET /daily_signin?type={type}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `type` | number | 0 | 0-安卓(3经验), 1-网页(2经验) |

### 激活初始化资料

```
GET /activate/init/profile?nickname={nickname}
```

### 检测昵称

```
GET /nickname/check?nickname={nickname}
```

### 云贝签到

```
GET /yunbei/sign
```

---

## 云盘

### 云盘数据

```
GET /user/cloud?limit={limit}&offset={offset}
```

### 云盘详情

```
GET /user/cloud/detail?id={id}
```

### 云盘删除

```
GET /user/cloud/del?id={id}
```

### 云盘歌曲匹配

```
GET /cloud/match?uid={uid}&sid={sid}&asid={asid}
```

### 云盘导入

```
POST /cloud/import?id={id}&md5={md5}&song={song}&artist={artist}&size={size}&bitrate={bitrate}&url={url}&type={type}&ext={ext}&duration={duration}
```

### 云盘歌曲上传

```
POST /cloud  (form-data: songFile)
```

---

## VIP

### VIP 信息

```
GET /vip/info
```

### VIP 信息 v2

```
GET /vip/info/v2
```

### VIP 成长值

```
GET /vip/growthpoint
GET /vip/growthpoint/get?id={id}&taskToken={taskToken}
GET /vip/growthpoint/details?limit={limit}&offset={offset}
```

### VIP 任务

```
GET /vip/tasks
```

### VIP 时光机

```
GET /vip/timemachine
```

---

## 云贝

```
GET /yunbei/info                     # 云贝信息
GET /yunbei/expense?limit={limit}&offset={offset}    # 云贝支出
GET /yunbei/receipt?limit={limit}&offset={offset}    # 云贝收入
GET /yunbei/tasks                    # 云贝任务
GET /yunbei/tasks/todo               # 待完成云贝任务
POST /yunbei/task/finish?userTaskId={userTaskId}     # 完成任务
GET /yunbei/today                    # 今日云贝
GET /yunbei/rcmd/song?size={size}    # 云贝推歌
GET /yunbei/rcmd/song/history?size={size}&page={page}  # 推歌历史
```

---

## 音乐人

```
GET /musician/data/overview          # 音乐人数据概览
GET /musician/play/trend             # 音乐人播放趋势
POST /musician/sign                  # 音乐人签到
GET /musician/tasks                  # 音乐人任务
GET /musician/tasks/new              # 新音乐人任务
GET /musician/cloudbean              # 云豆信息
POST /musician/cloudbean/obtain?id={id}  # 领取云豆
```

---

## 一起听

```
GET /listentogether/status           # 一起听状态
POST /listentogether/room/create     # 创建房间
POST /listentogether/room/check?roomId={roomId}  # 检查房间
POST /listentogether/accept?roomId={roomId}      # 接受邀请
POST /listentogether/end?roomId={roomId}         # 结束一起听
POST /listentogether/heatbeat?roomId={roomId}    # 心跳
POST /listentogether/play/command?roomId={roomId}&command={command}  # 播放命令
POST /listentogether/sync/list/command?roomId={roomId}&command={command}  # 同步歌单命令
GET /listentogether/sync/playlist/get?roomId={roomId}  # 获取同步歌单
```

---

## 语音

```
POST /voice/upload?name={name}&md5={md5}&bitrate={bitrate}&length={length}&size={size}&voiceId={voiceId}
POST /voice/delete?voiceIds={voiceIds}
GET /voice/detail?voiceId={voiceId}
GET /voice/lyric?voiceId={voiceId}
GET /voicelist/list?voiceListId={voiceListId}
GET /voicelist/detail?voiceListId={voiceListId}
POST /voicelist/trans?voiceListId={voiceListId}&actionType={actionType}&id={id}&limit={limit}&offset={offset}
GET /voicelist/search?keywords={keywords}
GET /voicelist/list/search?keywords={keywords}
```

---

## 广播

```
GET /broadcast/channel/list?page={page}&pageSize={pageSize}
GET /broadcast/channel/currentinfo?channelId={channelId}
GET /broadcast/channel/collect/list
GET /broadcast/category/region/get
POST /broadcast/sub?channelId={channelId}&sub={sub}
```

---

## 风格

```
GET /style/list                    # 风格列表
GET /style/detail?tagId={tagId}    # 风格详情
GET /style/preference              # 风格偏好
GET /style/song?tagId={tagId}      # 风格歌曲
GET /style/album?tagId={tagId}     # 风格专辑
GET /style/artist?tagId={tagId}    # 风格歌手
GET /style/playlist?tagId={tagId}  # 风格歌单
```

---

## 其他

### 首页

```
GET /banner                              # 首页轮播
GET /homepage/block/page                 # 首页板块
GET /homepage/dragon/ball                # 首页引流球
```

### 新歌新碟

```
GET /top/song?type={type}                # 新歌速递
GET /top/album?limit={limit}&offset={offset}  # 新碟上架
GET /top/artists?limit={limit}&offset={offset}  # 热门歌手
GET /album/new?limit={limit}&offset={offset}    # 最新专辑
```

### 私人 FM

```
GET /personal_fm                        # 私人 FM
GET /personal_fm/mode?mode={mode}       # FM 模式切换
GET /fm_trash?id={id}                   # FM 废纸篓
```

### 动态/事件

```
GET /event?pagesize={pagesize}&lasttime={lasttime}  # 好友动态
POST /event/del?evId={evId}              # 删除动态
POST /event/forward?evId={evId}&forwards={forwards} # 转发动态
GET /weblog                              # 操作记录
```

### 私信/消息

```
GET /send/text?user_ids={user_ids}&msg={msg}     # 发送私信
GET /send/song?user_ids={user_ids}&id={id}       # 发送歌曲
GET /send/album?user_ids={user_ids}&id={id}      # 发送专辑
GET /send/playlist?playlist={playlist}&msg={msg}&user_ids={user_ids}  # 发送歌单
GET /msg/private?limit={limit}&offset={offset}    # 私信列表
GET /msg/private/history?uid={uid}&limit={limit}&offset={offset}  # 私信历史
GET /msg/comments?limit={limit}&offset={offset}   # 评论消息
GET /msg/forwards?limit={limit}&offset={offset}   # @我消息
GET /msg/notices?limit={limit}&offset={offset}    # 通知消息
GET /msg/recentcontact                          # 最近联系人
```

### 日历

```
GET /calendar?startTime={startTime}&endTime={endTime}
```

### 打卡

```
GET /sign/happy/info                              # 每日打卡
GET /signin/progress?moduleId={moduleId}          # 签到进度
```

### 话题

```
GET /hot/topic?limit={limit}&offset={offset}      # 热门话题
GET /topic/sublist                                # 订阅话题列表
GET /topic/detail?actid={actid}                   # 话题详情
GET /topic/detail/event/hot?actid={actid}         # 话题热门动态
```

### 听歌数据

```
GET /listen/data/total?uid={uid}                   # 累计听歌
GET /listen/data/today/song                        # 今日听歌
GET /listen/data/year/report?year={year}           # 年度报告
POST /listen/data/report?imei={imei}&data={data}   # 上报听歌数据
POST /listen/data/realtime/report?id={id}&sourceid={sourceid}&time={time}  # 实时上报
```

### 歌单智能推荐

```
GET /playmode/intelligence/list?id={id}&pid={pid}&sid={sid}
GET /playmode/song/vector?id={id}&pid={pid}&sid={sid}
```

### 数字专辑

```
GET /digitalAlbum/detail?id={id}                   # 数字专辑详情
GET /digitalAlbum/ordering?id={id}                 # 数字专辑购买
GET /digitalAlbum/purchased?limit={limit}&offset={offset}  # 已购数字专辑
GET /digitalAlbum/sales?albumIds={albumIds}        # 数字专辑销量
```

### 粉丝中心

```
GET /fanscenter/overview/get                       # 粉丝中心概览
GET /fanscenter/trend/list?limit={limit}&offset={offset}  # 粉丝趋势
GET /fanscenter/basicinfo/age/get                  # 粉丝年龄分布
GET /fanscenter/basicinfo/gender/get               # 粉丝性别分布
GET /fanscenter/basicinfo/province/get             # 粉丝地域分布
```

### 云音乐精选

```
GET /aidj/content/rcmd                             # AI 推荐
GET /mlog/music/rcmd?limit={limit}&offset={offset}  # Mlog 音乐推荐
GET /mlog/to/video?id={id}                         # Mlog 转视频
GET /mlog/url?id={id}&res={res}                    # Mlog 地址
```

### 近期收听

```
GET /record/recent/song?limit={limit}              # 近期歌曲
GET /record/recent/album?limit={limit}             # 近期专辑
GET /record/recent/playlist?limit={limit}          # 近期歌单
GET /record/recent/dj?limit={limit}                # 近期电台
GET /record/recent/video?limit={limit}             # 近期视频
GET /record/recent/voice?limit={limit}             # 近期语音
GET /recent/listen/list?limit={limit}              # 最近收听列表
```

### 分享/资源

```
POST /share/resource?id={id}&type={type}&msg={msg} # 分享资源
GET /starpick/comments/summary?id={id}             # 精选评论
```

### 歌曲辅助数据

```
GET /song/red/count?type={type}&threadId={threadId}  # 红心/评论计数
GET /song/order/update?pid={pid}&ids={ids}         # 歌单歌曲排序
GET /song/monthdownlist?id={id}                    # 月度下载
GET /song/singledownlist?id={id}                   # 单曲下载
GET /song/downlist?id={id}                         # 下载列表
GET /threshold/detail/get                          # 阈值详情
```

### 自选曲库

```
GET /sati/tag/list                                 # 标签列表
GET /sati/resource/list?tagId={tagId}              # 资源列表
GET /sati/resource/list/more?tagId={tagId&page={page}&pageSize={pageSize}
POST /sati/resource/sub?tagId={tagId}&sub={sub}    # 订阅
GET /sati/resource/sub/list                        # 订阅列表
GET /sati/timescene/resources/get?tagName={tagName} # 时空资源
```

### 其他

```
GET /countries/code/list                           # 国家码
GET /lbs/city/code                                 # LBS 城市码
GET /batch                                         # 批量请求
GET /setting                                       # 设置
POST /avatar/upload (form-data: imgFile)           # 头像上传
GET /inner/version                                 # 内置版本
GET /api                                           # API 列表
GET /verify/getQr                                  # 获取二维码
GET /verify/qrcodestatus                           # 二维码状态
POST /eapi/decrypt?params={params}                 # EAPI 解密
```

### 粉丝/用户状态

```
GET /user/follow/mixed?uid={uid}                   # 共同关注
GET /user/mutualfollow/get?uid={uid}               # 互关列表
GET /user/binding                                  # 绑定信息
GET /creator/authinfo/get                          # 创作者认证
```

### 云村/UGC

```
GET /ugc/song/get?id={id}                          # UGC 歌曲
GET /ugc/album/get?id={id}                         # UGC 专辑
GET /ugc/artist/get?id={id}                        # UGC 歌手
GET /ugc/mv/get?mvid={mvid}                        # UGC MV
GET /ugc/detail?id={id}&type={type}                # UGC 详情
GET /ugc/user/devote?uid={uid}                     # UGC 用户贡献
GET /ugc/artist/search?keyword={keyword}           # UGC 歌手搜索
```

### 排行榜（更多）

```
GET /toplist/detail/v2                             # 榜单详情 v2
GET /chart/detail?chartId={chartId}                #  chart 详情
GET /chart/song/detail?chartId={chartId}           #  chart 歌曲
```

### 最近播放

```
GET /playlist/video/recent                         # 最近播放视频
```

---

## 错误码

| 错误码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 301 | 需要登录 |
| 302 | 需要登录（如音乐人签到） |
| 400 | 参数错误 |
| 404 | 资源不存在 |
| 502 | 请求网易云接口失败 |
| -2 | 权限不足（用户隐私设置） |
| -460 | 网络环境存在风险，请稍后重试 |
| -462 | 需要验证（重启服务即可） |

---

## 更新日志

### 2026-05-25 — 升级至 v4.32.0

- **升级**：从 v3.2.0 升级至 v4.32.0（377 个 API 模块）
- **新增**：云盘、VIP、云贝、音乐人、一起听、广播、语音、风格、UGC、粉丝中心等完整功能
- **新加密**：支持 `eapi` 加密方式
- **新登录**：支持二维码登录
- **HTTP 库**：从 `request` 迁移至 `axios`
- **加密库**：从 Node.js `crypto` 迁移至 `crypto-js` + `node-forge`
- **反爬内置**：v4.32.0 原生支持 MUSIC_A 匿名 token 自动获取

### 2026-05-25 — 反爬修复（v3.2.0 时期）

- 通过 `register/anonimous` 获取 `MUSIC_A` 匿名 Token 绕过 -462 验证
- Cookie 持久化跨请求保持会话
- 响应 AES 解密和 gzip 解压处理
- 完善请求头（Modern User-Agent、Origin、Referer、X-Real-IP）
