const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema(
  {
    tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
    round: { type: Number, required: true }, // 1 = Round of 16, 2 = Quarter-finals, etc.
    matchNumber: { type: Number, required: true },
    player1: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration' }, // Null for Bye
    player2: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration' }, // Null for Bye
    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration' },
    score1: { type: Number, default: 0 },
    score2: { type: Number, default: 0 },
    isCompleted: { type: Boolean, default: false },
    status: { type: String, enum: ['scheduled', 'in-progress', 'completed', 'cancelled', 'postponed'], default: 'scheduled' },
    court: { type: String, trim: true, default: 'Court 1' },
    venue: { type: String, trim: true, default: 'Indoor Stadium' },
    scheduledDate: { type: Date },
    scheduledTime: { type: String, default: '' },
    checkIns: [
      {
        registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration' },
        rollNumber: { type: String },
        checkedInAt: { type: Date, default: Date.now },
        checkedInBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
      }
    ],
    timeline: [
      {
        message: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        type: { type: String, enum: ['info', 'start', 'update', 'end', 'checkin'], default: 'info' },
      }
    ],
    nextMatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match' }, // Reference to the next match in the bracket
    positionInNextMatch: { type: Number, enum: [1, 2] }, // Whether winner goes to player1 or player2
  },
  { timestamps: true }
);

module.exports = mongoose.model('Match', matchSchema);
