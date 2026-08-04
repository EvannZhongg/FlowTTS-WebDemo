# FlowTTS WebDemo

基于腾讯云 TRTC 的 TTS（文字转语音）演示项目，支持普通合成、流式合成、声音克隆。

## 功能

- 文本转语音（支持 pcm/wav/mp3，可调语速/音量/音高）
- 流式合成（SSE 实时推流）
- 声音克隆（上传或录制音频，生成专属音色）
- 双模型音色库（`flow_02_turbo` 提供 101 个精选音色；`flow_01_ex` 提供全部 428 个音色）
- 多语言支持（中文、英语、日语、韩语等）
- 任意邮箱确认链接登录/自动注册 + Supabase JWT 鉴权
- 体验配额管理（默认 10,000 点；普通/流式合成 100 点，克隆与克隆试听 50 点）

## 快速开始

```bash
cd backend
cp .env.example .env   # 填入腾讯云和 Supabase 配置
npm install
node server.js
```

浏览器访问：`http://localhost:9000/app/index.html`

也可以从仓库根目录启动：

```bash
npm install
npm run dev
```

## Vercel 部署

项目已按 Vercel Express 应用结构组织：

```text
├── server.js              # Vercel 自动识别的 Express Function 入口
├── backend/app.js         # Express 应用（不监听端口）
├── backend/server.js      # 仅用于本地长期运行
├── scripts/verify-deployment.js
├── public/app/            # Vercel 静态资源
└── vercel.json
```

部署时应使用仓库根目录作为 Vercel 的 Root Directory，不要设置为
`app` 或 `backend`。Vercel 会在构建阶段执行：

```bash
npm install
npm run build
```

根路径 `/` 和 `/auth/callback` 由 Express 保留查询参数与 URL hash 后跳转至
`/app/index.html`；`/api/**`、`/health` 由同一个 Express Function 处理。

环境变量需要在 Vercel Project Settings 中配置，并勾选所需的 Production、
Preview 和 Development 环境。Supabase Auth 的允许回调地址中也需要加入：

```text
https://<your-domain>/app/index.html
```

前端源码直接位于 `public/app/`。Vercel 不会从 Express 的
`express.static()` 提供静态文件，因此不要再把页面移回仓库根目录的
`app/`。

## 项目结构

```
├── public/app/
│   ├── index.html                # Studio 首页
│   ├── tts.html                  # 文本转语音 / SSE 流式合成
│   ├── voice-clone.html          # 声音克隆
│   ├── voices.html               # 音色库
│   ├── history.html              # 按账号隔离的云端历史记录
│   ├── assets/                   # 共享样式、导航与业务脚本
│   ├── supabase-auth-inject.js   # 登录注入
│   └── quota-interceptor.js      # 配额拦截
└── backend/
    ├── server.js                 # Express 入口（端口 9000）
    ├── routes/tts.js             # TTS 合成 & 流式合成
    ├── routes/voice-clone.js     # 声音克隆
    ├── routes/user.js            # 当前用户与配额
    ├── middleware/{auth,quota}   # JWT 认证 & 配额中间件
    ├── utils/                    # 腾讯云 API、Supabase、音色库
    └── data/                     # turbo 与 flow_01_ex 静态音色映射
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `TX_SECRET_ID` / `TX_SECRET_KEY` | 腾讯云 API 密钥 |
| `TRTC_SDK_APP_ID` | TRTC 应用 ID |
| `TRTC_REGION` | 地域，默认 `ap-beijing` |
| `SUPABASE_URL` | Supabase 项目 URL |
| `SUPABASE_PUBLISHABLE_KEY` | 浏览器和 Auth 验证使用的公开 Key |
| `SUPABASE_SECRET_KEY` | 仅服务端使用的 Secret Key，不得暴露到前端 |
| `SUPABASE_HISTORY_BUCKET` | 私有历史音频 Storage Bucket |
| `AUTH_REDIRECT_URL` | 可选；邮箱登录固定回调地址，例如 `https://your-domain/app/index.html` |
| `API_PORT` | 服务端口，默认 `9000` |
