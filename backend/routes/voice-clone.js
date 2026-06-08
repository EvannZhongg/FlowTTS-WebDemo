/**
 * Voice Clone API Routes
 *
 * Handles voice cloning requests
 */

const express = require('express');
const router = express.Router();

const logger = require('../utils/logger');
const { callTencentAPI } = require('../utils/tencent-api');
const authenticate = require('../middleware/auth');
const { requireQuota } = require('../middleware/quota');
const { supabaseDb } = require('../utils/supabase');

// Voice Clone API configuration
const TTS_SERVICE = 'trtc';
const TTS_HOST = 'trtc.ai.tencentcloudapi.com';
const TTS_VERSION = '2019-07-22';
const TTS_REGION = process.env.TRTC_REGION || 'ap-beijing';
const SDK_APP_ID = process.env.TRTC_SDK_APP_ID || '';

/**
 * POST /api/voice/clone
 * Clone voice from audio sample (10 quota)
 *
 * Body:
 * {
 *   "audioData": "base64...",
 *   "voiceName": "My Voice",           // optional, 用户自定义名称
 *   "audioDuration": 8.5,              // optional, 音频时长（秒）
 *   "description": "Description"       // optional, 描述信息
 * }
 */
router.post('/clone', authenticate, requireQuota('voice-clone'), async (req, res) => {
    try {
        const {
            audioData,
            voiceName,
            audioDuration,
            description
        } = req.body;

        if (!audioData) {
            return res.status(400).json({
                code: 'missing_audio_data',
                message: 'Missing required field: audioData (base64 encoded audio)'
            });
        }

        // Get Tencent Cloud credentials from environment
        const secretId = process.env.TX_SECRET_ID;
        const secretKey = process.env.TX_SECRET_KEY;

        if (!secretId || !secretKey) {
            throw new Error('Tencent Cloud credentials not configured in .env file');
        }

        // Call Tencent VoiceClone API
        const params = {
            SdkAppId: parseInt(SDK_APP_ID),
            PromptAudio: audioData
        };

        if (voiceName) {
            params.VoiceName = voiceName;
        }

        logger.info({
            userId: req.user.id,
            email: req.user.email,
            audioDuration
        }, `🎙️ Voice Clone: (${audioDuration || '?'}s)`);

        const response = await callTencentAPI(
            TTS_SERVICE,
            TTS_HOST,
            'VoiceClone',
            TTS_REGION,
            TTS_VERSION,
            params,
            secretId,
            secretKey
        );

        // 保存克隆记录到数据库
        const { data: clonedVoice, error: dbError } = await supabaseDb
            .from('cloned_voices')
            .insert({
                user_id: req.user.id,
                voice_id: response.VoiceId,
                voice_name: voiceName || null,
                model: null, // 不指定 model，克隆音色由腾讯云自动选择
                description: description || null,
                audio_duration: audioDuration || null
            })
            .select()
            .single();

        if (dbError) {
            logger.error({
                userId: req.user.id,
                email: req.user.email,
                voiceId: response.VoiceId,
                error: dbError.message
            }, '❌ Voice Clone: Failed to save to DB');
            // 不阻断响应，克隆已成功
        } else {
            logger.info({
                userId: req.user.id,
                email: req.user.email,
                voiceId: response.VoiceId
            }, `✅ Voice Clone: Saved to DB (${response.VoiceId})`);
        }

        res.json({
            code: 'success',
            message: 'Voice cloned successfully',
            voiceId: response.VoiceId,
            requestId: response.RequestId,
            quota: req.quotaInfo, // { daily, used, remaining }
            clonedVoice: clonedVoice || null
        });
    } catch (error) {
        logger.error({
            userId: req.user?.id,
            email: req.user?.email,
            error: error.message,
            stack: error.stack
        }, '❌ Voice Clone failed');

        // 失败时回滚配额（如果有 rollback 函数）
        if (req.quotaRollback) {
            await req.quotaRollback();
        }

        res.status(500).json({
            code: 'voice_clone_failed',
            message: error.message
        });
    }
});

/**
 * GET /api/voice/list
 * Get user's cloned voices list
 */
router.get('/list', authenticate, async (req, res) => {
    try {
        const { data, error } = await supabaseDb
            .from('cloned_voices')
            .select('*')
            .eq('user_id', req.user.id)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        logger.info({ userId: req.user.id, count: data.length }, '[Voice Clone] List voices');

        res.json({
            code: 'success',
            voices: data
        });
    } catch (error) {
        logger.error({ error: error.message }, '[Voice Clone] List failed');

        res.status(500).json({
            code: 'list_failed',
            message: error.message
        });
    }
});

/**
 * DELETE /api/voice/:voiceId
 * Soft delete a cloned voice
 */
router.delete('/:voiceId', authenticate, async (req, res) => {
    try {
        const { voiceId } = req.params;

        const { data, error } = await supabaseDb
            .from('cloned_voices')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('user_id', req.user.id)
            .eq('voice_id', voiceId)
            .select()
            .single();

        if (error) {
            throw error;
        }

        if (!data) {
            return res.status(404).json({
                code: 'not_found',
                message: 'Voice not found or already deleted'
            });
        }

        logger.info({ userId: req.user.id, voiceId }, '[Voice Clone] Deleted voice');

        res.json({
            code: 'success',
            message: 'Voice deleted successfully',
            data
        });
    } catch (error) {
        logger.error({ error: error.message }, '[Voice Clone] Delete failed');

        res.status(500).json({
            code: 'delete_failed',
            message: error.message
        });
    }
});

/**
 * POST /api/voice/increment-usage
 * Increment usage count for a cloned voice
 *
 * Body:
 * {
 *   "voiceId": "voice-id-here"
 * }
 */
router.post('/increment-usage', authenticate, async (req, res) => {
    try {
        const { voiceId } = req.body;

        if (!voiceId) {
            return res.status(400).json({
                code: 'missing_voice_id',
                message: 'Missing required field: voiceId'
            });
        }

        // 调用 RPC 函数增加使用次数
        const { data, error } = await supabaseDb
            .rpc('increment_voice_usage', {
                voice_id_param: voiceId,
                user_id_param: req.user.id
            });

        if (error) {
            throw error;
        }

        logger.info({ userId: req.user.id, voiceId }, '[Voice Clone] Usage incremented');

        res.json({
            code: 'success',
            message: 'Usage count incremented',
            data
        });
    } catch (error) {
        logger.error({ error: error.message }, '[Voice Clone] Increment usage failed');

        res.status(500).json({
            code: 'increment_usage_failed',
            message: error.message
        });
    }
});

module.exports = router;
