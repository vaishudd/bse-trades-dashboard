const router = require('express').Router();

router.get('/health', (_req, res) => res.json({ ok: true }));
router.use(require('./tradeRoutes'));
router.use(require('./eventRoutes'));

module.exports = router;
