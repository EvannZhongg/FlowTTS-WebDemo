const express = require('express');
const authenticate = require('../middleware/auth');
const { getUserProfile } = require('../utils/supabase');

const router = express.Router();

router.get('/quota', authenticate, async (req, res) => {
    try {
        const profile = await getUserProfile(req.user.id);
        const quota = {
            daily: Number(profile.daily_quota || 0),
            used: Number(profile.used_quota || 0),
            remaining: Math.max(Number(profile.daily_quota || 0) - Number(profile.used_quota || 0), 0),
            subscription_tier: profile.subscription_tier || 'free',
            subscription_start: profile.subscription_start || null,
            subscription_end: profile.subscription_end || null,
            auto_renew: Boolean(profile.auto_renew)
        };
        const etag = `"quota-${req.user.id}-${quota.daily}-${quota.used}-${profile.last_reset_date || ''}"`;
        res.setHeader('Cache-Control', 'private, no-cache');
        res.setHeader('ETag', etag);
        if (req.headers['if-none-match'] === etag) return res.status(304).end();
        return res.json({
            code: 'success',
            user: {
                id: req.user.id,
                email: req.user.email
            },
            quota
        });
    } catch (error) {
        return res.status(500).json({
            code: 'quota_failed',
            message: error.message
        });
    }
});

module.exports = router;
