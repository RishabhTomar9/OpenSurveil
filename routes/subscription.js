const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { createCheckoutSession, handleWebhook } = require('../controllers/subscriptionController');

router.post('/create-checkout-session', protect, createCheckoutSession);
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

module.exports = router;
