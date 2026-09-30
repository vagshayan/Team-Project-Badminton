const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// AWS Moderate Password Policy Validation
const validatePasswordRequirements = (password) => {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password),
  };
  return Object.values(checks).every(check => check);
};

const adminSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, trim: true, lowercase: true, index: true },
    emailVerified: { type: Boolean, default: false },
    emailVerificationTokenHash: { type: String, select: false },
    emailVerificationExpiresAt: { type: Date, select: false },
    passwordResetOtpHash: { type: String, select: false },
    passwordResetOtpExpiresAt: { type: Date, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetTokenExpiresAt: { type: Date, select: false },
    password: { type: String, required: true },
    passwordChangedAt: { type: Date },
    sport: { type: String, required: true, enum: ['badminton', 'table-tennis', 'carrom'] },
    name: { type: String, required: true },
    role: { type: String, enum: ['admin', 'super_admin'], default: 'admin', required: true },
    avatarUrl: { type: String },
    securityQuestion: { type: String },
    securityAnswer: { type: String },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
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
  if (this.isModified('securityAnswer') && this.securityAnswer) {
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

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;
module.exports.Admin = Admin;
module.exports.validatePasswordRequirements = validatePasswordRequirements;