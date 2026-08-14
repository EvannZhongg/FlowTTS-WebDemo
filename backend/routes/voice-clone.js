/**
 * Voice Clone API Routes
 *
 * Handles voice cloning requests
 */

const express = require('express');
const crypto = require('crypto');
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
const MIN_CLONE_AUDIO_SECONDS = 6;
const MAX_CLONE_AUDIO_SECONDS = 180;
const MAX_CLONE_AUDIO_BYTES = 7 * 1024 * 1024;
const CLONE_AUDIO_BUCKET = process.env.SUPABASE_HISTORY_BUCKET || 'tts-history-audio';
const VALID_CLONE_MODELS = ['flow_02_turbo', 'flow_01_ex'];
const VALID_CLONE_AUDIO_MIME_TYPES = new Set([
    'audio/wav',
    'audio/x-wav',
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a'
]);

async function insertClonedVoice(record) {
    const insert = (row) => supabaseDb
        .from('cloned_voices')
        .insert(row)
        .select()
        .single();

    let result = await insert(record);
    if (result.error?.code === '23514' && result.error.message?.includes('cloned_voices_model_check')) {
        logger.warn({
            voiceId: record.voice_id,
            requestedModel: record.model
        }, '[Voice Clone] Legacy cloned_voices model constraint detected; retrying with model=null');
        result = await insert({ ...record, model: null });
    }
    return result;
}

function validateCloneAudio(req, res, next) {
    const { audioData, audioPath, audioDuration } = req.body || {};
    if (!audioData && !audioPath) {
        return res.status(400).json({
            code: 'missing_audio_data',
            message: 'Missing required field: audioData or audioPath'
        });
    }

    const duration = Number(audioDuration);
    if (!Number.isFinite(duration)
        || duration < MIN_CLONE_AUDIO_SECONDS
        || duration > MAX_CLONE_AUDIO_SECONDS) {
        return res.status(400).json({
            code: 'invalid_audio_duration',
            message: `Audio duration must be between ${MIN_CLONE_AUDIO_SECONDS} and ${MAX_CLONE_AUDIO_SECONDS} seconds`
        });
    }

    req.cloneAudioDuration = duration;
    next();
}

async function ensureCloneAudioBucket() {
    const { data: buckets, error: listError } = await supabaseDb.storage.listBuckets();
    if (listError) throw new Error(`Failed to list Storage buckets: ${listError.message}`);
    if (buckets?.some((bucket) => bucket.id === CLONE_AUDIO_BUCKET)) return;

    const { error } = await supabaseDb.storage.createBucket(CLONE_AUDIO_BUCKET, {
        public: false,
        fileSizeLimit: MAX_CLONE_AUDIO_BYTES,
        allowedMimeTypes: [...VALID_CLONE_AUDIO_MIME_TYPES, 'application/json']
    });
    if (error && !String(error.message).toLowerCase().includes('already exists')) {
        throw new Error(`Failed to create clone audio bucket: ${error.message}`);
    }
}

function cloneAudioPathForUser(userId) {
    return `${userId}/clone-prompts/${Date.now()}-${crypto.randomUUID()}.wav`;
}

function isOwnedCloneAudioPath(userId, audioPath) {
    return typeof audioPath === 'string'
        && audioPath.startsWith(`${userId}/clone-prompts/`)
        && !audioPath.includes('..');
}

async function resolveCloneAudio(req, res, next) {
    try {
        if (req.body.audioData) {
            req.cloneAudioData = req.body.audioData;
            return next();
        }

        const audioPath = req.body.audioPath;
        if (!isOwnedCloneAudioPath(req.user.id, audioPath)) {
            return res.status(400).json({
                code: 'invalid_audio_path',
                message: 'Invalid or unauthorized clone audio path'
            });
        }

        const { data, error } = await supabaseDb.storage
            .from(CLONE_AUDIO_BUCKET)
            .download(audioPath);
        if (error) throw new Error(`Failed to download clone audio: ${error.message}`);

        const buffer = Buffer.from(await data.arrayBuffer());
        if (!buffer.length || buffer.length > MAX_CLONE_AUDIO_BYTES) {
            await removeUploadedCloneAudio(audioPath);
            return res.status(400).json({
                code: 'invalid_audio_size',
                message: `Clone audio must be between 1 byte and ${MAX_CLONE_AUDIO_BYTES} bytes`
            });
        }

        req.cloneAudioData = buffer.toString('base64');
        req.cloneAudioPath = audioPath;
        req.cleanupRequestResource = async () => {
            if (!req.cloneAudioPath) return;
            const pathToRemove = req.cloneAudioPath;
            req.cloneAudioPath = null;
            await removeUploadedCloneAudio(pathToRemove);
        };
        next();
    } catch (error) {
        if (isOwnedCloneAudioPath(req.user?.id, req.body?.audioPath)) {
            await removeUploadedCloneAudio(req.body.audioPath);
        }
        logger.error({ userId: req.user?.id, error: error.message }, '[Voice Clone] Audio resolution failed');
        res.status(500).json({
            code: 'clone_audio_resolution_failed',
            message: error.message
        });
    }
}

async function removeUploadedCloneAudio(audioPath) {
    if (!audioPath) return;
    const { error } = await supabaseDb.storage.from(CLONE_AUDIO_BUCKET).remove([audioPath]);
    if (error) {
        logger.warn({ audioPath, error: error.message }, '[Voice Clone] Failed to remove uploaded prompt');
    }
}

/**
 * POST /api/voice/clone-upload-url
 * Create a short-lived signed URL so long clone samples bypass the serverless
 * request body limit while remaining private and scoped to the current user.
 */
router.post('/clone-upload-url', authenticate, async (req, res) => {
    try {
        const size = Number(req.body?.size);
        const mimeType = String(req.body?.mimeType || '').toLowerCase();
        if (!Number.isFinite(size) || size <= 0 || size > MAX_CLONE_AUDIO_BYTES) {
            return res.status(400).json({
                code: 'invalid_audio_size',
                message: `Clone audio must be no larger than ${MAX_CLONE_AUDIO_BYTES} bytes`
            });
        }
        if (!VALID_CLONE_AUDIO_MIME_TYPES.has(mimeType)) {
            return res.status(400).json({
                code: 'invalid_audio_type',
                message: 'Clone audio must be WAV, MP3, or M4A'
            });
        }

        await ensureCloneAudioBucket();
        const audioPath = cloneAudioPathForUser(req.user.id);
        const { data, error } = await supabaseDb.storage
            .from(CLONE_AUDIO_BUCKET)
            .createSignedUploadUrl(audioPath);
        if (error) throw new Error(`Failed to create signed upload URL: ${error.message}`);

        res.json({
            code: 'success',
            bucket: CLONE_AUDIO_BUCKET,
            audioPath,
            token: data.token
        });
    } catch (error) {
        logger.error({ userId: req.user?.id, error: error.message }, '[Voice Clone] Upload URL failed');
        res.status(500).json({
            code: 'clone_upload_url_failed',
            message: error.message
        });
    }
});

/**
 * POST /api/voice/clone
 * Clone voice from a 6–180 second audio sample (50 quota)
 *
 * Body:
 * {
 *   "audioPath": "<user-id>/clone-prompts/...", // recommended; returned by /clone-upload-url
 *   "audioData": "base64...",                   // legacy fallback for short payloads
 *   "voiceName": "My Voice",           // optional, 用户自定义名称
 *   "audioDuration": 8.5,              // required, 6–180 秒
 *   "description": "Description"       // optional, 描述信息
 * }
 */
router.post('/clone', authenticate, validateCloneAudio, resolveCloneAudio, requireQuota('voice-clone'), async (req, res) => {
    try {
        const {
            voiceName,
            description,
            model // 可选: flow_02_turbo | flow_01_ex
        } = req.body;
        const validatedAudioDuration = req.cloneAudioDuration;

        // Get Tencent Cloud credentials from environment
        const secretId = process.env.TX_SECRET_ID;
        const secretKey = process.env.TX_SECRET_KEY;

        if (!secretId || !secretKey) {
            throw new Error('Tencent Cloud credentials not configured in .env file');
        }

        // Call Tencent VoiceClone API
        const resolvedModel = (model && VALID_CLONE_MODELS.includes(model)) ? model : null;
        logger.info({ userId: req.user.id, model, resolvedModel }, '🎙️ Voice Clone model');
        const params = {
            SdkAppId: parseInt(SDK_APP_ID),
            PromptAudio: req.cloneAudioData,
            ...(resolvedModel ? { Model: resolvedModel } : {})
        };

        if (voiceName) {
            params.VoiceName = voiceName;
        }

        logger.info({
            userId: req.user.id,
            email: req.user.email,
            audioDuration: validatedAudioDuration
        }, `🎙️ Voice Clone: (${validatedAudioDuration}s)`);

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
        const { data: clonedVoice, error: dbError } = await insertClonedVoice({
            user_id: req.user.id,
            voice_id: response.VoiceId,
            voice_name: voiceName || null,
            model: resolvedModel,
            description: description || null,
            audio_duration: validatedAudioDuration
        });

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
    } finally {
        await req.cleanupRequestResource?.().catch((cleanupError) => {
            logger.warn({ error: cleanupError.message }, '[Voice Clone] Request cleanup failed');
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
