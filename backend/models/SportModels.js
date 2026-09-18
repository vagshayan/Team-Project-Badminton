const mongoose = require('mongoose');
const crypto = require('crypto');

// --- SCHEMAS ---
const tournamentSchema = new mongoose.Schema({
  sport: { type: String, required: true },
  year: { type: Number, required: true },
  date: { type: Date, required: true },
  time: { type: String, required: true },
  venue: { type: String, required: true },
  category: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  isLocked: { type: Boolean, default: false },
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration' },
  isActive: { type: Boolean, default: true },
  isPublished: { type: Boolean, default: false },
}, { timestamps: true });

const registrationSchema = new mongoose.Schema({
  tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
  playerName: { type: String, required: true },
  rollNumber: { type: String, required: true },
  nicNo: { type: String, required: true },
  address: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  department: { type: String, required: true },
  year: { type: String, default: 'N/A' },
  partnerName: { type: String, default: '' },
  partnerRollNumber: { type: String, default: '' },

  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    default: undefined
  },

  partnerStatus: {
    type: String,
    enum: ['none', 'looking', 'requested', 'paired'],
    default: 'none'
  },

  pairStatus: {
    type: String,
    enum: ['none', 'incomplete', 'complete', 'approved'],
    default: 'none'
  },

  pairId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },

  pairInitiatedByRollNumber: {
    type: String,
    default: ''
  },

  pairInitiatedAt: {
    type: Date,
    default: null
  },

  // Email / QR notification fields
  status: {
    type: String,
    default: 'pending'
  },

  qrToken: {
    type: String,
    sparse: true,
    trim: true
  },

  qrTokenCreatedAt: {
    type: Date,
    default: Date.now
  },

  qrTokenRevoked: {
    type: Boolean,
    default: false
  },

}, { timestamps: true });

// Automatically create a QR token for new registrations
registrationSchema.pre('save', function (next) {
  if (!this.qrToken) {
    this.qrToken = crypto.randomBytes(20).toString('hex');
    this.qrTokenCreatedAt = new Date();
  }
  next();
});

const playerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rollNumber: { type: String, required: true, unique: true },
  nicNo: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  department: { type: String, required: true },
  tournamentHistory: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament'
    }
  ],
}, { timestamps: true });

// --- FACTORY FUNCTION ---
function getModelsForSport(sport) {
  const prefix = sport.toLowerCase().replace(/-/g, '_') + '_';
  const tModelName = `${prefix}Tournament`;
  const rModelName = `${prefix}Registration`;
  const pModelName = `${prefix}Player`;

  // 1. Tournament Model
  let Tournament;

  if (mongoose.models[tModelName]) {
    Tournament = mongoose.models[tModelName];
  } else {
    const sTournSchema = tournamentSchema.clone();

    sTournSchema.path('winner').options.ref = rModelName;

    Tournament = mongoose.model(
      tModelName,
      sTournSchema,
      `${prefix}tournaments`
    );
  }

  // 2. Registration Model with Sport-Specific Ref
  let Registration;

  if (mongoose.models[rModelName]) {
    Registration = mongoose.models[rModelName];
  } else {
    const sRegSchema = registrationSchema.clone();

    sRegSchema.path('tournament').options.ref = tModelName;

    Registration = mongoose.model(
      rModelName,
      sRegSchema,
      `${prefix}registrations`
    );
  }

  // 3. Player Model
  let Player;

  if (mongoose.models[pModelName]) {
    Player = mongoose.models[pModelName];
  } else {
    const sPlayerSchema = playerSchema.clone();

    sPlayerSchema.path('tournamentHistory').options.type = [{
      type: mongoose.Schema.Types.ObjectId,
      ref: tModelName
    }];

    Player = mongoose.model(
      pModelName,
      sPlayerSchema,
      `${prefix}players`
    );
  }

  return { Tournament, Registration, Player };
}

module.exports = {
  getModelsForSport,
  tournamentSchema,
  registrationSchema,
  playerSchema
};