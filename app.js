// app.js (Updated)
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const multer = require('multer');
const cloudinary = require('./utils/cloudinary'); // Your cloudinary config
const RecordedVideo = require('./models/RecordedVideo');
const User = require('./models/User'); // Assuming User model has 'isPremium' field
const Device = require('./models/Device');
const fs = require('fs'); // Required for local file system operations

const upload = multer({ storage: multer.memoryStorage() });

const app = express();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve static files from 'uploads'

// Session config
app.use(session({
  secret: process.env.SESSION_SECRET || 'keyboardcat',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
  cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 1 day
}));

// Passport setup
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback',
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ googleId: profile.id });
    if (!user) {
      user = await User.create({
        googleId: profile.id,
        displayName: profile.displayName,
        email: profile.emails[0].value,
        photo: profile.photos[0].value,
        isPremium: false, // Initialize subscription status
      });
    } else {
      user.photo = profile.photos[0].value;
      await user.save();
    }
    done(null, user);
  } catch (err) {
    done(err, null);
  }
}));

// View engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Auth middleware
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/');
}

// Routes for authentication (Google OAuth)
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/dashboard');
  }
);
app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

// Main routes
app.get('/', (req, res) => res.render('login'));

app.get('/dashboard', ensureAuthenticated, async (req, res) => {
  const devices = await Device.find({ userId: req.user._id });
  res.render('dashboard', { user: req.user, devices });
});

app.get('/multicam', ensureAuthenticated, (req, res) => res.render('multicam'));

// Route for subscription page
app.get('/subscription', ensureAuthenticated, (req, res) => {
  res.render('subscription', { user: req.user }); // Pass user object if needed on subscription page
});

// NEW: API route for free subscription
app.post('/api/subscription/subscribe-free', ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.isPremium) {
      return res.json({ success: true, message: 'You are already subscribed!' });
    }

    user.isPremium = true; // Set user as premium
    await user.save();
    res.json({ success: true, message: '🎉 Subscription activated!' });
  } catch (error) {
    console.error('Error activating free subscription:', error);
    res.status(500).json({ success: false, message: 'Failed to activate subscription. Please try again.' });
  }
});


// NEW: Route for uploading to Cloudinary
app.post('/upload-to-cloud', ensureAuthenticated, upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No video file uploaded' });

  const uploadStream = cloudinary.uploader.upload_stream(
    {
      resource_type: 'video',
      folder: `users/${req.user._id}/videos`,
      public_id: `recording_${Date.now()}`,
    },
    async (error, result) => {
      if (error) {
        console.error('Cloudinary upload error:', error);
        return res.status(500).json({ error: 'Cloudinary upload failed' });
      }
      try {
        const recordedVideo = new RecordedVideo({
          userId: req.user._id,
          name: req.body.name || `Recording ${new Date().toLocaleString()}`,
          url: result.secure_url,
        });
        await recordedVideo.save();
        res.json({ message: 'Upload successful', url: result.secure_url });
      } catch (dbErr) {
        console.error('Failed to save video metadata to DB:', dbErr);
        res.status(500).json({ error: 'Failed to save video metadata' });
      }
    }
  );

  uploadStream.end(req.file.buffer);
});

// NEW: Route for saving video locally on the server
app.post('/save-local-video', ensureAuthenticated, upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No video file uploaded' });

  // Ensure 'uploads' directory exists
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
  }

  const filename = `video_${Date.now()}.webm`;
  const localPath = path.join(uploadsDir, filename);

  fs.writeFile(localPath, req.file.buffer, err => {
    if (err) {
      console.error('Failed to save file locally:', err);
      return res.status(500).json({ error: 'Failed to save file locally' });
    }
    // Return a URL that can be accessed by the frontend
    res.json({ message: 'Video saved locally', url: `/uploads/${filename}` });
  });
});

// NEW: Route to get cloud videos
app.get('/videos/cloud', ensureAuthenticated, async (req, res) => {
  try {
    const videos = await RecordedVideo.find({ userId: req.user._id }).sort({ uploadedAt: -1 });
    const videoUrls = videos.map(video => video.url);
    res.json(videoUrls);
  } catch (err) {
    console.error('Error fetching cloud videos:', err);
    res.status(500).json({ error: 'Failed to fetch cloud videos' });
  }
});

// NEW: Route to get local videos
app.get('/videos/local', ensureAuthenticated, (req, res) => {
  const uploadsDir = path.join(__dirname, 'uploads');
  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      console.error('Error reading local uploads directory:', err);
      return res.status(500).json({ error: 'Failed to read local videos' });
    }
    const videoUrls = files
      .filter(file => file.endsWith('.webm') || file.endsWith('.mp4')) // Filter for video files
      .map(file => `/uploads/${file}`); // Create accessible URLs
    res.json(videoUrls);
  });
});


// Error handler
app.use((err, req, res, next) => {
  console.error('Unexpected error:', err);
  res.status(500).send('Internal Server Error');
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));