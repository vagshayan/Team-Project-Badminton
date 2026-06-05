const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { protect } = require('../middleware/auth');

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
      admin: { id: admin._id, username: admin.username, name: admin.name, sport: admin.sport },
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
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
      admin: { id: admin._id, username: admin.username, name: admin.name, sport: admin.sport },
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ message: 'Authentication Service Unavailable', details: err.message });
  }
});

// Get current admin
router.get('/me', protect, async (req, res) => {
  res.json(req.admin);
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

// Create admin (Postman use பண்ணு)
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
    res.json({ message: `Password reset successful for ${targetAdmin.username}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
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

module.exports = router;