/**
 * Supabase Storage-backed history store.
 *
 * Each user's files are isolated under:
 *   <userId>/metadata/<timestamp>-<recordId>.json
 *   <userId>/audio/<recordId>/download.<ext>
 *   <userId>/audio/<recordId>/playback.<ext>
 *
 * The bucket is private. The backend uses the service role and only returns
 * short-lived signed URLs after the caller's JWT has been verified.
 */

const crypto = require('crypto');
const { supabaseDb, validateUserId } = require('./supabase');

const HISTORY_BUCKET = process.env.SUPABASE_HISTORY_BUCKET || 'tts-history-audio';
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const VALID_TYPES = new Set(['tts', 'streaming', 'clone-create', 'clone-tts']);
const VALID_FORMATS = new Set(['pcm', 'wav', 'mp3', 'opus']);

const FORMAT_MIME_TYPES = {
    pcm: 'application/octet-stream',
    wav: 'audio/wav',
    mp3: 'audio/mpeg',
    opus: 'audio/ogg'
};

function sanitizeText(value, maxLength = 4000) {
    return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

function sanitizeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function normalizeFormat(value, mimeType = '') {
    const format = String(value || '').toLowerCase();
    if (VALID_FORMATS.has(format)) return format;
    const mime = String(mimeType || '').toLowerCase();
    if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
    if (mime.includes('ogg') || mime.includes('opus')) return 'opus';
    if (mime.includes('wav')) return 'wav';
    return 'pcm';
}

function normalizeMimeType(value, format) {
    const mimeType = String(value || '').toLowerCase();
    const allowed = new Set([
        'audio/wav',
        'audio/x-wav',
        'audio/mpeg',
        'audio/mp3',
        'audio/ogg',
        'audio/opus',
        'application/ogg',
        'application/octet-stream',
        'audio/l16'
    ]);
    return allowed.has(mimeType) ? mimeType : FORMAT_MIME_TYPES[format];
}

function decodeAudioPayload(payload, fallbackFormat) {
    if (!payload?.data) return null;
    const format = normalizeFormat(payload.format || fallbackFormat, payload.mimeType);
    const buffer = Buffer.from(payload.data, 'base64');
    if (!buffer.length) return null;
    if (buffer.length > MAX_AUDIO_BYTES) {
        throw new Error(`History audio exceeds ${MAX_AUDIO_BYTES / 1024 / 1024} MB limit`);
    }
    return {
        buffer,
        format,
        mimeType: normalizeMimeType(payload.mimeType, format),
        extension: format
    };
}

async function ensureHistoryBucket() {
    const { data: buckets, error: listError } = await supabaseDb.storage.listBuckets();
    if (listError) throw new Error(`Failed to list history buckets: ${listError.message}`);
    if (buckets?.some((bucket) => bucket.id === HISTORY_BUCKET)) return;

    const { error } = await supabaseDb.storage.createBucket(HISTORY_BUCKET, {
        public: false,
        fileSizeLimit: MAX_AUDIO_BYTES,
        allowedMimeTypes: [
            'audio/wav',
            'audio/x-wav',
            'audio/mpeg',
            'audio/mp3',
            'audio/ogg',
            'audio/opus',
            'application/ogg',
            'application/octet-stream',
            'audio/l16',
            'application/json'
        ]
    });
    if (error && !String(error.message).toLowerCase().includes('already exists')) {
        throw new Error(`Failed to create history bucket: ${error.message}`);
    }
}

async function uploadFile(path, body, contentType) {
    const { error } = await supabaseDb.storage
        .from(HISTORY_BUCKET)
        .upload(path, body, { contentType, upsert: false, cacheControl: '3600' });
    if (error) throw new Error(`Failed to upload history file: ${error.message}`);
}

async function removeFiles(paths) {
    const filtered = [...new Set(paths.filter(Boolean))];
    if (!filtered.length) return;
    const { error } = await supabaseDb.storage.from(HISTORY_BUCKET).remove(filtered);
    if (error) throw new Error(`Failed to remove history files: ${error.message}`);
}

async function createHistoryItem(userId, input) {
    validateUserId(userId);
    await ensureHistoryBucket();

    const type = VALID_TYPES.has(input.type) ? input.type : 'tts';
    const recordId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const createdAtMs = Date.parse(createdAt);
    const format = normalizeFormat(input.format, input.audio?.mimeType);
    const audio = decodeAudioPayload(input.audio, format);
    const playbackAudio = decodeAudioPayload(input.playbackAudio, audio?.format || format);
    const uploadedPaths = [];

    try {
        let audioPath = null;
        let playbackPath = null;

        if (audio) {
            audioPath = `${userId}/audio/${recordId}/download.${audio.extension}`;
            await uploadFile(audioPath, audio.buffer, audio.mimeType);
            uploadedPaths.push(audioPath);
        }

        if (playbackAudio) {
            playbackPath = `${userId}/audio/${recordId}/playback.${playbackAudio.extension}`;
            await uploadFile(playbackPath, playbackAudio.buffer, playbackAudio.mimeType);
            uploadedPaths.push(playbackPath);
        } else {
            playbackPath = audioPath;
        }

        const metadataPath = `${userId}/metadata/${createdAtMs}-${recordId}.json`;
        const metadata = {
            id: recordId,
            userId,
            type,
            text: sanitizeText(input.text),
            voiceName: sanitizeText(input.voiceName, 200),
            voiceId: sanitizeText(input.voiceId || input.voice, 200),
            language: sanitizeText(input.language, 50),
            model: sanitizeText(input.model, 100),
            processingTime: sanitizeNumber(input.processingTime),
            sampleRate: sanitizeNumber(input.sampleRate, 24000),
            bitrate: sanitizeNumber(input.bitrate),
            format: audio?.format || format,
            size: sanitizeNumber(input.size, audio?.buffer.length || 0),
            createdAt,
            audioPath,
            playbackPath,
            audioMimeType: audio?.mimeType || null,
            playbackMimeType: playbackAudio?.mimeType || audio?.mimeType || null,
            metadataPath
        };

        await uploadFile(
            metadataPath,
            Buffer.from(JSON.stringify(metadata)),
            'application/json'
        );
        uploadedPaths.push(metadataPath);

        return addSignedUrls(metadata);
    } catch (error) {
        await removeFiles(uploadedPaths).catch(() => {});
        throw error;
    }
}

async function listMetadataFiles(userId) {
    const files = [];
    let offset = 0;
    const limit = 100;

    while (true) {
        const { data, error } = await supabaseDb.storage
            .from(HISTORY_BUCKET)
            .list(`${userId}/metadata`, {
                limit,
                offset,
                sortBy: { column: 'name', order: 'desc' }
            });
        if (error) throw new Error(`Failed to list history: ${error.message}`);
        const batch = (data || []).filter((file) => file.name.endsWith('.json'));
        files.push(...batch);
        if ((data || []).length < limit) break;
        offset += limit;
    }

    return files;
}

async function downloadMetadata(path) {
    const { data, error } = await supabaseDb.storage.from(HISTORY_BUCKET).download(path);
    if (error) throw new Error(`Failed to read history metadata: ${error.message}`);
    return JSON.parse(await data.text());
}

async function addSignedUrls(item) {
    const paths = [...new Set([item.playbackPath, item.audioPath].filter(Boolean))];
    if (!paths.length) return { ...item, audioUrl: null, downloadUrl: null };

    const { data, error } = await supabaseDb.storage
        .from(HISTORY_BUCKET)
        .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    if (error) throw new Error(`Failed to sign history audio URLs: ${error.message}`);

    const urlByPath = new Map((data || []).map((entry) => [entry.path, entry.signedUrl]));
    return {
        ...item,
        audioUrl: item.playbackPath ? urlByPath.get(item.playbackPath) || null : null,
        downloadUrl: item.audioPath ? urlByPath.get(item.audioPath) || null : null
    };
}

async function listHistoryItems(userId) {
    validateUserId(userId);
    await ensureHistoryBucket();
    const files = await listMetadataFiles(userId);
    const items = await Promise.all(files.map(async (file) => {
        const path = `${userId}/metadata/${file.name}`;
        try {
            const metadata = await downloadMetadata(path);
            if (metadata.userId !== userId) return null;
            return addSignedUrls(metadata);
        } catch (_) {
            return null;
        }
    }));

    return items
        .filter(Boolean)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function findHistoryItem(userId, recordId) {
    const files = await listMetadataFiles(userId);
    const file = files.find((entry) => entry.name.endsWith(`-${recordId}.json`));
    if (!file) return null;
    const metadata = await downloadMetadata(`${userId}/metadata/${file.name}`);
    return metadata.userId === userId ? metadata : null;
}

async function downloadHistoryAudio(userId, recordId) {
    validateUserId(userId);
    const metadata = await findHistoryItem(userId, recordId);
    if (!metadata?.audioPath) return null;
    const { data, error } = await supabaseDb.storage.from(HISTORY_BUCKET).download(metadata.audioPath);
    if (error) throw new Error(`Failed to download history audio: ${error.message}`);
    return {
        metadata,
        buffer: Buffer.from(await data.arrayBuffer()),
        contentType: metadata.audioMimeType || FORMAT_MIME_TYPES[metadata.format] || 'application/octet-stream'
    };
}

async function deleteHistoryItem(userId, recordId) {
    validateUserId(userId);
    const metadata = await findHistoryItem(userId, recordId);
    if (!metadata) return false;
    await removeFiles([metadata.audioPath, metadata.playbackPath, metadata.metadataPath]);
    return true;
}

async function clearHistoryItems(userId) {
    validateUserId(userId);
    const files = await listMetadataFiles(userId);
    const metadataItems = await Promise.all(files.map((file) => (
        downloadMetadata(`${userId}/metadata/${file.name}`).catch(() => null)
    )));
    const paths = [];
    metadataItems.filter(Boolean).forEach((item) => {
        if (item.userId !== userId) return;
        paths.push(item.audioPath, item.playbackPath, item.metadataPath);
    });
    await removeFiles(paths);
    return metadataItems.filter((item) => item?.userId === userId).length;
}

module.exports = {
    HISTORY_BUCKET,
    ensureHistoryBucket,
    createHistoryItem,
    listHistoryItems,
    downloadHistoryAudio,
    deleteHistoryItem,
    clearHistoryItems
};
