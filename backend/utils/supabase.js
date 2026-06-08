/**
 * Supabase Utility Module
 *
 * Handles JWT verification and quota management
 */

const { createClient } = require('@supabase/supabase-js');
const logger = require('./logger');

// Initialize Supabase clients
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    logger.warn('[Supabase] Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env');
}

if (!supabaseUrl || !supabaseServiceKey) {
    logger.warn('[Supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
}

// Client for JWT verification (using ANON_KEY)
const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);

// Client for database operations (using SERVICE_ROLE_KEY)
const supabaseDb = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Validate UUID format
 * @param {string} str - String to validate
 * @returns {boolean}
 */
function isValidUUID(str) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
}

/**
 * Validate user ID format
 * @param {string} userId - User ID to validate
 * @throws {Error} If userId is invalid
 */
function validateUserId(userId) {
    if (!userId) {
        throw new Error('User ID is required');
    }
    if (typeof userId !== 'string') {
        throw new Error('User ID must be a string');
    }
    if (!isValidUUID(userId)) {
        throw new Error('Invalid User ID format');
    }
}

/**
 * Validate quota amount
 * @param {number} amount - Amount to validate
 * @throws {Error} If amount is invalid
 */
function validateAmount(amount) {
    if (typeof amount !== 'number' || isNaN(amount)) {
        throw new Error('Amount must be a number');
    }
    if (!Number.isInteger(amount)) {
        throw new Error('Amount must be an integer');
    }
    if (amount < 0) {
        throw new Error('Amount cannot be negative');
    }
    if (amount > 1000) {
        throw new Error('Amount too large (max 1000)');
    }
}

/**
 * Verify JWT token from Authorization header
 * @param {string} authHeader - Authorization header value (Bearer <token>)
 * @returns {Promise<Object>} User object { id, email }
 * @throws {Error} If token is invalid or missing
 */
async function verifyJWT(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
        // Verify with Supabase
        const { data: { user }, error } = await supabaseAuth.auth.getUser(token);

        if (error) {
            throw new Error(`JWT verification failed: ${error.message}`);
        }

        if (!user) {
            throw new Error('User not found');
        }

        return {
            id: user.id,
            email: user.email
        };
    } catch (error) {
        throw new Error(`JWT verification error: ${error.message}`);
    }
}

/**
 * Get user profile from database
 * @param {string} userId - User ID from JWT
 * @returns {Promise<Object>} User profile { subscription_tier, daily_quota, used_quota, last_reset_date }
 */
async function getUserProfile(userId) {
    // Validate userId
    validateUserId(userId);

    const { data, error } = await supabaseDb
        .from('user_profile')
        .select('subscription_tier, daily_quota, used_quota, last_reset_date, subscription_start, subscription_end, auto_renew')
        .eq('user_id', userId)
        .single();

    if (error) {
        // If profile doesn't exist, create default one
        if (error.code === 'PGRST116') {
            const { data: newProfile, error: insertError } = await supabaseDb
                .from('user_profile')
                .insert({
                    user_id: userId,
                    subscription_tier: 'free',
                    daily_quota: 100,
                    used_quota: 0,
                    last_reset_date: new Date().toISOString().split('T')[0],
                    subscription_start: null,
                    subscription_end: null,
                    auto_renew: false
                })
                .select()
                .single();

            if (insertError) {
                throw new Error(`Failed to create user profile: ${insertError.message}`);
            }

            return newProfile;
        }

        throw new Error(`Failed to fetch user profile: ${error.message}`);
    }

    // Check if quota should reset (daily reset)
    const today = new Date().toISOString().split('T')[0];
    if (data.last_reset_date !== today) {
        // Reset quota
        const { data: resetData, error: resetError } = await supabaseDb
            .from('user_profile')
            .update({
                used_quota: 0,
                last_reset_date: today
            })
            .eq('user_id', userId)
            .select()
            .single();

        if (resetError) {
            throw new Error(`Failed to reset quota: ${resetError.message}`);
        }

        logger.info({ userId, oldDate: data.last_reset_date, newDate: today }, 'Quota reset for user');
        return resetData;
    }

    return data;
}

/**
 * Update user's quota (deduct)
 * @param {string} userId - User ID
 * @param {number} amount - Amount to deduct
 * @returns {Promise<Object>} Updated profile
 */
async function updateQuota(userId, amount) {
    // Validate inputs
    validateUserId(userId);
    validateAmount(amount);

    // First get current quota
    const profile = await getUserProfile(userId);

    // Calculate new used_quota
    const newUsedQuota = profile.used_quota + amount;

    // Ensure it doesn't exceed daily_quota
    if (newUsedQuota > profile.daily_quota) {
        throw new Error(`Quota exceeded: ${newUsedQuota}/${profile.daily_quota}`);
    }

    // Update used_quota
    const { data, error } = await supabaseDb
        .from('user_profile')
        .update({
            used_quota: newUsedQuota
        })
        .eq('user_id', userId)
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to update quota: ${error.message}`);
    }

    // Log quota update
    logger.info({
        userId,
        amount,
        previousUsed: profile.used_quota,
        newUsed: newUsedQuota,
        dailyQuota: profile.daily_quota,
        remaining: profile.daily_quota - newUsedQuota
    }, 'Quota updated');

    return data;
}

/**
 * Get quota by subscription tier
 * @param {string} tier - Subscription tier (free, pro, max)
 * @returns {number} Daily quota for the tier
 */
function getQuotaByTier(tier) {
    const quotas = {
        free: 100,
        pro: 300,
        max: 1000
    };
    return quotas[tier] || quotas.free;
}

/**
 * Upgrade user's subscription tier
 * @param {string} userId - User ID
 * @param {string} newTier - New subscription tier (free, pro, max)
 * @returns {Promise<Object>} Updated user profile
 */
async function upgradeSubscriptionTier(userId, newTier) {
    // Validate inputs
    validateUserId(userId);

    if (!['free', 'pro', 'max'].includes(newTier)) {
        throw new Error('Invalid subscription tier. Must be free, pro, or max');
    }

    const dailyQuota = getQuotaByTier(newTier);
    const now = new Date();
    const subscriptionEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30天后

    const { data, error } = await supabaseDb
        .from('user_profile')
        .update({
            subscription_tier: newTier,
            daily_quota: dailyQuota,
            used_quota: 0, // Reset usage when upgrading
            subscription_start: now.toISOString(),
            subscription_end: subscriptionEnd.toISOString(),
            auto_renew: false, // 默认不自动续费
            last_reset_date: now.toISOString().split('T')[0]
        })
        .eq('user_id', userId)
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to upgrade subscription: ${error.message}`);
    }

    return data;
}

/**
 * Check if user has enough quota
 * @param {string} userId - User ID
 * @param {number} cost - Required quota
 * @returns {Promise<Object>} { hasQuota: boolean, remaining: number }
 */
async function checkQuota(userId, cost) {
    // Validate inputs
    validateUserId(userId);
    validateAmount(cost);

    const profile = await getUserProfile(userId);
    const remaining = profile.daily_quota - profile.used_quota;

    return {
        hasQuota: remaining >= cost,
        remaining,
        dailyQuota: profile.daily_quota,
        usedQuota: profile.used_quota,
        subscriptionTier: profile.subscription_tier
    };
}

module.exports = {
    supabaseAuth,
    supabaseDb,
    verifyJWT,
    getUserProfile,
    updateQuota,
    checkQuota,
    getQuotaByTier,
    upgradeSubscriptionTier,
    // Export validation functions for testing
    isValidUUID,
    validateUserId,
    validateAmount
};
