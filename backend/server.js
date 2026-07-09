const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

const { securitySanitizer, securityHeaders } = require('./middleware/security');

// Apply security headers globally
app.use(securityHeaders);

// Restrict CORS options
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};
app.use(cors(corsOptions));

app.use(express.json());

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

app.use('/api/auth', authRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/registrations', registrationRoutes);

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

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

mongoose
  .connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
  })
  .then(async () => {
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

    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    if (err.reason) {
      console.error('🔍 Detailed Reason:', JSON.stringify(err.reason, null, 2));
    }
    process.exit(1);
  });


