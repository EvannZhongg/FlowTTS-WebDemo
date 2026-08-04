const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const logger = require('./logger');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
const supabaseDb = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const CLONED_CACHE_TTL = 5 * 60 * 1000;

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
                model: voice.model || 'flow_02_turbo',
                provider: voice.provider || 'tencent'
            }));
            this.extendedVoices = (extendedData.voices || []).map(voice => ({
                ...voice,
                model: 'flow_01_ex',
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
        const languageMap = {};
        for (const [code, item] of Object.entries(this.standardLanguageMap)) {
            languageMap[code] = { name: item.name, count: item.count };
        }
        for (const [code, item] of Object.entries(this.extendedLanguageMap)) {
            languageMap[code] = {
                name: languageMap[code]?.name || item.name,
                count: (languageMap[code]?.count || 0) + item.count
            };
        }
        return {
            preset: [...this.standardVoices, ...this.extendedVoices],
            cloned: [],
            languageMap,
            languageMaps: {
                flow_02_turbo: { ...this.standardLanguageMap },
                flow_01_ex: { ...this.extendedLanguageMap }
            }
        };
    }

    /**
     * 获取音色对应的 TTS 模型
     * 系统音色根据静态映射返回模型，克隆音色从数据库查询。
     */
    async getModelForVoice(voiceId) {
        this.init();

        if (this.extendedVoiceIds.has(voiceId)) return 'flow_01_ex';
        if (this.standardVoiceIds.has(voiceId)) return 'flow_02_turbo';

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
setInterval(() => voiceLibraryManager.cleanupCache(), 10 * 60 * 1000);
module.exports = voiceLibraryManager;
