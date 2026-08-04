# FlowTTS WebDemo

## 项目概述

TTS 演示项目，前后端同源部署。后端 Express 服务托管前端静态文件，无跨域问题。

- **前端**：`public/app/`（Vercel 静态资源目录）
- **后端**：`backend/`（Node.js/Express，端口 9000）
- **云服务**：腾讯云 TRTC TTS API
- **认证**：Supabase JWT + 每日配额

## 启动

```bash
cd backend && npm install && node server.js
# 访问 http://localhost:9000/app/tts.html
```

## 关键文件

| 文件 | 说明 |
|------|------|
| `backend/server.js` | 入口，注册路由和静态文件服务 |
| `backend/routes/tts.js` | `/api/tts/synthesize`、`/api/tts/synthesize-stream`、`/api/tts/voices` |
| `backend/routes/voice-clone.js` | `/api/voice/clone`、`/api/voice/list`、`/api/voice/:id` |
| `backend/utils/tencent-api.js` | TC3-HMAC-SHA256 签名 + API 调用 |
| `backend/utils/voice-library-manager.js` | 加载 `data/voices.json`，管理克隆音色缓存 |
| `backend/utils/supabase.js` | JWT 验证、配额查询/扣减 |
| `backend/middleware/auth.js` | 验证 Bearer token |
| `backend/middleware/quota.js` | 扣减配额（TTS=1，克隆=10） |
| `backend/data/voices.json` | 预设音色列表（flow_01_turbo） |
| `public/app/tts.html` | 前端页面，API 地址用 `window.location.origin` 自动适配 |

## API

```
GET  /api/tts/voices              公开，返回预设音色列表
POST /api/tts/synthesize          需登录，普通合成，返回 base64 音频
POST /api/tts/synthesize-stream   需登录，SSE 流式合成
POST /api/voice/clone             需登录，声音克隆（消耗 10 配额）
GET  /api/voice/list              需登录，获取用户克隆音色
DELETE /api/voice/:voiceId        需登录，软删除克隆音色
GET  /health                      健康检查
```

## Model 参数

TTS 合成和声音克隆均支持可选的 `model` 参数：
- `flow_02_turbo`（默认/自动）
- `flow_01_ex`

不传则由腾讯云自动选择。

## 注意事项

- `.env` 不提交，参考 `.env.example` 配置
- 音频数据不落盘，合成结果直接返回 base64，历史记录存浏览器 IndexedDB
- 克隆音色的 voice_id 和 model 存 Supabase `cloned_voices` 表
