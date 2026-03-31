const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');
const Tournament = require('../models/Tournament');
const { protect } = require('../middleware/auth');

// Public — students view
router.get('/public/:sport', async (req, res) => {
  try {
    const tournaments = await Tournament.find({ sport: req.params.sport, isActive: true })
      .populate('createdBy', 'name')
      .sort({ date: 1 });
    res.json(tournaments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin — own sport only
router.get('/admin', protect, async (req, res) => {
  try {
    const tournaments = await Tournament.find({ sport: req.admin.sport })
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
    res.json(tournaments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create
router.post('/', protect, async (req, res) => {
  const { year, date, time, venue, category } = req.body;
  const currentYear = new Date().getFullYear();
  if (year < currentYear) return res.status(400).json({ message: 'Year cannot be in the past' });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (new Date(date) < today) return res.status(400).json({ message: 'Date cannot be in the past' });
  try {
    const tournament = await Tournament.create({
      sport: req.admin.sport, year, date, time, venue, category, createdBy: req.admin._id,
    });
    res.status(201).json(tournament);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update — password required
router.put('/:id', protect, async (req, res) => {
  const { password, year, date, time, venue, category } = req.body;
  if (!password) return res.status(400).json({ message: 'Password is required to update' });
  try {
    const admin = await Admin.findById(req.admin._id);
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Incorrect password' });
    const currentYear = new Date().getFullYear();
    if (year < currentYear) return res.status(400).json({ message: 'Year cannot be in the past' });
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (new Date(date) < today) return res.status(400).json({ message: 'Date cannot be in the past' });
    const tournament = await Tournament.findOneAndUpdate(
      { _id: req.params.id, sport: req.admin.sport },
      { year, date, time, venue, category },
      { new: true }
    );
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
    res.json(tournament);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete — password required
router.delete('/:id', protect, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ message: 'Password is required to delete' });
  try {
    const admin = await Admin.findById(req.admin._id);
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Incorrect password' });
    const tournament = await Tournament.findOneAndDelete({ _id: req.params.id, sport: req.admin.sport });
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
    res.json({ message: 'Tournament deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;