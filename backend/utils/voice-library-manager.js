const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const logger = require('./logger');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
const supabaseDb = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const CLONED_CACHE_TTL = 5 * 60 * 1000;
const TURBO_MODEL = 'flow_02_turbo';
const EX_MODEL = 'flow_01_ex';

const FALLBACK_VOICES = [
    { id: 'v-female-R2s4N9qJ', name: '温柔姐姐', language: 'zh', description: '优质女声' },
    { id: 'v-male-Bk7vD3xP', name: '威严霸总', language: 'zh', description: '优质男声' },
    { id: 'female-kefu-xiaomei', name: '小美', language: 'zh', description: '客服女声' }
];

class VoiceLibraryManager {
    constructor() {
        this.standardVoices = [];
        this.extendedVoices = [];
        this.standardVoiceIds = new Set();
        this.extendedVoiceIds = new Set();
        this.standardLanguageMap = {};
        this.extendedLanguageMap = {};
        this.clonedVoicesCache = new Map();
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            const standardPath = path.join(__dirname, '../data/voices.json');
            const extendedPath = path.join(__dirname, '../data/voices-flow-01-ex.json');
            const standardData = JSON.parse(fs.readFileSync(standardPath, 'utf8'));
            const extendedData = JSON.parse(fs.readFileSync(extendedPath, 'utf8'));
            this.standardLanguageMap = standardData.languageMap || {};
            this.extendedLanguageMap = extendedData.languageMap || {};
            this.standardVoices = (standardData.voices || []).map(voice => ({
                ...voice,
                model: voice.model || TURBO_MODEL,
                // Turbo 的 101 个音色同时可在 Ex 模型下使用。静态数据仍单独维护，
                // 这里只在读取时声明模型兼容性，避免复制数据。
                models: [TURBO_MODEL, EX_MODEL],
                provider: voice.provider || 'tencent'
            }));
            this.extendedVoices = (extendedData.voices || []).map(voice => ({
                ...voice,
                model: EX_MODEL,
                models: [EX_MODEL],
                provider: voice.provider || 'minimax'
            }));
            this.standardVoiceIds = new Set(this.standardVoices.map(v => v.id));
            this.extendedVoiceIds = new Set(this.extendedVoices.map(v => v.id));
            logger.info(`[VoiceLibraryManager] Loaded ${this.standardVoices.length} standard + ${this.extendedVoices.length} extended voices`);
        } catch (error) {
            logger.error('[VoiceLibraryManager] Failed to load voice libraries:', error.message);
        }
        this.initialized = true;
    }

    async getStandardVoices() {
        this.init();
        return {
            preset: [...this.standardVoices],
            cloned: [],
            languageMap: { ...this.standardLanguageMap },
            languageMaps: { flow_02_turbo: { ...this.standardLanguageMap } }
        };
    }

    async getAllVoices() {
        this.init();
        const exLanguageMap = this.mergeLanguageMaps(
            this.standardLanguageMap,
            this.extendedLanguageMap
        );
        return {
            preset: [...this.standardVoices, ...this.extendedVoices],
            cloned: [],
            languageMap: exLanguageMap,
            languageMaps: {
                flow_02_turbo: { ...this.standardLanguageMap },
                // Ex 展示自身 327 个音色和 Turbo 共享的 101 个音色，共 428 个。
                flow_01_ex: exLanguageMap
            }
        };
    }

    mergeLanguageMaps(...maps) {
        const merged = {};
        for (const map of maps) {
            for (const [code, item] of Object.entries(map || {})) {
                merged[code] = {
                    name: merged[code]?.name || item.name,
                    count: (merged[code]?.count || 0) + (Number(item.count) || 0)
                };
            }
        }
        return merged;
    }

    /**
     * 获取音色对应的 TTS 模型
     * 系统音色根据静态映射返回模型，克隆音色从数据库查询。
     */
    async getModelForVoice(voiceId, requestedModel = '') {
        this.init();

        if (this.extendedVoiceIds.has(voiceId)) return EX_MODEL;
        if (this.standardVoiceIds.has(voiceId)) {
            return requestedModel === EX_MODEL ? EX_MODEL : TURBO_MODEL;
        }

        // 检查缓存
        const now = Date.now();
        const cached = this.clonedVoicesCache.get(voiceId);
        if (cached && now - cached.timestamp < CLONED_CACHE_TTL) return cached.model;

        // 查数据库（克隆音色）
        if (supabaseDb) {
            try {
                const { data, error } = await supabaseDb
                    .from('cloned_voices')
                    .select('model')
                    .eq('voice_id', voiceId)
                    .eq('is_active', true)
                    .single();
                if (!error && data) {
                    const model = data.model || '';
                    this.clonedVoicesCache.set(voiceId, { model, timestamp: now });
                    return model;
                }
            } catch (error) {
                logger.error(`[VoiceLibraryManager] DB query failed for ${voiceId}:`, error);
            }
        }

        return '';
    }

    getFallbackVoices() {
        return FALLBACK_VOICES;
    }

    cleanupCache() {
        const now = Date.now();
        for (const [id, cached] of this.clonedVoicesCache.entries()) {
            if (now - cached.timestamp >= CLONED_CACHE_TTL) this.clonedVoicesCache.delete(id);
        }
    }
}

const voiceLibraryManager = new VoiceLibraryManager();
const cacheCleanupTimer = setInterval(
    () => voiceLibraryManager.cleanupCache(),
    10 * 60 * 1000
);
cacheCleanupTimer.unref?.();
module.exports = voiceLibraryManager;
