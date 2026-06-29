const mongoose = require('mongoose');

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
    status: { type: String, enum: ['pending', 'confirmed', 'rejected', 'cancelled'], default: 'pending' },
  },
  { timestamps: true }
);

registrationSchema.index({ tournament: 1, nicNo: 1 }, { unique: true });

module.exports = mongoose.model('Registration', registrationSchema);