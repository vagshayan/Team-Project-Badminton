const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { protect } = require('../middleware/auth');
const { logAdminAction } = require('../utils/auditLogger');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET || 'SuperSecret_TournamentApp_2024', { expiresIn: '7d' });

// Register
router.post('/register', async (req, res) => {
  const { username, password, sport, name, securityQuestion, securityAnswer } = req.body;
  if (!username || !password || !sport || !name || !securityQuestion || !securityAnswer)
    return res.status(400).json({ message: 'All fields are required' });
  try {
    const existing = await Admin.findOne({ username: username.trim() });
    if (existing) return res.status(400).json({ message: 'Username already taken' });
    
    

    const admin = await Admin.create({ username: username.trim(), password, sport, name, securityQuestion, securityAnswer });
    res.status(201).json({
      token: generateToken(admin._id),
      admin: { id: admin._id, username: admin.username, name: admin.name, sport: admin.sport, avatarUrl: admin.avatarUrl },
    });
  } catch (err) {
    const errorMsg = err.message || 'Registration failed';
    res.status(400).json({ message: errorMsg });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: 'Username and password required' });
  try {
    const admin = await Admin.findOne({ username: username.trim() });
    if (!admin) return res.status(401).json({ message: 'Invalid username or password' });
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid username or password' });
    res.json({
      token: generateToken(admin._id),
      admin: { id: admin._id, username: admin.username, name: admin.name, sport: admin.sport, avatarUrl: admin.avatarUrl },
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ message: 'Authentication Service Unavailable', details: err.message });
  }
});

// Get current admin
router.get('/me', async (req, res) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.json(null);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'SuperSecret_TournamentApp_2024');
    const admin = await Admin.findById(decoded.id).select('-password');
    return res.json(admin || null);
  } catch (err) {
    console.error('Auth /me lookup failed:', err && err.message ? err.message : err);
    return res.json(null);
  }
});

// Update current admin profile
router.put('/me', protect, async (req, res) => {
  const { username, name, avatarUrl } = req.body;
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
    admin.avatarUrl = avatarUrl ? avatarUrl.trim() : admin.avatarUrl;
    await admin.save();

    res.json({ id: admin._id, username: admin.username, name: admin.name, sport: admin.sport, avatarUrl: admin.avatarUrl });
  } catch (err) {
    console.error('Update admin profile error:', err);
    res.status(500).json({ message: 'Unable to update profile' });
  }cls
});

// Change current admin password
router.put('/me/password', protect, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: 'Current password, new password, and confirmation are required' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: 'New passwords do not match' });
  }

  try {
    const admin = await Admin.findById(req.admin._id);
    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) return res.status(401).json({ message: 'Current password is incorrect' });

    admin.password = newPassword;
    await admin.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ message: 'Unable to update password' });
  }
});

// Get all admins
router.get('/admins', protect, async (req, res) => {
  try {
    const admins = await Admin.find().select('-password');
    res.json(admins);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create admin 
router.post('/create-admin', protect, async (req, res) => {
  const { username, password, sport, name, securityQuestion, securityAnswer } = req.body;
  try {
    const existing = await Admin.findOne({ username });
    if (existing) return res.status(400).json({ message: 'Username already exists' });

    
    const admin = await Admin.create({ username, password, sport, name, securityQuestion, securityAnswer });
    res.status(201).json({ id: admin._id, username: admin.username, name: admin.name, sport: admin.sport });
  } catch (err) {
    res.status(400).json({ message: err.message });
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
    const targetAdmin = await Admin.findById(targetId);
    if (!targetAdmin) return res.status(404).json({ message: 'Target admin not found' });
    targetAdmin.password = newPassword;
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
        selfReset: targetAdmin._id.toString() === req.admin._id.toString(),
      },
      req,
    });

    res.json({ message: `Password reset successful for ${targetAdmin.username}` });
  } catch (err) {
    const errorMsg = err.message || 'Password reset failed';
    res.status(400).json({ message: errorMsg });
  }
});

// Forgot password - get security question
router.post('/forgot-password', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ message: 'Username is required' });
  try {
    const admin = await Admin.findOne({ username: username.trim() });
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    res.json({ securityQuestion: admin.securityQuestion });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Reset password via security question (no token required — public endpoint)
router.post('/reset-forgot-password', async (req, res) => {
  const { username, securityAnswer, newPassword } = req.body;
  if (!username || !securityAnswer || !newPassword)
    return res.status(400).json({ message: 'All fields are required' });
  try {
    const admin = await Admin.findOne({ username: username.trim() });
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    if (!admin.securityAnswer)
      return res.status(400).json({ message: 'No security question set for this account' });
    const isMatch = await admin.compareSecurityAnswer(securityAnswer.trim());
    if (!isMatch)
      return res.status(401).json({ message: 'Incorrect answer to security question' });
    admin.password = newPassword;
    await admin.save(); // pre-save hook will bcrypt the new password
    res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (err) {
    const errorMsg = err.message || 'Password reset failed';
    res.status(400).json({ message: errorMsg });
  }
});

// Update security question
router.post('/update-security-question', protect, async (req, res) => {
  const { currentPassword, securityQuestion, securityAnswer } = req.body;
  if (!currentPassword || !securityQuestion || !securityAnswer)
    return res.status(400).json({ message: 'All fields are required' });
  try {
    const admin = await Admin.findById(req.admin._id);
    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) return res.status(401).json({ message: 'Current password is incorrect' });
    admin.securityQuestion = securityQuestion;
    admin.securityAnswer = securityAnswer;
    await admin.save();
    res.json({ message: 'Security question updated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete Admin — password required
router.delete('/delete/:id', protect, async (req, res) => {
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

    // Log the deletion action
    await logAdminAction({
      adminId: req.admin._id,
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
    });

    // Delete the admin
    await Admin.findByIdAndDelete(req.params.id);

    res.json({ message: `Admin ${adminToDelete.username} has been deleted successfully` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;