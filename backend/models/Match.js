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
    scheduledTime: { type: String, default: '' },
    court: { type: String, default: '' },
    venue: { type: String, default: '' },
    nextMatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match' }, // Reference to the next match in the bracket
    positionInNextMatch: { type: Number, enum: [1, 2] }, // Whether winner goes to player1 or player2

    // Detailed sport performance metrics (entered by admin or recorded during matches)
    player1Stats: {
      pointsScored: { type: Number, default: 0 },
      pointsConceded: { type: Number, default: 0 },
      setsWon: { type: Number, default: 0 },
      setsLost: { type: Number, default: 0 },
      gamesWon: { type: Number, default: 0 },
      gamesLost: { type: Number, default: 0 },
      boardsWon: { type: Number, default: 0 },
      boardsLost: { type: Number, default: 0 },
      coinsPocketed: { type: Number, default: 0 },
      fouls: { type: Number, default: 0 },
    },
    player2Stats: {
      pointsScored: { type: Number, default: 0 },
      pointsConceded: { type: Number, default: 0 },
      setsWon: { type: Number, default: 0 },
      setsLost: { type: Number, default: 0 },
      gamesWon: { type: Number, default: 0 },
      gamesLost: { type: Number, default: 0 },
      boardsWon: { type: Number, default: 0 },
      boardsLost: { type: Number, default: 0 },
      coinsPocketed: { type: Number, default: 0 },
      fouls: { type: Number, default: 0 },
    },
    statsEnteredByAdmin: { type: Boolean, default: false },
    notes: { type: String, default: '' },
    matchDate: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Match', matchSchema);

