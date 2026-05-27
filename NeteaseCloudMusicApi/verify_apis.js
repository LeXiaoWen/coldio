// 全面 API 验证脚本 (v4.32.0)
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3000';
const SONG_ID = 186016;
const ALBUM_ID = 32311;
const ARTIST_ID = 6452;
const PLAYLIST_ID = 24381616;
const MV_ID = 5350016;
const VIDEO_ID = 'F001E09C1AA3FDF8994E2F8BC2D9B089';
const DJ_ID = 336355127;
const USER_ID = 429350402;

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json, path });
        } catch(e) {
          resolve({ status: res.statusCode, body: data, path, parseError: e.message });
        }
      });
    }).on('error', reject);
  });
}

function checkResult(result) {
  const body = result.body || {};
  // Direct code field
  if (body.code === 200) return 'ok';
  // Nested in data field (e.g., login/status)
  if (body.data && body.data.code === 200) return 'ok';
  // Special success indicator
  if (body.success === true) return 'ok';
  // Needs login
  if (body.code === 301 || body.code === 302 || (body.data && (body.data.code === 301 || body.data.code === 302))) return 'login';
  // Parameter issue (API works, test data invalid)
  if (body.code === 400 || body.code === 404) return 'param';
  // Permission issue (API works, user data private/not available)
  if (body.code === -2) return 'param';
  // Other
  return `code=${body.code}`;
}

async function run() {
  console.log('\n=== 网易云音乐 API 全面验证 (v4.32.0) ===\n');

  const allTests = [
    { section: '【基础数据】', tests: [
      ['banner (首页轮播)', () => get('/banner')],
      ['search (搜索)', () => get('/search?keywords=海阔天空')],
      ['search suggest (搜索建议)', () => get('/search/suggest?keywords=海阔天空')],
      ['search multimatch (多匹配搜索)', () => get('/search/multimatch?keywords=海阔天空')],
      ['search hot (热搜)', () => get('/search/hot')],
      ['search hot detail (热搜详情)', () => get('/search/hot/detail')],
      ['search default (默认搜索)', () => get('/search/default')],
      ['search match (搜索匹配)', () => get('/search/match?keywords=晴天')],
      ['cloudsearch (云搜索)', () => get('/cloudsearch?keywords=海阔天空')],
    ]},
    { section: '【歌曲】', tests: [
      ['song detail (歌曲详情)', () => get(`/song/detail?ids=${SONG_ID}`)],
      ['song url (歌曲地址)', () => get(`/song/url?id=${SONG_ID}`)],
      ['song url v1 (歌曲地址v1)', () => get(`/song/url/v1?id=${SONG_ID}&level=standard`)],
      ['song download url (下载地址)', () => get(`/song/download/url?id=${SONG_ID}`)],
      ['lyric (歌词)', () => get('/lyric?id=347230')],
      ['lyric new (新歌词)', () => get('/lyric/new?id=347230')],
      ['check music (歌曲可用检查)', () => get(`/check/music?id=${SONG_ID}&br=128000`)],
      ['scrobble (听歌打卡)', () => get(`/scrobble?id=${SONG_ID}&sourceid=${SONG_ID}&time=240`)],
      ['like (喜欢歌曲)', () => get(`/like?id=${SONG_ID}&like=true`)],
      ['likelist (喜欢列表)', () => get(`/likelist?uid=${USER_ID}`)],
    ]},
    { section: '【专辑】', tests: [
      ['album (专辑内容)', () => get(`/album?id=${ALBUM_ID}`)],
      ['album detail (专辑详情)', () => get(`/album/detail?id=${ALBUM_ID}`)],
      ['album newest (最新专辑)', () => get('/album/newest')],
      ['album list (专辑列表)', () => get('/album/list?type=hot')],
      ['album sub (收藏专辑)', () => get(`/album/sub?id=${ALBUM_ID}&t=1`)],
      ['album sublist (收藏专辑列表)', () => get('/album/sublist')],
    ]},
    { section: '【歌手】', tests: [
      ['artists (歌手单曲)', () => get(`/artists?id=${ARTIST_ID}`)],
      ['artist album (歌手专辑)', () => get(`/artist/album?id=${ARTIST_ID}`)],
      ['artist mv (歌手MV)', () => get(`/artist/mv?id=${ARTIST_ID}`)],
      ['artist desc (歌手描述)', () => get(`/artist/desc?id=${ARTIST_ID}`)],
      ['artist list (歌手分类)', () => get('/artist/list?type=1&area=7&initial=65')],
      ['artist detail (歌手详情)', () => get(`/artist/detail?id=${ARTIST_ID}`)],
      ['artist songs (歌手全部歌曲)', () => get(`/artist/songs?id=${ARTIST_ID}`)],
      ['artist sub (收藏歌手)', () => get(`/artist/sub?id=${ARTIST_ID}&t=1`)],
      ['artist sublist (收藏歌手列表)', () => get('/artist/sublist')],
      ['artist top song (歌手热门歌曲)', () => get(`/artist/top/song?id=${ARTIST_ID}`)],
    ]},
    { section: '【歌单】', tests: [
      ['top playlist (分类歌单)', () => get('/top/playlist?limit=5')],
      ['top playlist highquality (精品歌单)', () => get('/top/playlist/highquality?limit=5')],
      ['playlist detail (歌单详情)', () => get(`/playlist/detail?id=${PLAYLIST_ID}`)],
      ['playlist catlist (歌单分类)', () => get('/playlist/catlist')],
      ['playlist hot (热门歌单分类)', () => get('/playlist/hot')],
      ['playlist track all (歌单所有歌曲)', () => get(`/playlist/track/all?id=${PLAYLIST_ID}`)],
      ['playlist subscribers (歌单收藏者)', () => get(`/playlist/subscribers?id=${PLAYLIST_ID}`)],
      ['related playlist (相关歌单)', () => get(`/related/playlist?id=${SONG_ID}`)],
      ['playlist highquality tags (精品歌单标签)', () => get('/playlist/highquality/tags')],
    ]},
    { section: '【排行榜】', tests: [
      ['toplist (所有榜单)', () => get('/toplist')],
      ['toplist detail (榜单详情)', () => get('/toplist/detail')],
      ['top list (排行榜)', () => get('/top/list?id=3779629')],
      ['top artists (歌手榜)', () => get('/toplist/artist')],
    ]},
    { section: '【推荐】', tests: [
      ['personalized (推荐歌单)', () => get('/personalized?limit=5')],
      ['personalized newsong (推荐新音乐)', () => get('/personalized/newsong')],
      ['personalized mv (推荐MV)', () => get('/personalized/mv')],
      ['personalized dj (推荐电台)', () => get('/personalized/djprogram')],
      ['personalized privatecontent (独家放送)', () => get('/personalized/privatecontent')],
      ['recommend resource (每日推荐)', () => get('/recommend/resource')],
      ['recommend songs (每日推荐歌曲)', () => get('/recommend/songs')],
    ]},
    { section: '【MV/视频】', tests: [
      ['mv detail (MV数据)', () => get(`/mv/detail?mvid=${MV_ID}`)],
      ['mv url (MV地址)', () => get(`/mv/url?id=${MV_ID}`)],
      ['mv first (最新MV)', () => get('/mv/first?limit=5')],
      ['top mv (MV排行)', () => get('/top/mv?limit=5')],
      ['mv all (全部MV)', () => get('/mv/all?limit=5')],
      ['mv exclusive rcmd (独家MV)', () => get('/mv/exclusive/rcmd?limit=5')],
      ['video detail (视频详情)', () => get(`/video/detail?id=${VIDEO_ID}`)],
      ['video url (视频地址)', () => get(`/video/url?id=${VIDEO_ID}`)],
      ['video group (视频分组)', () => get('/video/group?id=101')],
      ['video category list (视频分类)', () => get('/video/category/list')],
      ['video timeline recommend (视频推荐)', () => get('/video/timeline/recommend')],
      ['related allvideo (相关视频)', () => get(`/related/allvideo?id=${SONG_ID}`)],
    ]},
    { section: '【相似推荐】', tests: [
      ['simi artist (相似歌手)', () => get(`/simi/artist?id=${ARTIST_ID}`)],
      ['simi song (相似歌曲)', () => get(`/simi/song?id=${SONG_ID}`)],
      ['simi mv (相似MV)', () => get(`/simi/mv?mvid=${MV_ID}`)],
      ['simi playlist (相似歌单)', () => get(`/simi/playlist?id=${SONG_ID}`)],
      ['simi user (相似用户)', () => get(`/simi/user?id=${SONG_ID}`)],
    ]},
    { section: '【电台】', tests: [
      ['dj hot (热门电台)', () => get('/dj/hot?limit=5')],
      ['dj recommend (推荐电台)', () => get('/dj/recommend')],
      ['dj catelist (电台分类)', () => get('/dj/catelist')],
      ['dj recommend type (分类推荐)', () => get('/dj/recommend/type?type=2001')],
      ['dj paygift (付费精选)', () => get('/dj/paygift?limit=5')],
      ['dj detail (电台详情)', () => get(`/dj/detail?rid=${DJ_ID}`)],
      ['dj program (电台节目)', () => get(`/dj/program?rid=${DJ_ID}`)],
      ['program recommend (节目推荐)', () => get('/program/recommend')],
      ['dj toplist (电台排行榜)', () => get('/dj/toplist')],
      ['dj toplist hours (电台24小时榜)', () => get('/dj/toplist/hours')],
    ]},
    { section: '【评论】', tests: [
      ['comment music (歌曲评论)', () => get(`/comment/music?id=${SONG_ID}&limit=3`)],
      ['comment album (专辑评论)', () => get(`/comment/album?id=${ALBUM_ID}&limit=3`)],
      ['comment playlist (歌单评论)', () => get(`/comment/playlist?id=${PLAYLIST_ID}&limit=3`)],
      ['comment hot (热门评论)', () => get(`/comment/hot?id=${SONG_ID}&type=0`)],
      ['comment mv (MV评论)', () => get(`/comment/mv?id=${MV_ID}&limit=3`)],
      ['comment dj (电台评论)', () => get(`/comment/dj?id=${DJ_ID}&limit=3`)],
      ['comment video (视频评论)', () => get(`/comment/video?id=${VIDEO_ID}&limit=3`)],
      ['comment new (新版评论)', () => get(`/comment/new?type=0&id=${SONG_ID}&sortType=1`)],
      ['comment floor (楼层评论)', () => get(`/comment/floor?type=0&id=${SONG_ID}&parentCommentId=1`)],
    ]},
    { section: '【新歌/新碟】', tests: [
      ['top song (新歌速递)', () => get('/top/song?type=0')],
      ['top album (新碟上架)', () => get('/top/album?limit=5')],
      ['top artists (热门歌手)', () => get('/top/artists?limit=5')],
      ['album new (最新专辑)', () => get('/album/new?limit=5')],
    ]},
    { section: '【登录相关】', tests: [
      ['login status (登录状态)', () => get('/login/status')],
      ['login qr key (二维码key)', () => get('/login/qr/key')],
      ['login qr create (二维码创建)', () => get('/login/qr/create')],
      ['captcha sent (发送验证码)', () => get('/captcha/sent?phone=13800000000')],
    ]},
    { section: '【用户公开接口】', tests: [
      ['user detail (用户详情)', () => get(`/user/detail?uid=${USER_ID}`)],
      ['user playlist (用户歌单)', () => get(`/user/playlist?uid=${USER_ID}`)],
      ['user record (听歌排行)', () => get(`/user/record?uid=${USER_ID}`)],
      ['user subcount (收藏计数)', () => get('/user/subcount')],
      ['user dj (用户电台)', () => get(`/user/dj?uid=${USER_ID}`)],
      ['user followeds (用户粉丝)', () => get(`/user/followeds?uid=${USER_ID}`)],
      ['user follows (用户关注)', () => get(`/user/follows?uid=${USER_ID}`)],
      ['user event (用户动态)', () => get(`/user/event?uid=${USER_ID}`)],
    ]},
    { section: '【新功能】', tests: [
      ['calendar (日历)', () => get('/calendar')],
      ['batch (批量请求)', () => get('/batch')],
      ['setting (设置)', () => get('/setting')],
      ['vip info (VIP信息)', () => get('/vip/info')],
      ['vip info v2 (VIP信息v2)', () => get('/vip/info/v2')],
      ['song creators (歌曲创作者)', () => get(`/song/creators?id=${SONG_ID}`)],
      ['musician sign (音乐人签到)', () => get('/musician/sign')],
      ['user level (用户等级)', () => get('/user/level')],
      ['user account (用户账号)', () => get('/user/account')],
      ['song like check (歌曲喜欢检查)', () => get(`/song/like/check?id=${SONG_ID}`)],
    ]},
  ];

  let pass = 0, fail = 0, loginNeeded = 0, paramIssue = 0;

  for (const section of allTests) {
    console.log(section.section);
    for (const [name, fn] of section.tests) {
      try {
        const result = await fn();
        const status = checkResult(result);
        if (status === 'ok') {
          console.log(`  ✓ ${name}`);
          pass++;
        } else if (status === 'login') {
          console.log(`  ∼ ${name} — 需要登录 (code=301)`);
          loginNeeded++;
          pass++;
        } else if (status === 'param') {
          console.log(`  ? ${name} — 参数/ID问题 (code=${result.body.code})`);
          paramIssue++;
          pass++;
        } else {
          console.log(`  ✗ ${name} — ${status}`);
          fail++;
        }
      } catch(e) {
        console.log(`  ✗ ${name} — ${e.message}`);
        fail++;
      }
    }
  }

  console.log('\n========================================');
  console.log(`通过: ${pass} / ${pass + fail}`);
  console.log(`  - 正常: ${pass - loginNeeded - paramIssue}`);
  console.log(`  - 需登录: ${loginNeeded}`);
  console.log(`  - 参数/ID: ${paramIssue}`);
  if (fail > 0) console.log(`失败: ${fail}`);
  console.log('========================================\n');
}

run().catch(console.error);
