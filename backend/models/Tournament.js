const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema(
  {
    sport: { type: String, required: true, enum: ['badminton', 'table-tennis', 'carrom'] },
    year: { type: Number, required: true },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    venue: { type: String, required: true },
    registrationDeadline: { type: Date, required: true, default: Date.now },
    category: {
      type: String,
      required: true,
      enum: ['singles-men', 'singles-women', 'doubles-men', 'doubles-women', 'mixed-doubles'],
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    isLocked: { type: Boolean, default: false }, // If true, new registrations are blocked
    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Prevent duplicate tournaments for same sport, year, category, and admin
tournamentSchema.index({ sport: 1, year: 1, category: 1, createdBy: 1 }, { unique: true });


module.exports = mongoose.model('Tournament', tournamentSchema);