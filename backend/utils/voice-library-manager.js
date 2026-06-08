const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const logger = require('./logger');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseDb = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const CLONED_CACHE_TTL = 5 * 60 * 1000;

const FALLBACK_VOICES = [
    { id: 'v-female-R2s4N9qJ', name: '温柔姐姐', language: 'zh', description: '优质女声' },
    { id: 'v-male-Bk7vD3xP', name: '威严霸总', language: 'zh', description: '优质男声' },
    { id: 'female-kefu-xiaomei', name: '小美', language: 'zh', description: '客服女声' }
];

class VoiceLibraryManager {
    constructor() {
        this.voices = [];
        this.voiceIds = new Set();
        this.clonedVoicesCache = new Map();
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            const filePath = path.join(__dirname, '../data/voices.json');
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            this.voices = data.voices || [];
            this.voiceIds = new Set(this.voices.map(v => v.id));
            logger.info(`[VoiceLibraryManager] Loaded ${this.voices.length} voices`);
        } catch (error) {
            logger.error('[VoiceLibraryManager] Failed to load voices.json:', error.message);
        }
        this.initialized = true;
    }

    async getStandardVoices() {
        this.init();
        return { preset: [...this.voices], cloned: [] };
    }

    async getAllVoices() {
        return this.getStandardVoices();
    }

    /**
     * 获取音色对应的 TTS 模型
     * 预设音色不传 Model（腾讯云自动选择），克隆音色从数据库查询
     */
    async getModelForVoice(voiceId) {
        this.init();

        if (this.voiceIds.has(voiceId)) return '';

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
