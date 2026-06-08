/**
 * Authentication Middleware
 *
 * Verifies JWT token and attaches user info to request
 */

const logger = require('../utils/logger');
const { verifyJWT } = require('../utils/supabase');

/**
 * Middleware to verify JWT token
 * Extracts token from Authorization header and verifies it
 * Attaches user info to req.user
 */
async function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                code: 'unauthorized',
                message: 'Missing Authorization header'
            });
        }

        // Verify JWT token
        const user = await verifyJWT(authHeader);

        // Attach user to request
        req.user = user;

        // Log authentication
        logger.info({
            userId: user.id,
            email: user.email,
            method: req.method,
            path: req.path
        }, `🔐 User authenticated: ${user.email}`);

        next();
    } catch (error) {
        logger.error({
            method: req.method,
            path: req.path,
            error: error.message
        }, '❌ Authentication failed');
        return res.status(401).json({
            code: 'unauthorized',
            message: error.message
        });
    }
}

module.exports = authenticate;
