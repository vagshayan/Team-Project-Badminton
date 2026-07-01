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

  const normalize = (value = '') => String(value).trim();
  const cleanedRoll = normalize(rollNumber).toUpperCase();
  const cleanedPartnerRoll = normalize(partnerRollNumber).toUpperCase();
  const cleanedName = normalize(playerName);
  const cleanedPartnerName = normalize(partnerName);
  const cleanedNic = normalize(nicNo).replace(/V/g, 'v');
  const cleanedAddress = normalize(address);
  const cleanedEmail = normalize(email);
  const cleanedPhone = normalize(phone);

  if (!tournament || !cleanedName || !cleanedNic || !cleanedAddress || !cleanedEmail || !cleanedPhone || !cleanedRoll || !department)
    return res.status(400).json({ message: 'All required fields must be filled' });

  const REG_NO_REGEX = /^20\d{2}\/[A-Z]{2,3}\/\d{3}$/;
  const OLD_NIC_REGEX = /^9\d{8}v$/;
  const NEW_NIC_REGEX = /^20\d{10}$/;
  const PHONE_REGEX = /^07\d{8}$/;
  const NAME_REGEX = /^(?!.* {2})[A-Za-z.]+(?: [A-Za-z.]+)*$/;
  const ADDRESS_REGEX = /^(?!.* {2})[A-Za-z0-9.,/ \-]+$/;
  const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

  if (!NAME_REGEX.test(cleanedName)) return res.status(400).json({ message: 'Full name must contain only letters, dots and single spaces.' });
  if (!REG_NO_REGEX.test(cleanedRoll)) return res.status(400).json({ message: 'Registration number must match 20XX/XX/XXX or 20XX/XXX/XXX format.' });
  if (!OLD_NIC_REGEX.test(cleanedNic) && !NEW_NIC_REGEX.test(cleanedNic)) return res.status(400).json({ message: 'NIC must be old format 991234567v or new format 200012345678.' });
  if (!ADDRESS_REGEX.test(cleanedAddress)) return res.status(400).json({ message: 'Address contains invalid characters.' });
  if (!EMAIL_REGEX.test(cleanedEmail)) return res.status(400).json({ message: 'Email must be valid.' });
  if (!PHONE_REGEX.test(cleanedPhone)) return res.status(400).json({ message: 'Phone must begin with 07 and be 10 digits.' });

  if (cleanedPartnerName || cleanedPartnerRoll) {
    if (!cleanedPartnerName) return res.status(400).json({ message: 'Partner name is required.' });
    if (!cleanedPartnerRoll) return res.status(400).json({ message: 'Partner registration number is required.' });
    if (!NAME_REGEX.test(cleanedPartnerName)) return res.status(400).json({ message: 'Partner name must contain only letters, dots and single spaces.' });
    if (!REG_NO_REGEX.test(cleanedPartnerRoll)) return res.status(400).json({ message: 'Partner registration number must match 20XX/XX/XXX or 20XX/XXX/XXX format.' });
    if (cleanedPartnerRoll === cleanedRoll) return res.status(400).json({ message: 'Partner registration number must be different from yours.' });
  }

  try {
    // 1. Get sport from tournament ID to find correct collection
    const mongoose = require('mongoose');
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

    const duplicate = await Registration.findOne({
      tournament,
      $or: [
        { rollNumber: cleanedRoll },
        { partnerRollNumber: cleanedRoll },
        { rollNumber: cleanedPartnerRoll },
        { partnerRollNumber: cleanedPartnerRoll },
      ].filter(Boolean)
    });

    if (duplicate) {
      const duplicateRoll = [cleanedRoll, cleanedPartnerRoll].find((candidate) =>
        candidate && (duplicate.rollNumber === candidate || duplicate.partnerRollNumber === candidate)
      );
      if (duplicateRoll) {
        const isPartnerDuplicate = duplicateRoll === cleanedPartnerRoll;
        const message = isPartnerDuplicate
          ? `This partner registration number is already registered for this tournament: ${duplicateRoll}`
          : `This registration number is already registered for this tournament: ${duplicateRoll}`;
        return res.status(400).json({ message });
      }
      return res.status(400).json({ message: 'Duplicate registration: one of these registration numbers is already enrolled in this tournament.' });
    }

    const nicExists = await Registration.findOne({ tournament, nicNo: cleanedNic });
    if (nicExists) return res.status(400).json({ message: `Duplicate registration: NIC ${cleanedNic} is already registered.` });

    const reg = await Registration.create({
      tournament,
      playerName: cleanedName,
      nicNo: cleanedNic,
      address: cleanedAddress,
      email: cleanedEmail,
      phone: cleanedPhone,
      rollNumber: cleanedRoll,
      department,
      year: year || 'N/A',
      partnerName: cleanedPartnerName || '',
      partnerRollNumber: cleanedPartnerRoll || '',
    });

    res.status(201).json(reg);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;