const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    rollNumber: { type: String, required: true, unique: true, trim: true },
    nicNo: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    // We can also track the tournaments they've been approved in
    tournamentHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tournament' }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Player', playerSchema);
