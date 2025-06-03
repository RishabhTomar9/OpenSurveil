const express = require('express');
const router = express.Router();

// Middleware to check if user is authenticated
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  return res.status(401).json({ success: false, message: 'Not authenticated' });
}

router.post('/subscribe-free', ensureAuthenticated, async (req, res) => {
  try {
    const user = req.user;
    user.isSubscribed = true;
    user.subscribedAt = new Date();
    await user.save();

    res.json({ success: true, message: 'Subscription activated successfully.' });
  } catch (error) {
    console.error('Subscription activation error:', error);
    res.status(500).json({ success: false, message: 'Failed to activate subscription.' });
  }
});

module.exports = router;