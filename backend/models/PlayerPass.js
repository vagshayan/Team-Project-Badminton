const mongoose = require('mongoose');

const playerPassSchema = new mongoose.Schema({
  registration: { type: mongoose.Schema.Types.ObjectId, required: true },
  sport: { type: String, enum: ['badminton', 'table-tennis', 'carrom'], required: true },
  playerId: { type: String, required: true, unique: true, index: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  tokenCipher: { type: String, required: true, select: false },
  isRevoked: { type: Boolean, default: false },
}, { timestamps: true });

playerPassSchema.index({ sport:  1, registration: 1 }, { unique: true });

module.exports = mongoose.model('PlayerPass', playerPassSchema);