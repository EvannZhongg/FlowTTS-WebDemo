/**
 * Quota Middleware
 *
 * Checks and deducts user quota before API calls
 */

const logger = require('../utils/logger');
const { checkQuota, updateQuota } = require('../utils/supabase');

// Quota costs for different operations
const QUOTA_COSTS = {
    // TTS 体验 Demo 产品规则：普通/流式合成每次 100 点，声音克隆每次 50 点。
    'tts-synthesize': 100,
    'tts-stream': 100,
    'voice-clone-audition': 50,
    'llm-chat': 1,
    'llm-voice-match': 1, // LLM 音色匹配消耗 1 配额
    'llm-voice-select': 1, // LLM 音色智能选择消耗 1 配额
    'llm-generate-dialogue': 2, // LLM 生成对话+自动匹配音色消耗 2 配额
    'translate-text': 5, // 文本翻译消耗 5 配额
    'hunyuan-image': 5,
    'aihubmix-image': 5,
    'voice-clone': 50, // 声音克隆消耗 50 配额
    'voice-isolator': 3, // 声音分离/降噪消耗 3 配额
    'interpreter-start': 10, // 同声传译消耗 10 配额
    'transcription-start': 5, // 纯文本转录消耗 5 配额
    'conversation-start': 3, // AI 对话消耗 3 配额
    'asr-sentence': 1, // 一句话识别消耗 1 配额
    'asr-file': 1, // 录音文件识别消耗 1 配额
    'asr-flash': 1, // 录音文件识别极速版消耗 1 配额
    'asr-query': 0, // 查询识别结果不消耗配额
    'asr-realtime': 5, // 实时语音识别消耗 5 配额 (WebSocket连接)
    'meeting-summary': 10, // 会议总结消耗 10 配额
    'vision-analyze': 5, // 视觉分析消耗 5 配额
    'video-download': 5, // 视频下载基础配额（<10min 视频）
    'video-download-medium': 10, // 视频下载中等配额（10-60min）
    'video-download-long': 20, // 视频下载长视频配额（>60min）
    'video-download-audio': 3, // 仅下载音频消耗 3 配额
    'video-download-subtitle': 1 // 仅下载字幕消耗 1 配额
};

/**
 * Create quota middleware with specific cost
 * @param {string} operation - Operation name (key in QUOTA_COSTS)
 * @returns {Function} Express middleware
 */
function requireQuota(operation) {
    return async (req, res, next) => {
        try {
            const resolvedOperation = typeof operation === 'function' ? operation(req) : operation;
            const cost = QUOTA_COSTS[resolvedOperation];
            if (cost === undefined) {
                throw new Error(`Unknown operation: ${resolvedOperation}`);
            }
            const userId = req.user.id;

            // Check if user has enough quota
            const { hasQuota, remaining, dailyQuota, usedQuota, subscriptionTier } = await checkQuota(userId, cost);

            if (!hasQuota) {
                logger.warn({ userId, email: req.user.email, remaining, dailyQuota, cost }, 'Insufficient credits');
                return res.status(429).json({
                    code: 'quota_exceeded',
                    message: `Insufficient credits. You have ${remaining} credits remaining, but this operation requires ${cost} credits.`
                });
            }

            // Deduct quota BEFORE calling API (avoids race conditions)
            await updateQuota(userId, cost);

            // Attach quota info to request (for success response)
            req.quotaCost = cost;
            req.quotaInfo = {
                daily: dailyQuota,
                used: usedQuota + cost,
                remaining: remaining - cost,
                tier: subscriptionTier // Add subscription tier
            };

            // Set quota headers for immediate frontend update
            res.setHeader('X-Quota-Daily', dailyQuota);
            res.setHeader('X-Quota-Used', usedQuota + cost);
            res.setHeader('X-Quota-Remaining', remaining - cost);
            res.setHeader('X-Quota-Cost', cost);

            // Monkey-patch res.json to automatically add quota field
            const originalJson = res.json.bind(res);
            res.json = function (obj) {
                // Only add quota if not already present and no error occurred
                if (obj && obj.code !== 'error' && obj.code !== 'internal_error' && req.quotaInfo) {
                    obj.quota = req.quotaInfo;
                }
                return originalJson(obj);
            };

            // Also patch res.write for SSE streams
            const originalWrite = res.write.bind(res);
            res.write = function (chunk) {
                return originalWrite(chunk);
            };

            logger.info({ userId, email: req.user.email, cost, remaining: remaining - cost }, 'Quota used');

            next();
        } catch (error) {
            logger.error({ error: error.message }, 'Quota check failed');
            return res.status(500).json({
                code: 'internal_error',
                message: 'Failed to check credits: ' + error.message
            });
        }
    };
}

/**
 * Check and deduct quota (for WebSocket and non-Express contexts)
 * @param {string} userId - User ID
 * @param {string} operation - Operation name
 * @param {number} customCost - Optional custom cost (overrides QUOTA_COSTS)
 * @returns {Promise<Object>} { success: boolean, quotaInfo: {...} }
 */
async function checkAndDeductQuota(userId, operation, customCost = null) {
    try {
        const cost = customCost !== null ? customCost : QUOTA_COSTS[operation];

        if (cost === undefined && customCost === null) {
            throw new Error(`Unknown operation: ${operation}`);
        }

        // Bypass quota check for test user
        if (userId === 'test-user-123') {
            logger.info({ userId }, 'Test user quota bypass');
            return {
                success: true,
                quotaInfo: { daily: 9999, used: 0, remaining: 9999, tier: 'test' }
            };
        }

        // Check if user has enough quota
        const { hasQuota, remaining, dailyQuota, usedQuota, subscriptionTier } = await checkQuota(userId, cost);

        if (!hasQuota) {
            logger.warn({ userId, remaining, dailyQuota, cost }, 'Insufficient credits');
            return {
                success: false,
                error: `Insufficient credits. ${remaining} credits remaining, ${cost} credits required.`,
                quotaInfo: { daily: dailyQuota, used: usedQuota, remaining, tier: subscriptionTier }
            };
        }

        // Deduct quota
        await updateQuota(userId, cost);

        const quotaInfo = {
            daily: dailyQuota,
            used: usedQuota + cost,
            remaining: remaining - cost,
            tier: subscriptionTier
        };

        logger.info({ userId, cost, remaining: remaining - cost }, 'Quota deducted');

        return {
            success: true,
            quotaInfo
        };
    } catch (error) {
        logger.error({ userId, operation, error: error.message }, 'Quota check failed');
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    requireQuota,
    checkAndDeductQuota,
    QUOTA_COSTS
};
