const mongoose = require('mongoose');
const crypto = require('crypto');

const registrationSchema = new mongoose.Schema(
  {
    tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
    playerName: { type: String, required: true, trim: true },
    rollNumber: { type: String, required: true, trim: true },
    nicNo: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    year: { type: String, default: 'N/A' },
    partnerName: { type: String, trim: true, default: '' },
    partnerRollNumber: { type: String, trim: true, default: '' },
    pairInitiatedByRollNumber: { type: String, trim: true, default: '' },
    pairInitiatedAt: { type: Date, default: null },
    status: { type: String, enum: ['pending', 'confirmed', 'rejected', 'cancelled'], default: 'pending' },
    qrToken: { type: String, sparse: true, trim: true },
    qrTokenCreatedAt: { type: Date, default: Date.now },
    qrTokenRevoked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

registrationSchema.pre('save', function (next) {
  if (!this.qrToken) {
    this.qrToken = crypto.randomBytes(20).toString('hex');
    this.qrTokenCreatedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Registration', registrationSchema);