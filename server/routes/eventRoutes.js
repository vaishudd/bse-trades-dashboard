const router = require('express').Router();
const { streamEvents } = require('../controllers/eventController');

router.get('/events', streamEvents);

module.exports = router;
