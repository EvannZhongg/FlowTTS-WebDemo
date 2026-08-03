/**
 * TTS API 路由
 *
 * 功能：
 * - 文本转语音合成（TextToSpeech）
 * - SSE 流式语音合成（TextToSpeechSSE）
 * - 获取可用音色列表（公开接口，无需认证）
 *
 * 认证：需要 JWT token（除 /voices 端点外）
 * 配额：普通/流式合成 100 点，克隆音色试听 50 点
 *
 * 环境变量：
 * - TX_SECRET_ID：腾讯云 SecretId
 * - TX_SECRET_KEY：腾讯云 SecretKey
 * - TRTC_SDK_APP_ID：TRTC 应用 ID
 * - TRTC_REGION：地域（默认 ap-beijing）
 */

const express = require('express');
const router = express.Router();

const logger = require('../utils/logger');
const { callTencentAPI, callTencentAPIStream } = require('../utils/tencent-api');
const authenticate = require('../middleware/auth');
const { requireQuota } = require('../middleware/quota');
const voiceLibraryManager = require('../utils/voice-library-manager');

// TTS API configuration
const TTS_SERVICE = 'trtc';
const TTS_HOST = 'trtc.ai.tencentcloudapi.com';
const TTS_VERSION = '2019-07-22';
const TTS_REGION = process.env.TRTC_REGION || 'ap-beijing';
const SDK_APP_ID = parseInt(process.env.TRTC_SDK_APP_ID, 10) || 0;

// 旧的 loadVoiceLibrary() 和 getModelForVoice() 函数已移除
// 现在使用 VoiceLibraryManager 统一管理

/**
 * Get Tencent Cloud credentials from environment variables
 * All users share the same admin credentials
 * @returns {Object} { secretId, secretKey }
 */
function getTencentCredentials() {
    const secretId = process.env.TX_SECRET_ID;
    const secretKey = process.env.TX_SECRET_KEY;

    if (!secretId || !secretKey) {
        throw new Error('Tencent Cloud credentials not configured in .env file');
    }

    return { secretId, secretKey };
}

/**
 * GET /api/tts/voices
 * Get available TTS voice list (public endpoint, no auth required)
 *
 * Query Parameters:
 * - includeExtended: boolean (default: false) - 是否包含扩展音色（flow_01_ex）
 *
 * Response:
 * {
 *   "voices": [
 *     { "id": "v-female-R2s4N9qJ", "name": "小芮", "language": "zh-CN", "description": "女声客服" },
 *     ...
 *   ]
 * }
 */
router.get('/voices', async (req, res) => {
    try {
        // 获取查询参数：是否包含扩展音色（默认 false）
        const includeExtended = req.query.includeExtended === 'true';

        // 根据参数选择不同的方法
        const { preset, languageMap, languageMaps } = includeExtended
            ? await voiceLibraryManager.getAllVoices()
            : await voiceLibraryManager.getStandardVoices();

        // 返回预设音色（不包含克隆音色，因为这是公开端点）
        res.json({
            voices: preset,
            languageMap,
            languageMaps
        });
    } catch (error) {
        logger.error('[TTS] Failed to load voices:', error);
        // 降级：返回默认音色
        res.json({
            voices: voiceLibraryManager.getFallbackVoices()
        });
    }
});

/**
 * POST /api/tts/synthesize
 * Normal TTS synthesis (100 points; clone audition 50 points)
 *
 * Body:
 * {
 *   "text": "要合成的文本",
 *   "voiceId": "v-female-R2s4N9qJ",
 *   "format": "pcm",          // pcm | wav | mp3 | opus (default: pcm)
 *   "sampleRate": 24000,       // 16000 | 24000 (default: 24000)
 *   "speedRatio": 1.0,
 *   "volumeRatio": 1.0,
 *   "emotionCategory": "happy"
 * }
 */
router.post('/synthesize', authenticate, requireQuota((req) => (
    req.body?.billingContext === 'clone-audition' ? 'voice-clone-audition' : 'tts-synthesize'
)), async (req, res) => {
    try {
        const {
            text,
            voiceId = 'v-female-R2s4N9qJ', // 默认音色：温柔姐姐
            language, // 可选语言参数
            model: requestedModel, // 可选 model 参数: flow_02_turbo | flow_01_ex
            format, // 音频格式: pcm | wav | mp3 | opus (默认 pcm)
            sampleRate, // 采样率: 16000 | 24000 (默认 24000)
            speed = 1, // 语速 (0.5-2.0)
            volume = 1, // 音量 (0.5-2.0)
            pitch = 0, // 音高 (-10 to 10)
            emotion // 情感风格 (可选, 仅 flow_01_ex 模型生效): happy|sad|angry|fearful|disgusted|surprised|calm|fluent|whisper
        } = req.body;

        if (!text) {
            return res.status(400).json({
                code: 'missing_text',
                message: 'Missing required field: text'
            });
        }

        // 验证并限制参数范围 (腾讯云 API 范围: Speed 0.5-2.0, Volume 0-10, Pitch -12 to 12)
        const validatedSpeed = Math.max(0.5, Math.min(2.0, parseFloat(speed) || 1));
        const validatedVolume = Math.max(0, Math.min(10, parseFloat(volume) || 1));
        const validatedPitch = Math.max(-12, Math.min(12, parseFloat(pitch) || 0));

        // 非流式接口原生支持 pcm/wav/mp3/opus，默认保持服务端原始 PCM 输出。
        const VALID_FORMATS = ['pcm', 'wav', 'mp3', 'opus'];
        const validatedFormat = VALID_FORMATS.includes(format) ? format : 'pcm';
        const validatedSampleRate = [16000, 24000].includes(Number(sampleRate)) ? Number(sampleRate) : 24000;

        // Get Tencent Cloud credentials from environment
        const { secretId, secretKey } = getTencentCredentials();

        // 已知系统音色必须使用音色库声明的模型，克隆音色可由前端显式指定。
        const VALID_MODELS = ['flow_02_turbo', 'flow_01_ex'];
        const voiceModel = await voiceLibraryManager.getModelForVoice(voiceId);
        const model = voiceModel || ((requestedModel && VALID_MODELS.includes(requestedModel)) ? requestedModel : '');

        // 语言处理：前端显式传入则透传；未传则不带 Language，交由云服务自行检测
        const requestedLanguage = (typeof language === 'string' && language.trim()) ? language.trim() : '';

        // emotion 参数校验：仅 flow_01_ex 模型生效，其他模型忽略
        const SUPPORTED_EMOTIONS = ['happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'calm', 'fluent', 'whisper'];
        let validatedEmotion = null;
        if (emotion && typeof emotion === 'string' && emotion.trim()) {
            if (model !== 'flow_01_ex') {
                logger.warn(`[TTS] emotion 参数仅 flow_01_ex 模型生效，当前 model=${model}，已忽略 emotion=${emotion}`);
            } else if (!SUPPORTED_EMOTIONS.includes(emotion)) {
                return res.status(400).json({
                    code: 'invalid_emotion',
                    message: `emotion 取值无效: ${emotion}，支持: ${SUPPORTED_EMOTIONS.join(', ')}`
                });
            } else {
                validatedEmotion = emotion;
            }
        }

        // Call Tencent TextToSpeech API
        // Build parameters according to Tencent Cloud API format
        const params = {
            SdkAppId: SDK_APP_ID,
            Text: text,
            ...(model ? { Model: model } : {}), // 仅 Ex 音色传 Model，Turbo 音色由腾讯云自动选择
            Voice: {
                VoiceId: voiceId,
                Speed: validatedSpeed, // 支持动态语速
                Volume: validatedVolume, // 支持动态音量
                Pitch: validatedPitch, // 支持动态音高
                ...(validatedEmotion ? { Emotion: validatedEmotion } : {}) // 情感风格，仅 flow_01_ex 生效
            },
            AudioFormat: {
                // 由腾讯云直接生成所选格式；服务端只透传 Base64，不做本地音频转码。
                Format: validatedFormat,
                SampleRate: validatedSampleRate
            },
            ...(requestedLanguage ? { Language: requestedLanguage } : {}) // 未指定时由云端自动检测
        };

        logger.info({
            userId: req.user.id,
            email: req.user.email,
            voiceId,
            language: requestedLanguage || '(provider-auto)',
            format: validatedFormat,
            sampleRate: validatedSampleRate,
            speed: validatedSpeed,
            volume: validatedVolume,
            pitch: validatedPitch,
            emotion: validatedEmotion,
            providerAutoDetect: !requestedLanguage, // 是否由云端自动检测
            textLength: text.length
        }, `🎤 TTS Synthesize: ${voiceId} (${validatedFormat}/${validatedSampleRate}Hz, speed: ${validatedSpeed}, volume: ${validatedVolume}, emotion: ${validatedEmotion || 'none'}, ${text.length} chars)`);

        const response = await callTencentAPI(
            TTS_SERVICE,
            TTS_HOST,
            'TextToSpeech',
            TTS_REGION,
            TTS_VERSION,
            params,
            secretId,
            secretKey
        );

        res.json({
            code: 'success',
            message: 'TTS synthesis completed successfully',
            audio: response.Audio,
            audioFormat: validatedFormat,
            sampleRate: validatedSampleRate,
            requestId: response.RequestId,
            requestedLanguage: requestedLanguage || null, // 前端请求的语言（未指定为 null）
            providerAutoDetect: !requestedLanguage, // 是否由云服务商自动检测
            appliedParams: { // 返回实际使用的参数
                format: validatedFormat,
                sampleRate: validatedSampleRate,
                speed: validatedSpeed,
                volume: validatedVolume,
                pitch: validatedPitch,
                emotion: validatedEmotion || null
            },
            quota: req.quotaInfo // { daily, used, remaining }
        });
    } catch (error) {
        logger.error({
            userId: req.user?.id,
            email: req.user?.email,
            error: error.message,
            stack: error.stack
        }, '❌ TTS Synthesize failed');

        res.status(500).json({
            code: 'tts_failed',
            message: error.message
        });
    }
});

/**
 * POST /api/tts/synthesize-stream
 * SSE streaming TTS synthesis (100 points)
 *
 * Body: same as /synthesize
 */
router.post('/synthesize-stream', authenticate, requireQuota('tts-stream'), async (req, res) => {
    try {
        const {
            text,
            voiceId = 'v-female-R2s4N9qJ', // 默认音色：温柔姐姐
            language, // 可选语言参数
            model: requestedModel, // 可选 model 参数: flow_02_turbo | flow_01_ex
            emotion // 情感风格 (可选, 仅 flow_01_ex 模型生效): happy|sad|angry|fearful|disgusted|surprised|calm|fluent|whisper
        } = req.body;

        if (!text) {
            return res.status(400).json({
                code: 'missing_text',
                message: 'Missing required field: text'
            });
        }

        // Get Tencent Cloud credentials from environment
        const { secretId, secretKey } = getTencentCredentials();

        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // 已知系统音色必须使用音色库声明的模型，克隆音色可由前端显式指定。
        const VALID_MODELS = ['flow_02_turbo', 'flow_01_ex'];
        const voiceModel = await voiceLibraryManager.getModelForVoice(voiceId);
        const model = voiceModel || ((requestedModel && VALID_MODELS.includes(requestedModel)) ? requestedModel : '');

        // 语言处理：前端显式传入则透传；未传则不带 Language，交由云服务自行检测
        const requestedLanguage = (typeof language === 'string' && language.trim()) ? language.trim() : '';

        // emotion 参数校验：仅 flow_01_ex 模型生效，其他模型忽略
        const SUPPORTED_EMOTIONS_STREAM = ['happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'calm', 'fluent', 'whisper'];
        let validatedEmotion = null;
        if (emotion && typeof emotion === 'string' && emotion.trim()) {
            if (model !== 'flow_01_ex') {
                logger.warn(`[TTS Stream] emotion 参数仅 flow_01_ex 模型生效，当前 model=${model}，已忽略 emotion=${emotion}`);
            } else if (!SUPPORTED_EMOTIONS_STREAM.includes(emotion)) {
                return res.status(400).json({
                    code: 'invalid_emotion',
                    message: `emotion 取值无效: ${emotion}，支持: ${SUPPORTED_EMOTIONS_STREAM.join(', ')}`
                });
            } else {
                validatedEmotion = emotion;
            }
        }

        // Call Tencent TextToSpeechSSE API
        const params = {
            SdkAppId: SDK_APP_ID,
            Text: text,
            ...(model ? { Model: model } : {}), // 仅 Ex 音色传 Model
            Voice: {
                VoiceId: voiceId,
                ...(validatedEmotion ? { Emotion: validatedEmotion } : {}) // 情感风格，仅 flow_01_ex 生效
            },
            ...(requestedLanguage ? { Language: requestedLanguage } : {}) // 未指定时由云端自动检测
        };

        logger.info('[TTS Stream Debug] Request params:', JSON.stringify(params, null, 2));

        logger.info({
            userId: req.user.id,
            email: req.user.email,
            voiceId,
            language: requestedLanguage || '(provider-auto)',
            emotion: validatedEmotion,
            providerAutoDetect: !requestedLanguage,
            textLength: text.length
        }, `🎤 TTS Synthesize Stream: ${voiceId} (${requestedLanguage || 'provider-auto'}, emotion: ${validatedEmotion || 'none'}, ${text.length} chars)`);

        await callTencentAPIStream(
            TTS_SERVICE,
            TTS_HOST,
            'TextToSpeechSSE',
            TTS_REGION,
            TTS_VERSION,
            params,
            (chunk) => {
                // Forward SSE chunk to frontend
                res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            },
            secretId,
            secretKey
        );

        // Send final event with quota info
        // res.write(`data: ${JSON.stringify({
        //     Type: 'quota',
        //     quota: req.quotaInfo
        // })}\n\n`);

        res.end();
    } catch (error) {
        logger.error('[TTS Stream] Streaming failed:', error.message);

        if (!res.headersSent) {
            res.status(500).json({
                code: 'tts_stream_failed',
                message: error.message
            });
        } else {
            res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
            res.end();
        }
    }
});

module.exports = router;
