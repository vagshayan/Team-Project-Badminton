const mongoose = require('mongoose');

const playerPerformanceSchema = new mongoose.Schema(
  {
    rollNumber: { type: String, required: true, trim: true, index: true },
    playerName: { type: String, required: true, trim: true },
    sport: { type: String, required: true, enum: ['badminton', 'table-tennis', 'carrom'] },
    totalMatches: { type: Number, default: 0 },
    matchesWon: { type: Number, default: 0 },
    matchesLost: { type: Number, default: 0 },
    winPercentage: { type: Number, default: 0 },
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
    averagePointsPerMatch: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    maxStreak: { type: Number, default: 0 },
    recentResults: [{ type: String }],
    overallScore: { type: Number, default: 0 },
    lastCalculatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

playerPerformanceSchema.index({ rollNumber: 1, sport: 1 }, { unique: true });

module.exports = mongoose.model('PlayerPerformance', playerPerformanceSchema);

