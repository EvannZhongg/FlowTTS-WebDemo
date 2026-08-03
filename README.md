# FlowTTS WebDemo

基于腾讯云 TRTC 的 TTS（文字转语音）演示项目，支持普通合成、流式合成、声音克隆。

## 功能

- 文本转语音（支持 pcm/wav/mp3，可调语速/音量/音高）
- 流式合成（SSE 实时推流）
- 声音克隆（上传或录制音频，生成专属音色）
- 双模型音色库（101 个 `flow_02_turbo` 精选音色 + 327 个 `flow_01_ex` 系统音色）
- 多语言支持（中文、英语、日语、韩语等）
- 任意邮箱验证码登录/自动注册 + Supabase JWT 鉴权
- 体验配额管理（默认 10,000 点；普通/流式合成 100 点，克隆与克隆试听 50 点）

## 快速开始

```bash
cd backend
cp .env.example .env   # 填入腾讯云和 Supabase 配置
npm install
node server.js
```

浏览器访问：`http://localhost:9000/app/index.html`

## 项目结构

```
├── app/
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
| `SUPABASE_ANON_KEY` | Supabase 匿名密钥 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务密钥 |
| `API_PORT` | 服务端口，默认 `9000` |
