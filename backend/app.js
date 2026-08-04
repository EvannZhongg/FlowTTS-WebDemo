const express = require('express');
const cors = require('cors');
const path = require('path');
const logger = require('./utils/logger');

const ttsRoutes = require('./routes/tts');
const voiceCloneRoutes = require('./routes/voice-clone');
const userRoutes = require('./routes/user');
const historyRoutes = require('./routes/history');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

const parseAllowedOrigins = () => (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

const isAllowedOrigin = (origin) => {
    if (!origin) return true;

    let url;
    try {
        url = new URL(origin);
    } catch (_) {
        return false;
    }

    if (['localhost', '127.0.0.1'].includes(url.hostname)) return true;

    // Browser calls are same-origin in production. Trust the current Vercel host
    // so preview deployments work without adding every generated hostname.
    const vercelHost = process.env.VERCEL_URL;
    if (vercelHost && url.hostname === vercelHost) return true;

    return parseAllowedOrigins().some((allowedOrigin) => {
        try {
            return url.origin === new URL(allowedOrigin).origin;
        } catch (_) {
            return false;
        }
    });
};

app.use(cors({
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

// Keep request bodies below Vercel's buffered request limit. The current
// 6-30 second, 16 kHz mono clone payload remains comfortably below this cap.
app.use(express.json({ limit: '4.3mb' }));
app.use(express.urlencoded({ extended: true, limit: '4.3mb' }));

// Used by the local long-running server. Vercel serves public/** directly and
// excludes these files from the function bundle.
if (!process.env.VERCEL) {
    app.use('/app', express.static(path.join(__dirname, '../public/app')));
}

const sendAppRedirect = (req, res) => {
    res.type('html').send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Redirecting...</title></head>
<body><script>
location.replace('/app/index.html' + location.search + location.hash);
</script><noscript><a href="/app/index.html">Open TTS Studio</a></noscript></body></html>`);
};

app.get('/', sendAppRedirect);
app.get('/auth/callback', sendAppRedirect);

app.get('/health', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
        status: 'ok',
        runtime: process.env.VERCEL ? 'vercel' : 'node',
        timestamp: new Date().toISOString()
    });
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

app.use('/api/tts', ttsRoutes);
app.use('/api/voice', voiceCloneRoutes);
app.use('/api/user', userRoutes);
app.use('/api/history', historyRoutes);

app.use((req, res) => {
    res.status(404).json({
        code: 'not_found',
        message: `Route ${req.method} ${req.path} not found`
    });
});

app.use((err, req, res, next) => {
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({ code: 'cors_error', message: 'Origin not allowed' });
    }

    if (err.type === 'entity.too.large') {
        return res.status(413).json({
            code: 'payload_too_large',
            message: 'Request payload is too large'
        });
    }

    logger.error({ error: err.message, path: req.path }, 'Unhandled Error');
    return res.status(500).json({ code: 'internal_error', message: err.message });
});

module.exports = app;
