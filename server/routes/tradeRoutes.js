const router = require('express').Router();
const c = require('../controllers/tradeController');

router.get('/trades', c.getTrades);
router.post('/trades/pull', c.postPull);
router.get('/trades/status', c.getStatus);
router.get('/jobs/:jobId', c.getJobById);

module.exports = router;
