const express = require('express');
const authenticate = require('../middleware/auth');
const { getUserProfile, updateUserCompany } = require('../utils/supabase');

const router = express.Router();

router.get('/quota', authenticate, async (req, res) => {
    try {
        let profile = await getUserProfile(req.user.id);
        if (!profile.company && req.user.company) {
            profile = await updateUserCompany(req.user.id, req.user.email, req.user.company);
        }
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
                email: req.user.email,
                company: profile.company || ''
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

router.patch('/profile', authenticate, async (req, res) => {
    try {
        const company = typeof req.body?.company === 'string' ? req.body.company.trim() : '';
        if (company.length > 100) {
            return res.status(400).json({
                code: 'company_too_long',
                message: 'Company name must be 100 characters or fewer'
            });
        }
        const profile = await updateUserCompany(req.user.id, req.user.email, company);
        return res.json({
            code: 'success',
            profile: {
                company: profile.company || ''
            }
        });
    } catch (error) {
        return res.status(500).json({
            code: 'profile_update_failed',
            message: error.message
        });
    }
});

module.exports = router;
