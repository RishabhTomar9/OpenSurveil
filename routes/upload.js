// routes/upload.js
const express = require('express');
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const fs = require('fs');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/upload-to-cloud', upload.single('video'), async (req, res) => {
  try {
    const filePath = req.file.path;
    const userId = req.user.id;

    const uploadResult = await cloudinary.uploader.upload(filePath, {
      resource_type: 'video',
      folder: `user_${userId}`,
    });

    fs.unlinkSync(filePath); // Clean up temp file

    res.json({ url: uploadResult.secure_url });
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    res.status(500).json({ error: 'Failed to upload video' });
  }
});

module.exports = router;
