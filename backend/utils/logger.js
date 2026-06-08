const pino = require('pino');

const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    ...(isProduction
        ? {
            formatters: { level: (label) => ({ level: label }) },
            timestamp: pino.stdTimeFunctions.isoTime
        }
        : {
            transport: {
                target: 'pino-pretty',
                options: { colorize: true, translateTime: 'yyyy-mm-dd HH:MM:ss', ignore: 'pid,hostname', singleLine: true }
            },
            timestamp: pino.stdTimeFunctions.isoTime
        })
});

module.exports = logger;
