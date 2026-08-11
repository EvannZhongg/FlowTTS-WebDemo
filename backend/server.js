const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const logger = require('./utils/logger');
const app = require('./app');
const { pruneExpiredHistoryAudio } = require('./utils/history-store');

const PORT = parseInt(process.env.API_PORT, 10) || 9000;
const HOST = process.env.API_HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
    logger.info({ port: PORT }, '🚀 FlowTTS Server started');
    logger.info(`📍 http://${HOST}:${PORT}/app/index.html`);
});

// On Vercel the entrypoint is the root server.js (serverless, no long-lived
// process), so this timer only runs on the local long-running server. Cleanup
// in production is driven by the Vercel Cron in vercel.json.
const historyCleanupTimer = setInterval(() => {
    pruneExpiredHistoryAudio()
        .then((result) => logger.info(result, 'History cleanup done'))
        .catch((error) => logger.error({ error: error.message }, 'History cleanup failed'));
}, 12 * 60 * 60 * 1000);
historyCleanupTimer.unref?.();
