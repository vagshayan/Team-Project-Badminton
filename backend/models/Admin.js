const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// AWS Moderate Password Policy Validation
const validatePasswordRequirements = (password) => {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*]/.test(password),
  };
  return Object.values(checks).every(check => check);
};

const adminSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    sport: { type: String, required: true, enum: ['badminton', 'table-tennis', 'carrom'] },
    name: { type: String, required: true },
    avatarUrl: { type: String },
    securityQuestion: { type: String },
    securityAnswer: { type: String },
  },
  { timestamps: true }
);

adminSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    if (!validatePasswordRequirements(this.password)) {
      return next(new Error('Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character (!@#$%^&*)'));
    }
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