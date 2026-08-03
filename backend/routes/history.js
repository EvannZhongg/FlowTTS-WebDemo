const express = require('express');
const authenticate = require('../middleware/auth');
const {
    createHistoryItem,
    listHistoryItems,
    deleteHistoryItem,
    clearHistoryItems
} = require('../utils/history-store');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
    try {
        const items = await listHistoryItems(req.user.id);
        res.setHeader('Cache-Control', 'private, no-store');
        return res.json({ code: 'success', items });
    } catch (error) {
        return res.status(500).json({ code: 'history_list_failed', message: error.message });
    }
});

router.post('/', authenticate, async (req, res) => {
    try {
        const item = await createHistoryItem(req.user.id, req.body || {});
        return res.status(201).json({ code: 'success', item });
    } catch (error) {
        return res.status(500).json({ code: 'history_save_failed', message: error.message });
    }
});

router.delete('/:id', authenticate, async (req, res) => {
    try {
        const deleted = await deleteHistoryItem(req.user.id, req.params.id);
        if (!deleted) {
            return res.status(404).json({ code: 'history_not_found', message: 'History record not found' });
        }
        return res.json({ code: 'success' });
    } catch (error) {
        return res.status(500).json({ code: 'history_delete_failed', message: error.message });
    }
});

router.delete('/', authenticate, async (req, res) => {
    try {
        const deleted = await clearHistoryItems(req.user.id);
        return res.json({ code: 'success', deleted });
    } catch (error) {
        return res.status(500).json({ code: 'history_clear_failed', message: error.message });
    }
});

module.exports = router;
