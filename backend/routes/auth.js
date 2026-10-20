const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Admin, validatePasswordRequirements } = require('../models/Admin');
const AuditLog = require('../models/AuditLog');
const { protect, requireSuperAdmin } = require('../middleware/auth');
const { logAdminAction } = require('../utils/auditLogger');
const { validateUploadFile, validateFileMagicBytes } = require('../utils/fileValidator');
const { sendVerificationEmail, sendPasswordResetOtpEmail, sendSecurityChangeEmail } = require('../utils/emailService');
const { loginLimiter, forgotPasswordLimiter, resetPasswordLimiter, resendVerificationLimiter, passwordResetResendLimiter } = require('../middleware/rateLimiter');

const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

// Use memory storage for validation before saving
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Validation will happen after multer processes the file in the route handler
    cb(null, true);
  },
});

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_ACCESS_CODE = process.env.ADMIN_ACCESS_CODE.trim();

const generateToken = (id) =>
  jwt.sign({ id }, JWT_SECRET, { expiresIn: '7d' });

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const createVerificationToken = () => crypto.randomBytes(32).toString('hex');
const createPasswordResetOtp = () => String(crypto.randomInt(100000, 1000000));
const verificationExpiry = () => new Date(Date.now() + 15 * 60 * 1000);
const passwordResetOtpExpiry = () => new Date(Date.now() + 10 * 60 * 1000);
const passwordResetTokenExpiry = () => new Date(Date.now() + 10 * 60 * 1000);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const frontendUrl = () => process.env.FRONTEND_URL || process.env.CLIENT_ORIGIN || 'http://localhost:3000';

const migrateLegacyAvatar = async (admin) => {
  if (typeof admin.avatarUrl !== 'string' || !admin.avatarUrl.startsWith('/uploads/')) return;

  const filePath = path.join(uploadDir, path.basename(admin.avatarUrl));
  try {
    if (!fs.existsSync(filePath)) return;
    const buffer = fs.readFileSync(filePath);
    const mimeType = validateFileMagicBytes(buffer);
    if (!mimeType || buffer.length > 5 * 1024 * 1024) return;

    admin.avatarUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
    await admin.save();
    try { fs.unlinkSync(filePath); } catch (e) { /* ignore local cleanup failures */ }
  } catch (err) {
    console.error('Legacy avatar migration failed:', err.message);
  }
};

// Register
router.post('/register', async (req, res) => {
  const { username, email, password, sport, name, securityQuestion, securityAnswer, accessCode } = req.body;
  if (!username || !email || !password || !sport || !name || !securityQuestion || !securityAnswer)
    return res.status(400).json({ message: 'All fields are required' });
  if (!emailPattern.test(email.trim())) return res.status(400).json({ message: 'A valid email address is required' });

  const submittedCode = String(accessCode || '').trim();
  if (!submittedCode || submittedCode !== ADMIN_ACCESS_CODE) {
    return res.status(403).json({ message: 'Access restricted. Admin onboarding code is required.' });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await Admin.findOne({ $or: [{ username: username.trim() }, { email: normalizedEmail }] });
    if (existing) return res.status(400).json({ message: 'Username or email already taken' });

    const verificationToken = createVerificationToken();
    const admin = await Admin.create({
      username: username.trim(), email: normalizedEmail, password, sport, name, securityQuestion, securityAnswer,
      emailVerified: false,
      emailVerificationTokenHash: hashToken(verificationToken),
      emailVerificationExpiresAt: verificationExpiry(),
    });

    try {
      await sendVerificationEmail(admin.email, verificationToken);
    } catch (emailError) {
      await Admin.deleteOne({ _id: admin._id });
      console.error('Verification email delivery failed:', emailError.message);
      return res.status(503).json({ message: 'Registration is temporarily unavailable. Please try again later.' });
    }

    res.status(201).json({ message: 'Registration successful. Check your email to verify your account.' });
  } catch (err) {
    res.status(400).json({ message: 'Registration failed' });
  }
});

// Login (with rate limiting: 5 attempts per 15 minutes)
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: 'Username and password required' });
  try {
    const admin = await Admin.findOne({ username: username.trim(), isDeleted: { $ne: true } });
    if (!admin) return res.status(401).json({ message: 'Invalid username or password' });
    if (!admin.emailVerified) return res.status(403).json({ message: 'Please verify your email before logging in.' });
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid username or password' });
    res.json({
      token: generateToken(admin._id),
      admin: { id: admin._id, username: admin.username, name: admin.name, sport: admin.sport, avatarUrl: admin.avatarUrl },
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ message: 'Authentication Service Unavailable' });
  }
});

// Verify email without returning or exposing the verification token.
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token || typeof token !== 'string') return res.redirect(`${frontendUrl()}/admin/login?verification=invalid`);
  try {
    const admin = await Admin.findOne({
      emailVerificationTokenHash: hashToken(token),
      emailVerificationExpiresAt: { $gt: new Date() },
    }).select('+emailVerificationTokenHash +emailVerificationExpiresAt');
    if (!admin) return res.redirect(`${frontendUrl()}/admin/login?verification=invalid`);
    admin.emailVerified = true;
    admin.emailVerificationTokenHash = undefined;
    admin.emailVerificationExpiresAt = undefined;
    await admin.save();
    return res.redirect(`${frontendUrl()}/admin/login?verification=success`);
  } catch (err) {
    return res.redirect(`${frontendUrl()}/admin/login?verification=invalid`);
  }
});

// Use a neutral response so pending accounts cannot be enumerated.
router.post('/resend-verification', resendVerificationLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (emailPattern.test(email)) {
    try {
      const admin = await Admin.findOne({ email });
      if (admin && !admin.emailVerified) {
        const verificationToken = createVerificationToken();
        admin.emailVerificationTokenHash = hashToken(verificationToken);
        admin.emailVerificationExpiresAt = verificationExpiry();
        await admin.save();
        await sendVerificationEmail(admin.email, verificationToken);
      }
    } catch (err) {
      console.error('Resend verification failed:', err.message);
    }
  }
  return res.status(202).json({ message: 'If the account is pending verification, a new email will be sent.' });
});

// Get current admin - return only essential fields (PII minimization)
router.get('/me', async (req, res) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.json(null);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const admin = await Admin.findOne({ _id: decoded.id, isDeleted: { $ne: true } }).select('id username email emailVerified name sport avatarUrl role securityQuestion createdAt passwordChangedAt');
    if (!admin) return res.json(null);
    if (admin.emailVerified !== true) return res.json(null);
    await migrateLegacyAvatar(admin);
    // Return minimal fields only (no password, no internal details)
    return res.json({
      id: admin._id,
      username: admin.username,
      email: admin.email,
      emailVerified: admin.emailVerified,
      name: admin.name,
      sport: admin.sport,
      avatarUrl: admin.avatarUrl,
      role: admin.role || 'admin',
      securityQuestion: admin.securityQuestion || '',
      createdAt: admin.createdAt,
      passwordChangedAt: admin.passwordChangedAt,
    });
  } catch (err) {
    console.error('Auth /me lookup failed:', err && err.message ? err.message : err);
    return res.json(null);
  }
});

// Permanently disable the current admin account while preserving audit references.
router.delete('/me', protect, async (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ message: 'Password is required to delete your account' });

  try {
    const admin = await Admin.findById(req.admin._id).select('+password');
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    if (!(await admin.comparePassword(password))) return res.status(401).json({ message: 'Incorrect password' });

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await logAdminAction({
          action: 'DELETE_ACCOUNT',
          targetId: admin._id,
          targetModel: 'Admin',
          details: { deletedAdminUsername: admin.username, deletedAdminSport: admin.sport },
          req,
          session,
        });

        admin.username = `deleted-${admin._id}`;
        admin.email = undefined;
        admin.emailVerified = false;
        admin.password = `Deleted-${crypto.randomBytes(32).toString('hex')}!A9`;
        admin.name = 'Deleted Account';
        admin.avatarUrl = undefined;
        admin.securityQuestion = undefined;
        admin.securityAnswer = undefined;
        admin.isDeleted = true;
        admin.deletedAt = new Date();
        await admin.save({ session });
      });
    } finally {
      await session.endSession();
    }

    return res.json({ message: 'Your account has been deleted successfully.' });
  } catch (err) {
    console.error('Account deletion error:', err.message);
    return res.status(500).json({ message: 'Unable to delete account' });
  }
});

// Upload current admin avatar
router.post('/me/avatar', protect, upload.single('avatar'), async (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ message: 'No avatar file uploaded' });
  }

  try {
    // Validate file using magic bytes instead of trusting browser-supplied MIME type
    const validation = validateUploadFile(req.file, req.file.buffer);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.error });
    }

    const admin = await Admin.findById(req.admin._id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });

    const previousAvatarUrl = admin.avatarUrl;
    admin.avatarUrl = `data:${validation.mimeType};base64,${req.file.buffer.toString('base64')}`;
    await admin.save();

    // Remove a legacy local copy after the shared database save succeeds.
    if (previousAvatarUrl && previousAvatarUrl.startsWith('/uploads/')) {
      const oldFilePath = path.join(uploadDir, path.basename(previousAvatarUrl));
      if (fs.existsSync(oldFilePath)) {
        try { fs.unlinkSync(oldFilePath); } catch (e) { /* ignore local cleanup failures */ }
      }
    }

    res.json({ avatarUrl: admin.avatarUrl });
  } catch (err) {
    console.error('Upload avatar error:', err);
    res.status(500).json({ message: 'Unable to upload avatar' });
  }
});

// Remove current admin avatar
router.delete('/me/avatar', protect, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });

    if (admin.avatarUrl && admin.avatarUrl.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '..', admin.avatarUrl.replace(/^\//, ''));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    admin.avatarUrl = '';
    await admin.save();

    res.json({ avatarUrl: '' });
  } catch (err) {
    console.error('Remove avatar error:', err);
    res.status(500).json({ message: 'Unable to remove avatar' });
  }
});

// Update current admin profile
router.put('/me', protect, async (req, res) => {
  const { username, name } = req.body;
  if (!username || !name) {
    return res.status(400).json({ message: 'Username and name are required' });
  }

  try {
    const existing = await Admin.findOne({ username: username.trim(), _id: { $ne: req.admin._id } });
    if (existing) return res.status(400).json({ message: 'Username already taken' });

    const admin = await Admin.findById(req.admin._id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });

    admin.username = username.trim();
    admin.name = name.trim();
    await admin.save();

    // Return minimal fields (PII minimization)
    res.json({
      id: admin._id,
      username: admin.username,
      name: admin.name,
      sport: admin.sport,
      avatarUrl: admin.avatarUrl,
      role: admin.role || 'admin',
      email: admin.email,
      emailVerified: admin.emailVerified,
      securityQuestion: admin.securityQuestion || '',
      createdAt: admin.createdAt,
      passwordChangedAt: admin.passwordChangedAt,
    });
  } catch (err) {
    console.error('Update admin profile error:', err);
    res.status(500).json({ message: 'Unable to update profile' });
  }
});

// Change current admin password
router.put('/me/password', protect, async (req, res) => {
  const { newPassword, confirmPassword } = req.body;
  if (!newPassword || !confirmPassword) {
    return res.status(400).json({ message: 'New password and confirmation are required' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: 'New password and confirmation do not match.' });
  }
  if (!validatePasswordRequirements(newPassword)) {
    return res.status(400).json({ message: 'New password must be at least 8 characters long and include uppercase, lowercase, a number, and a special character.' });
  }
  try {
    const admin = await Admin.findById(req.admin._id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });

    admin.password = newPassword;
    admin.passwordChangedAt = new Date();
    await admin.save();
    try {
      await sendSecurityChangeEmail({ email: admin.email, username: admin.username, changeType: 'Password' });
    } catch (emailError) {
      console.error('Password change notification failed:', emailError.message);
    }

    res.json({ message: 'Password changed successfully', passwordChangedAt: admin.passwordChangedAt });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ message: 'Unable to update password' });
  }
});

// Get all admins
router.get('/admins', protect, requireSuperAdmin, async (req, res) => {
  try {
    const admins = await Admin.find({ isDeleted: { $ne: true } }).select('id username email emailVerified name sport role securityQuestion');
    res.json(admins);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create admin 
router.post('/create-admin', protect, requireSuperAdmin, async (req, res) => {
  const { username, password, sport, name, securityQuestion, securityAnswer } = req.body;
  try {
    const existing = await Admin.findOne({ username });
    if (existing) return res.status(400).json({ message: 'Username already exists' });

    const admin = await Admin.create({ username, password, sport, name, securityQuestion, securityAnswer, role: 'admin' });
    res.status(201).json({ id: admin._id, username: admin.username, name: admin.name, sport: admin.sport, role: admin.role });
  } catch (err) {
    res.status(400).json({ message: 'Failed to create admin' });
  }
});

// Reset password
router.post('/reset-password', protect, async (req, res) => {
  const { currentPassword, newPassword, targetAdminId } = req.body;
  try {
    const currentAdmin = await Admin.findById(req.admin._id);
    const isMatch = await currentAdmin.comparePassword(currentPassword);
    if (!isMatch) return res.status(401).json({ message: 'Your current password is incorrect' });

    const targetId = targetAdminId || req.admin._id;
    const isSelfReset = targetId.toString() === req.admin._id.toString();

    if (!isSelfReset && req.admin.role !== 'super_admin') {
      return res.status(403).json({ message: 'Forbidden: only a super-admin can reset another administrator password' });
    }

    const targetAdmin = await Admin.findById(targetId);
    if (!targetAdmin) return res.status(404).json({ message: 'Target admin not found' });
    targetAdmin.password = newPassword;
    targetAdmin.passwordChangedAt = new Date();
    await targetAdmin.save();

    await logAdminAction({
      adminId: req.admin._id,
      action: 'RESET_ADMIN_PASSWORD',
      targetId: targetAdmin._id,
      targetModel: 'Admin',
      details: {
        targetAdminId: targetAdmin._id,
        targetUsername: targetAdmin.username,
        requestedBy: req.admin._id,
        selfReset: isSelfReset,
      },
      req,
    });

    res.json({ message: `Password reset successful for ${targetAdmin.username}` });
  } catch (err) {
    res.status(400).json({ message: 'Password reset failed' });
  }
});

// Request a password reset OTP by registered email.
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email || !emailPattern.test(email)) return res.status(400).json({ message: 'A valid registered email address is required' });
  try {
    const admin = await Admin.findOne({ email, emailVerified: true, isDeleted: { $ne: true } }).select('+passwordResetOtpHash +passwordResetOtpExpiresAt');
    if (admin) {
      const otp = createPasswordResetOtp();
      admin.passwordResetOtpHash = hashToken(otp);
      admin.passwordResetOtpExpiresAt = passwordResetOtpExpiry();
      admin.passwordResetTokenHash = undefined;
      admin.passwordResetTokenExpiresAt = undefined;
      await admin.save();
      try {
        await sendPasswordResetOtpEmail(admin.email, otp);
      } catch (emailError) {
        admin.passwordResetOtpHash = undefined;
        admin.passwordResetOtpExpiresAt = undefined;
        await admin.save();
        console.error('Password reset OTP delivery failed:', emailError.message);
        return res.status(503).json({ message: 'Unable to send the verification code. Please try again later.' });
      }
    }
    res.status(202).json({ message: 'If the email is registered, a verification code has been sent.' });
  } catch (err) {
    res.status(500).json({ message: 'Unable to send verification code' });
  }
});

// Resend a password reset OTP.
router.post('/forgot-password/resend', passwordResetResendLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email || !emailPattern.test(email)) return res.status(400).json({ message: 'A valid email address is required' });
  try {
    const admin = await Admin.findOne({ email, emailVerified: true, isDeleted: { $ne: true } }).select('+passwordResetOtpHash +passwordResetOtpExpiresAt');
    if (admin) {
      const otp = createPasswordResetOtp();
      admin.passwordResetOtpHash = hashToken(otp);
      admin.passwordResetOtpExpiresAt = passwordResetOtpExpiry();
      admin.passwordResetTokenHash = undefined;
      admin.passwordResetTokenExpiresAt = undefined;
      await admin.save();
      await sendPasswordResetOtpEmail(admin.email, otp);
    }
    res.status(202).json({ message: 'If the email is registered, a new verification code has been sent.' });
  } catch (err) {
    console.error('Password reset OTP resend failed:', err.message);
    res.status(500).json({ message: 'Unable to resend verification code' });
  }
});

// Verify the password reset OTP and issue a short-lived reset token.
router.post('/forgot-password/verify-otp', resetPasswordLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const otp = String(req.body?.otp || '').trim();
  if (!email || !emailPattern.test(email) || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ message: 'A valid email address and 6-digit verification code are required' });
  }
  try {
    const admin = await Admin.findOne({
      email,
      emailVerified: true,
      isDeleted: { $ne: true },
      passwordResetOtpExpiresAt: { $gt: new Date() },
    }).select('+passwordResetOtpHash +passwordResetOtpExpiresAt +passwordResetTokenHash +passwordResetTokenExpiresAt');
    if (!admin || !admin.passwordResetOtpHash || !crypto.timingSafeEqual(Buffer.from(admin.passwordResetOtpHash), Buffer.from(hashToken(otp)))) {
      return res.status(401).json({ message: 'Invalid or expired verification code' });
    }
    const resetToken = createVerificationToken();
    admin.passwordResetOtpHash = undefined;
    admin.passwordResetOtpExpiresAt = undefined;
    admin.passwordResetTokenHash = hashToken(resetToken);
    admin.passwordResetTokenExpiresAt = passwordResetTokenExpiry();
    await admin.save();
    res.json({ message: 'Verification code accepted', resetToken });
  } catch (err) {
    res.status(400).json({ message: 'Unable to verify code' });
  }
});

// Reset password after successful OTP verification.
router.post('/reset-forgot-password', resetPasswordLimiter, async (req, res) => {
  const { email, resetToken, newPassword } = req.body;
  if (!email || !resetToken || !newPassword) return res.status(400).json({ message: 'Email, reset token, and new password are required' });
  if (!validatePasswordRequirements(newPassword)) return res.status(400).json({ message: 'New password must be at least 8 characters long and include uppercase, lowercase, a number, and a special character.' });
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const admin = await Admin.findOne({
      email: normalizedEmail,
      emailVerified: true,
      isDeleted: { $ne: true },
      passwordResetTokenExpiresAt: { $gt: new Date() },
    }).select('+passwordResetTokenHash +passwordResetTokenExpiresAt');
    if (!admin || admin.passwordResetTokenHash !== hashToken(resetToken)) return res.status(401).json({ message: 'Reset session is invalid or expired' });
    admin.password = newPassword;
    admin.passwordChangedAt = new Date();
    admin.passwordResetTokenHash = undefined;
    admin.passwordResetTokenExpiresAt = undefined;
    await admin.save(); // pre-save hook will bcrypt the new password
    res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (err) {
    res.status(400).json({ message: 'Password reset failed' });
  }
});

// Update security question
router.post('/update-security-question', protect, async (req, res) => {
  const { securityQuestion, securityAnswer } = req.body;
  if (!securityQuestion || !securityAnswer)
    return res.status(400).json({ message: 'Security question and answer are required' });
  try {
    const admin = await Admin.findById(req.admin._id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    admin.securityQuestion = securityQuestion.trim();
    admin.securityAnswer = securityAnswer.trim();
    await admin.save();
    try {
      await sendSecurityChangeEmail({ email: admin.email, username: admin.username, changeType: 'Security question' });
    } catch (emailError) {
      console.error('Security question notification failed:', emailError.message);
    }
    res.json({ message: 'Security question updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Unable to update security question' });
  }
});

// Delete Admin — password required
router.delete('/delete/:id', protect, requireSuperAdmin, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ message: 'Password is required to delete admin account' });
  try {
    const currentAdmin = await Admin.findById(req.admin._id);
    if (!currentAdmin) return res.status(404).json({ message: 'Current admin not found' });

    // Verify password
    const isMatch = await currentAdmin.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Incorrect password' });

    // Find admin to delete
    const adminToDelete = await Admin.findById(req.params.id);
    if (!adminToDelete) return res.status(404).json({ message: 'Admin not found' });

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const existingAudit = await AuditLog.exists({ admin: adminToDelete._id }).session(session);
        if (existingAudit) {
          const error = new Error('This admin cannot be deleted because audit logs reference the account.');
          error.statusCode = 409;
          throw error;
        }

        await logAdminAction({
          action: 'DELETE_ADMIN',
          targetId: adminToDelete._id,
          targetModel: 'Admin',
          details: {
            deletedAdminUsername: adminToDelete.username,
            deletedAdminName: adminToDelete.name,
            deletedAdminSport: adminToDelete.sport,
            deletedBy: req.admin.username,
          },
          req,
          session,
        });

        await Admin.deleteOne({ _id: adminToDelete._id }, { session });
      });
    } finally {
      await session.endSession();
    }

    res.json({ message: `Admin ${adminToDelete.username} has been deleted successfully` });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

module.exports = router;