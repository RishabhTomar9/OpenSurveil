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
const User = require('./models/User');
const Device = require('./models/Device');

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
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
  const recordedVideos = await RecordedVideo.find({ userId: req.user._id }).sort({ uploadedAt: -1 });
  res.render('dashboard', { user: req.user, devices, recordedVideos });
});

app.get('/multicam', ensureAuthenticated, (req, res) => res.render('multicam'));

// Upload video route
app.post('/uploadVideo', ensureAuthenticated, upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No video file uploaded' });

  // To save locally:
  
  const fs = require('fs');
  const localPath = path.join(__dirname, 'uploads', `video_${Date.now()}.webm`);
  fs.writeFile(localPath, req.file.buffer, err => {
    if (err) return res.status(500).json({ error: 'Failed to save file locally' });
    res.json({ message: 'Video saved locally', path: localPath });
  });
  

  // To upload to Cloudinary (preferred)
  const uploadStream = cloudinary.uploader.upload_stream(
    {
      resource_type: 'video',
      folder: `users/${req.user._id}/videos`,
      public_id: `recording_${Date.now()}`,
    },
    async (error, result) => {
      if (error) {
        console.error(error);
        return res.status(500).json({ error: 'Cloudinary upload failed' });
      }
      try {
        const recordedVideo = new RecordedVideo({
          userId: req.user._id,
          name: req.body.name || `Recording ${new Date().toLocaleString()}`,
          url: result.secure_url,
        });
        await recordedVideo.save();
        res.json({ message: 'Upload successful', video: recordedVideo });
      } catch (dbErr) {
        console.error(dbErr);
        res.status(500).json({ error: 'Failed to save video metadata' });
      }
    }
  );

  uploadStream.end(req.file.buffer);
});


// Error handler
app.use((err, req, res, next) => {
  console.error('Unexpected error:', err);
  res.status(500).send('Internal Server Error');
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
