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

// Body parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', port: PORT, timestamp: new Date().toISOString() });
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
