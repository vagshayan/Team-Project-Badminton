const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    sport: { type: String, required: true, enum: ['badminton', 'table-tennis', 'carrom'] },
    name: { type: String, required: true },
    securityQuestion: { type: String },
    securityAnswer: { type: String },
  },
  { timestamps: true }
);

adminSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  if (this.isModified('securityAnswer')) {
    this.securityAnswer = await bcrypt.hash(this.securityAnswer, 12);
  }
  next();
});

adminSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

adminSchema.methods.compareSecurityAnswer = async function (candidateAnswer) {
  return bcrypt.compare(candidateAnswer, this.securityAnswer);
};

module.exports = mongoose.model('Admin', adminSchema);