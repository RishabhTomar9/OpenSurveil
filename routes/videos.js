const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');
const router = express.Router();
const dotenv = require('dotenv');
dotenv.config();

// Multer config
const upload = multer({ dest: 'temp_uploads/' });

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cloud upload route
router.post('/upload/cloud', upload.single('video'), async (req, res) => {
  try {
    const result = await cloudinary.uploader.upload(req.file.path, {
      resource_type: 'video',
      folder: `videos/${new Date().toISOString().split('T')[0]}`,
    });
    fs.unlinkSync(req.file.path); // cleanup temp file
    res.json({ url: result.secure_url });
  } catch (err) {
    res.status(500).json({ error: 'Upload to Cloudinary failed' });
  }
});

// Local upload route
router.post('/upload/local', upload.single('video'), async (req, res) => {
  try {
    const dateFolder = new Date().toISOString().split('T')[0];
    const dir = path.join(__dirname, '..', 'uploads', dateFolder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filename = `video-${Date.now()}.webm`;
    const dest = path.join(dir, filename);
    fs.renameSync(req.file.path, dest);
    res.json({ message: 'Saved locally', path: `/uploads/${dateFolder}/${filename}` });
  } catch (err) {
    res.status(500).json({ error: 'Local save failed' });
  }
});

module.exports = router;
