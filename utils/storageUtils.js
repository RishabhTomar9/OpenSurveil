const fs = require('fs');
const path = require('path');

const saveVideoLocal = (buffer, userId, originalname) => {
  const date = new Date();
  const dir = path.join(__dirname, '..', 'uploads', userId.toString(), date.toISOString().split('T')[0]);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filepath = path.join(dir, `${Date.now()}_${originalname}`);
  fs.writeFileSync(filepath, buffer);
  return filepath;
};

const saveVideoCloud = async (buffer, userId, originalname) => {
  // Placeholder for cloud storage integration (AWS S3, GCP, etc)
  // Return the URL or path of uploaded video
  throw new Error('Cloud storage not implemented yet');
};

module.exports = { saveVideoLocal, saveVideoCloud };
