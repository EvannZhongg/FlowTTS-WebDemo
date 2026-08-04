const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const logger = require('./utils/logger');
const app = require('./app');

const PORT = parseInt(process.env.API_PORT, 10) || 9000;
const HOST = process.env.API_HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
    logger.info({ port: PORT }, '🚀 FlowTTS Server started');
    logger.info(`📍 http://${HOST}:${PORT}/app/index.html`);
});
