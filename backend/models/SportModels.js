const mongoose = require('mongoose');

const TOURNAMENT_CATEGORIES = [
  'singles-men',
  'singles-women',
  'doubles-men',
  'doubles-women',
  'mixed-doubles',
];

// --- SCHEMAS ---
const tournamentSchema = new mongoose.Schema({
  sport: { type: String, required: true },
  year: { type: Number, required: true },
  date: { type: Date, required: true },
  time: { type: String, required: true },
  venue: { type: String, required: true },
  registrationDeadline: { type: Date, required: true, default: Date.now },
  category: { type: String, required: true, enum: TOURNAMENT_CATEGORIES },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  isLocked: { type: Boolean, default: false },
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration' },
  isActive: { type: Boolean, default: true },
  isPublished: { type: Boolean, default: false },
}, { timestamps: true });

tournamentSchema.index({ sport: 1, year: 1, category: 1, createdBy: 1 }, { unique: true });

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
  gender: { type: String, enum: ['Male', 'Female', 'Other'], default: undefined },
  partnerStatus: { type: String, enum: ['none', 'looking', 'requested', 'paired'], default: 'none' },
  pairStatus: { type: String, enum: ['none', 'incomplete', 'complete', 'approved'], default: 'none' },
  pairId: { type: mongoose.Schema.Types.ObjectId, default: null },
  pairInitiatedByRollNumber: { type: String, default: '' },
  pairInitiatedAt: { type: Date, default: null },
  status: { type: String, default: 'pending' },
}, { timestamps: true });
// Unique constraints per tournament
registrationSchema.index({ tournament: 1, nicNo: 1 }, { unique: true, sparse: true });
registrationSchema.index({ tournament: 1, rollNumber: 1 }, { unique: true, sparse: true });

const playerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rollNumber: { type: String, required: true, unique: true },
  nicNo: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  department: { type: String, required: true },
  tournamentHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tournament' }],
}, { timestamps: true });

// --- FACTORY FUNCTION ---
function getModelsForSport(sport) {
  const prefix = sport.toLowerCase().replace(/-/g, '_') + '_';
  const tModelName = `${prefix}Tournament`;
  const rModelName = `${prefix}Registration`;
  const pModelName = `${prefix}Player`;
  const pairModelName = `${prefix}Pair`;
  const partnerRequestModelName = `${prefix}PartnerRequest`;

  // 1. Tournament Model
  let Tournament;
  if (mongoose.models[tModelName]) {
    Tournament = mongoose.models[tModelName];
  } else {
    const sTournSchema = tournamentSchema.clone();
    sTournSchema.path('winner').options.ref = rModelName;
    Tournament = mongoose.model(tModelName, sTournSchema, `${prefix}tournaments`);
  }

  // 2. Registration Model with Sport-Specific Ref
  let Registration;
  if (mongoose.models[rModelName]) {
    Registration = mongoose.models[rModelName];
  } else {
    const sRegSchema = registrationSchema.clone();
    sRegSchema.path('tournament').options.ref = tModelName; // Map to the sport's tournament table
    Registration = mongoose.model(rModelName, sRegSchema, `${prefix}registrations`);
  }

  // 3. Player Model with Sport-Specific Ref
  let Player;
  if (mongoose.models[pModelName]) {
    Player = mongoose.models[pModelName];
  } else {
    const sPlayerSchema = playerSchema.clone();
    sPlayerSchema.path('tournamentHistory').caster.options.ref = tModelName; 
    Player = mongoose.model(pModelName, sPlayerSchema, `${prefix}players`);
  }
  
    // 4. Pair Model — groups two registrations as a completed pair
    let Pair;
    if (mongoose.models[pairModelName]) {
      Pair = mongoose.models[pairModelName];
    } else {
      const pairSchema = new mongoose.Schema({
        tournament: { type: mongoose.Schema.Types.ObjectId, ref: tModelName, required: true },
        players: [{ type: mongoose.Schema.Types.ObjectId, ref: rModelName }],
      }, { timestamps: true });
      Pair = mongoose.model(pairModelName, pairSchema, `${prefix}pairs`);
    }

    // 5. Partner Request Model
    let PartnerRequest;
    if (mongoose.models[partnerRequestModelName]) {
      PartnerRequest = mongoose.models[partnerRequestModelName];
    } else {
      const prSchema = new mongoose.Schema({
        tournament: { type: mongoose.Schema.Types.ObjectId, ref: tModelName, required: true },
        requesterRegistration: { type: mongoose.Schema.Types.ObjectId, ref: rModelName, required: true },
        requesterRollNumber: { type: String, required: true },
        targetRegistration: { type: mongoose.Schema.Types.ObjectId, ref: rModelName, required: true },
        targetRollNumber: { type: String, required: true },
        status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
      }, { timestamps: true });
      PartnerRequest = mongoose.model(partnerRequestModelName, prSchema, `${prefix}partner_requests`);
    }
  return { Tournament, Registration, Player, Pair, PartnerRequest };
}

module.exports = { getModelsForSport };
