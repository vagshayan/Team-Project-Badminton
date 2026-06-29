const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');
const { getModelsForSport } = require('../models/SportModels');
const { protect } = require('../middleware/auth');

// Admin — view all registrations for the admin's sport
router.get('/admin', protect, async (req, res) => {
  try {
    const { Tournament, Registration } = getModelsForSport(req.admin.sport);
    const sportTournaments = await Tournament.find({ sport: req.admin.sport });
    const tournamentIds = sportTournaments.map(t => t._id);

    const registrations = await Registration.find({
      tournament: { $in: tournamentIds },
    }).populate('tournament').sort({ createdAt: -1 });
    
    res.json(registrations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update registration status
router.patch('/:id/status', protect, async (req, res) => {
  const { status } = req.body;
  if (!['pending', 'confirmed', 'rejected', 'cancelled'].includes(status))
    return res.status(400).json({ message: 'Invalid status' });

  try {
    const { Tournament, Registration, Player } = getModelsForSport(req.admin.sport);
    const reg = await Registration.findById(req.params.id).populate('tournament');
    if (!reg) return res.status(404).json({ message: 'Registration not found' });

    if (reg.tournament.sport !== req.admin.sport)
      return res.status(401).json({ message: 'Unauthorized' });

    // If rejecting, just update status (don't delete)
    if (status === 'rejected') {
      // First remove from Player table if they were previously approved
      await Player.findOneAndUpdate(
        { rollNumber: reg.rollNumber },
        { $pull: { tournamentHistory: reg.tournament._id } }
      );

      if (reg.partnerRollNumber) {
        await Player.findOneAndUpdate(
          { rollNumber: reg.partnerRollNumber },
          { $pull: { tournamentHistory: reg.tournament._id } }
        );
      }

      // Delete players if they have no tournament history left
      const p = await Player.findOne({ rollNumber: reg.rollNumber });
      if (p && p.tournamentHistory.length === 0) {
        await Player.deleteOne({ rollNumber: reg.rollNumber });
      }

      if (reg.partnerRollNumber) {
        const pt = await Player.findOne({ rollNumber: reg.partnerRollNumber });
        if (pt && pt.tournamentHistory.length === 0) await Player.deleteOne({ rollNumber: reg.partnerRollNumber });
      }

      // Update the registration status to rejected
      reg.status = 'rejected';
      await reg.save();

      return res.json({ message: 'Registration marked as rejected.' });
    }

    // For other status changes (pending, confirmed, cancelled)
    reg.status = status;
    await reg.save();

    if (status === 'confirmed') {
      await Player.findOneAndUpdate(
        { rollNumber: reg.rollNumber },
        {
          name: reg.playerName,
          nicNo: reg.nicNo,
          email: reg.email,
          phone: reg.phone,
          department: reg.department,
          $addToSet: { tournamentHistory: reg.tournament._id }
        },
        { upsert: true, new: true }
      );
      if (reg.partnerRollNumber) {
        await Player.findOneAndUpdate(
          { rollNumber: reg.partnerRollNumber },
          { name: reg.partnerName, $addToSet: { tournamentHistory: reg.tournament._id } },
          { upsert: true, new: true }
        );
      }
    } else if (status === 'pending') {
       // If changing from confirmed to pending, remove from Player table
       await Player.findOneAndUpdate(
         { rollNumber: reg.rollNumber },
         { $pull: { tournamentHistory: reg.tournament._id } }
       );

       if (reg.partnerRollNumber) {
         await Player.findOneAndUpdate(
           { rollNumber: reg.partnerRollNumber },
           { $pull: { tournamentHistory: reg.tournament._id } }
         );
       }

       // Delete players if they have no tournament history left
       const p = await Player.findOne({ rollNumber: reg.rollNumber });
       if (p && p.tournamentHistory.length === 0) {
         await Player.deleteOne({ rollNumber: reg.rollNumber });
       }

       if (reg.partnerRollNumber) {
          const pt = await Player.findOne({ rollNumber: reg.partnerRollNumber });
          if (pt && pt.tournamentHistory.length === 0) await Player.deleteOne({ rollNumber: reg.partnerRollNumber });
       }
    }

    res.json(reg);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin — view registrations for a tournament
router.get('/tournament/:tournamentId', protect, async (req, res) => {
  try {
    const { Registration } = getModelsForSport(req.admin.sport);
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
    tournament, playerName, nicNo, address, email, phone,
    rollNumber, department, year, partnerName, partnerRollNumber,
  } = req.body;

  if (!tournament || !playerName || !nicNo || !address || !email || !phone || !rollNumber || !department)
    return res.status(400).json({ message: 'All required fields must be filled' });

  try {
    // 1. Get sport from tournament ID to find correct collection
    const mongoose = require('mongoose');
    // We need to find which sport tournament this ID belongs to.
    // Since they are separated, we check all 3 tournament tables
    const sports = ['badminton', 'table-tennis', 'carrom'];
    let targetSport = null;
    let tournamentDoc = null;

    for (const s of sports) {
        const { Tournament } = getModelsForSport(s);
        const t = await Tournament.findById(tournament);
        if (t) { targetSport = s; tournamentDoc = t; break; }
    }

    if (!targetSport) return res.status(404).json({ message: 'Tournament not found' });
    if (tournamentDoc.isLocked) return res.status(400).json({ message: 'Registrations are closed for this tournament.' });

    const { Registration } = getModelsForSport(targetSport);

    // 2. Duplicate Check
    const playerExists = await Registration.findOne({
      tournament,
      $or: [{ rollNumber: rollNumber.trim() }, { partnerRollNumber: rollNumber.trim() }]
    });
    if (playerExists) return res.status(400).json({ message: `Registration Failed: ${rollNumber} is already participating.` });

    const nicExists = await Registration.findOne({
      tournament,
      nicNo: nicNo.trim()
    });
    if (nicExists) return res.status(400).json({ message: `Registration Failed: NIC ${nicNo.trim()} is already registered for this tournament.` });

    if (partnerRollNumber && partnerRollNumber.trim() !== "") {
      const pRoll = partnerRollNumber.trim();
      if (pRoll === rollNumber || pRoll === rollNumber.trim()) return res.status(400).json({ message: "Cannot partner with yourself." });
      const partnerExists = await Registration.findOne({
        tournament,
        $or: [{ rollNumber: pRoll }, { partnerRollNumber: pRoll }]
      });
      if (partnerExists) return res.status(400).json({ message: `Conflict: ${partnerName || pRoll} is already registered.` });
    }

    const reg = await Registration.create({
      tournament, playerName, nicNo, address, email, phone, rollNumber, department,
      year: year || 'N/A', partnerName: partnerName || '', partnerRollNumber: partnerRollNumber || '',
    });

    res.status(201).json(reg);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;