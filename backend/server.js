const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

process.on('uncaughtException', (err) => {
  console.error('🔥 Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 Unhandled Rejection at:', promise, 'reason:', reason);
});

const getRequiredEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const PORT = process.env.PORT || 5000;
const MONGODB_URI = getRequiredEnv('MONGODB_URI');
const JWT_SECRET = getRequiredEnv('JWT_SECRET');

const app = express();

const { securitySanitizer, securityHeaders } = require('./middleware/security');
const jwt = require('jsonwebtoken');


// Apply security headers globally
app.use(securityHeaders);

// Restrict CORS options
const corsOptions = {
  origin:
    process.env.CLIENT_ORIGIN ||
    process.env.FRONTEND_URL ||
    'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

const uploadsPath = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsPath, { recursive: true });
app.use('/uploads', express.static(uploadsPath));

// Apply XSS and NoSQL injection sanitizer
app.use(securitySanitizer);

// Welcome route
app.get('/', (req, res) => {
  res.json({ message: '🏆 Tournament API Server is running', version: '1.0.0' });
});

// Routes
const authRoutes = require('./routes/auth');
const tournamentRoutes = require('./routes/tournaments');
const registrationRoutes = require('./routes/registrations');
const universityTeamRoutes = require('./routes/universityTeam');

app.use('/api/auth', authRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/university-team', universityTeamRoutes);

// Lightweight auth/me fallback: respond safely without touching DB
// This prevents front-end 500 responses while the DB or models may be initializing.
app.get('/api/auth/me', (req, res) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return res.json(null);
    const decoded = jwt.verify(token, JWT_SECRET);
    return res.json({ id: decoded.id });
  } catch (err) {
    console.error('Auth /me fallback error:', err && err.stack ? err.stack : err);
    return res.json(null);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'Backend is running', timestamp: new Date().toISOString() });
});

// Favicon handler (prevent 404 errors)
app.get('/favicon.ico', (req, res) => {
  res.status(204).send();
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', err.message);
  res.status(500).json({ 
    message: 'Internal Server Error',
    details: process.env.NODE_ENV === 'development' ? err.message : 'Check server logs'
  });
});

const startServer = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    });
    console.log('✅ MongoDB connected successfully');

    // Run database migration to default registrationDeadline of existing tournaments to their event date
    try {
      const { getModelsForSport } = require('./models/SportModels');
      const sports = ['badminton', 'table-tennis', 'carrom'];
      for (const sport of sports) {
        const { Tournament } = getModelsForSport(sport);
        const docs = await Tournament.find({ registrationDeadline: { $exists: false } });
        for (const doc of docs) {
          doc.registrationDeadline = doc.date;
          await doc.save();
        }
        if (docs.length > 0) {
          console.log(`📡 Migrated ${docs.length} ${sport} tournaments`);
        }
      }

      const StandaloneTournament = require('./models/Tournament');
      const standaloneDocs = await StandaloneTournament.find({ registrationDeadline: { $exists: false } });
      for (const doc of standaloneDocs) {
        doc.registrationDeadline = doc.date;
        await doc.save();
      }
      if (standaloneDocs.length > 0) {
        console.log(`📡 Migrated ${standaloneDocs.length} standalone tournaments`);
      }
    } catch (migrationErr) {
      console.error('❌ Database migration error:', migrationErr.message);
    }
  } catch (err) {
    console.error('⚠️ MongoDB connection error:', err.message);
    if (err.reason) {
      console.error('🔍 Detailed Reason:', JSON.stringify(err.reason, null, 2));
    }
    console.log('⚠️ Starting backend in degraded mode without MongoDB. Auth/me and static routes will still work.');
  }

  const server = app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Please stop the running process or set a different PORT in your environment.`);
    } else {
      console.error('❌ Server error:', error);
    }
    process.exit(1);
  });
};

startServer();


