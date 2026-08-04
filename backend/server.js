const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const logger = require('./utils/logger');

const ttsRoutes = require('./routes/tts');
const voiceCloneRoutes = require('./routes/voice-clone');
const userRoutes = require('./routes/user');
const historyRoutes = require('./routes/history');

const PORT = parseInt(process.env.API_PORT) || 9000;
const HOST = process.env.API_HOST || '0.0.0.0';

const app = express();

// CORS
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (origin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/)) {
            return callback(null, true);
        }
        const allowed = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim());
        if (allowed.some(o => origin === o || origin.endsWith(o))) {
            return callback(null, true);
        }
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

// Static files
app.use('/app', express.static(path.join(__dirname, '../app')));

// Preserve Supabase auth query/hash parameters while moving root callbacks to the app.
const sendAppRedirect = (req, res) => {
    res.type('html').send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Redirecting...</title></head>
<body><script>
location.replace('/app/index.html' + location.search + location.hash);
</script><noscript><a href="/app/index.html">Open TTS Studio</a></noscript></body></html>`);
};
app.get('/', sendAppRedirect);
app.get('/auth/callback', sendAppRedirect);

// Body parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', port: PORT, timestamp: new Date().toISOString() });
});

// Public browser configuration. Never expose SUPABASE_SECRET_KEY here.
app.get('/api/config', (req, res) => {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || '';
    if (!supabaseUrl || !supabasePublishableKey) {
        return res.status(503).json({
            code: 'public_config_missing',
            message: 'Supabase public configuration is not available'
        });
    }
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    return res.json({
        supabaseUrl,
        supabasePublishableKey
    });
});

// Routes
app.use('/api/tts', ttsRoutes);
app.use('/api/voice', voiceCloneRoutes);
app.use('/api/user', userRoutes);
app.use('/api/history', historyRoutes);

// 404
app.use((req, res) => {
    res.status(404).json({ code: 'not_found', message: `Route ${req.method} ${req.path} not found` });
});

// Error handler
app.use((err, req, res, next) => {
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({ code: 'cors_error', message: 'Origin not allowed' });
    }
    logger.error({ error: err.message, path: req.path }, 'Unhandled Error');
    res.status(500).json({ code: 'internal_error', message: err.message });
});

app.listen(PORT, HOST, () => {
    logger.info({ port: PORT }, '🚀 FlowTTS Server started');
    logger.info(`📍 http://${HOST}:${PORT}/app/index.html`);
});
