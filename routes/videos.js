// routes/videos.js
const express = require('express');
const router = express.Router();
const cloudinary = require('../utils/cloudinary'); // Adjust path if needed

router.get('/videos/cloud', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const userId = req.user.id;
    const response = await cloudinary.search
      .expression(`resource_type:video AND folder:user_${userId}`)
      .sort_by('created_at', 'desc')
      .max_results(30)
      .execute();

    const videoUrls = response.resources.map((file) => file.secure_url);
    res.json(videoUrls);
  } catch (error) {
    console.error('Cloudinary fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch cloud videos' });
  }
});

module.exports = router;
