const express = require('express');
const router = express.Router();
const Registration = require('../models/Registration');
const Tournament = require('../models/Tournament');
const { protect } = require('../middleware/auth');

// Admin — view registrations for a tournament
router.get('/tournament/:tournamentId', protect, async (req, res) => {
  try {
    const registrations = await Registration.find({
      tournament: req.params.tournamentId,
    }).sort({ createdAt: -1 });
    res.json(registrations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Public — student registers
router.post('/', async (req, res) => {
  const {
    tournament,
    playerName,
    nicNo,
    address,
    email,
    phone,
    rollNumber,
    department,
    year,
    partnerName,
    partnerRollNumber,
  } = req.body;

  if (!tournament || !playerName || !nicNo || !address || !email || !phone || !rollNumber || !department)
    return res.status(400).json({ message: 'All required fields must be filled' });

  try {
    const t = await Tournament.findById(tournament);
    if (!t) return res.status(404).json({ message: 'Tournament not found' });

    const duplicate = await Registration.findOne({ tournament, rollNumber });
    if (duplicate)
      return res.status(400).json({ message: 'You are already registered for this tournament' });

    const reg = await Registration.create({
      tournament,
      playerName,
      nicNo,
      address,
      email,
      phone,
      rollNumber,
      department,
      year: year || 'N/A',
      partnerName: partnerName || '',
      partnerRollNumber: partnerRollNumber || '',
    });

    res.status(201).json(reg);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;