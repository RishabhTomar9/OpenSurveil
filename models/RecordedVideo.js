const mongoose = require('mongoose');

const recordedVideoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  name: { type: String, required: true },
  url: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
});

const RecordedVideo = mongoose.model('RecordedVideo', recordedVideoSchema);
module.exports = RecordedVideo;
