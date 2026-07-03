const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');
const { getModelsForSport } = require('../models/SportModels');
const { protect } = require('../middleware/auth');

// Admin — view all registrations for the admin's sport
router.get('/admin', protect, async (req, res) => {
  try {
    const { Tournament, Registration } = getModelsForSport(req.admin.sport);
    const sportTournaments = await Tournament.find({ createdBy: req.admin._id });
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

    if (reg.tournament.createdBy.toString() !== req.admin._id.toString())
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
    rollNumber, department, year, partnerName, partnerRollNumber, gender,
    havePartner, partnerNIC, partnerEmail, partnerPhone, partnerDepartment, partnerAddress, partnerGender,
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
<<<<<<< HEAD
=======
  const cleanedGender = String(gender || '').trim();
>>>>>>> 32dff5c (Add pair approval and dashboard updates)

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

<<<<<<< HEAD
=======
  if (cleanedGender && !['Male', 'Female', 'Other'].includes(cleanedGender)) return res.status(400).json({ message: 'Invalid gender value.' });

>>>>>>> 32dff5c (Add pair approval and dashboard updates)
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
    const { Pair, PartnerRequest } = getModelsForSport(targetSport);

<<<<<<< HEAD
    const duplicateChecks = [
      { rollNumber: cleanedRoll },
      { partnerRollNumber: cleanedRoll },
    ];

    if (cleanedPartnerRoll) {
      duplicateChecks.push(
        { rollNumber: cleanedPartnerRoll },
        { partnerRollNumber: cleanedPartnerRoll }
      );
    }

    const duplicate = await Registration.findOne({
      tournament,
      $or: duplicateChecks
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

=======
    const existingPlayer = await Registration.findOne({ tournament, rollNumber: cleanedRoll });
    if (existingPlayer) {
      return res.status(400).json({ message: `This registration number is already registered for this tournament: ${cleanedRoll}` });
    }

    const nicExists = await Registration.findOne({ tournament, nicNo: cleanedNic });
    if (nicExists) return res.status(400).json({ message: `Duplicate registration: NIC ${cleanedNic} is already registered.` });
    // Handle partner selection flows
    // 1) User does not have a partner -> register as looking
    const tournCategory = (tournamentDoc.category || '').toLowerCase();
    const isDoublesCategory = tournCategory.includes('doubles') || tournCategory.includes('mixed');

    if (tournCategory.includes('mixed') && (!cleanedGender || !['Male','Female'].includes(cleanedGender))) {
      return res.status(400).json({ message: 'Gender is required for mixed doubles.' });
    }

    if (havePartner === 'no' || havePartner === false) {
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
        partnerName: '',
        partnerRollNumber: '',
        partnerStatus: 'looking',
        pairStatus: 'incomplete',
        gender: tournCategory.includes('doubles-women') ? 'Female' : (tournCategory.includes('doubles-men') ? 'Male' : (cleanedGender || 'Male')),
      });
      return res.status(201).json(reg);
    }

    // 2) User has a partner and provided partner registration number
    if (havePartner === 'yes' && cleanedPartnerRoll) {
      // Check if partner exists in same tournament
      const partnerReg = await Registration.findOne({ tournament, rollNumber: cleanedPartnerRoll });
      if (partnerReg) {
        if (!(partnerReg.partnerStatus === 'looking' && partnerReg.pairStatus === 'incomplete')) {
          return res.status(400).json({ message: 'Partner registration number already exists.' });
        }
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
          partnerName: partnerReg.playerName || '',
          partnerRollNumber: cleanedPartnerRoll,
          partnerStatus: 'requested',
          pairStatus: 'incomplete',
          gender: tournCategory.includes('doubles-women') ? 'Female' : (tournCategory.includes('doubles-men') ? 'Male' : (cleanedGender || 'Male')),
        });

        await PartnerRequest.create({
          tournament,
          requesterRegistration: reg._id,
          requesterRollNumber: cleanedRoll,
          targetRegistration: partnerReg._id,
          targetRollNumber: cleanedPartnerRoll,
        });

        return res.status(201).json({ message: 'Partner request sent.', registration: reg });
      }

      // Partner not registered — require full partner details
      if (!partnerNIC || !partnerEmail || !partnerPhone || !partnerDepartment || !partnerAddress || !partnerGender) {
        return res.status(400).json({ message: 'Full partner details are required when partner is not already registered.' });
      }

      const cleanedPartnerNIC = String(partnerNIC).trim().replace(/V/g, 'v');
      const cleanedPartnerEmail = String(partnerEmail).trim();
      const cleanedPartnerPhone = String(partnerPhone).trim();
      const cleanedPartnerAddress = String(partnerAddress).trim();
      const cleanedPartnerDept = String(partnerDepartment).trim();
      const cleanedPartnerGender = String(partnerGender).trim();

      if (!NAME_REGEX.test(cleanedPartnerName)) return res.status(400).json({ message: 'Partner name must contain only letters, dots and single spaces.' });
      if (!REG_NO_REGEX.test(cleanedPartnerRoll)) return res.status(400).json({ message: 'Partner registration number must match 20XX/XX/XXX or 20XX/XXX/XXX format.' });
      if (!OLD_NIC_REGEX.test(cleanedPartnerNIC) && !NEW_NIC_REGEX.test(cleanedPartnerNIC)) return res.status(400).json({ message: 'Partner NIC must be old format 991234567v or new format 200012345678.' });
      if (!ADDRESS_REGEX.test(cleanedPartnerAddress)) return res.status(400).json({ message: 'Partner address contains invalid characters.' });
      if (!EMAIL_REGEX.test(cleanedPartnerEmail)) return res.status(400).json({ message: 'Partner email must be valid.' });
      if (!PHONE_REGEX.test(cleanedPartnerPhone)) return res.status(400).json({ message: 'Partner phone must begin with 07 and be 10 digits.' });

      // Create both registrations and mark as paired
      const regA = await Registration.create({
        tournament,
        playerName: cleanedName,
        nicNo: cleanedNic,
        address: cleanedAddress,
        email: cleanedEmail,
        phone: cleanedPhone,
        rollNumber: cleanedRoll,
        department,
        year: year || 'N/A',
        partnerName: cleanedPartnerName,
        partnerRollNumber: cleanedPartnerRoll,
        partnerStatus: 'paired',
        pairStatus: 'complete',
        gender: tournCategory.includes('doubles-women') ? 'Female' : (tournCategory.includes('doubles-men') ? 'Male' : (cleanedGender || 'Male')),
      });

      const regB = await Registration.create({
        tournament,
        playerName: cleanedPartnerName,
        nicNo: cleanedPartnerNIC,
        address: cleanedPartnerAddress,
        email: cleanedPartnerEmail,
        phone: cleanedPartnerPhone,
        rollNumber: cleanedPartnerRoll,
        department: cleanedPartnerDept,
        year: 'N/A',
        partnerName: cleanedName,
        partnerRollNumber: cleanedRoll,
        partnerStatus: 'paired',
        pairStatus: 'complete',
        gender: tournCategory.includes('doubles-women') ? 'Female' : (tournCategory.includes('doubles-men') ? 'Male' : cleanedPartnerGender),
      });

      // Create pair entry
      const pair = await Pair.create({ tournament, players: [regA._id, regB._id] });
      regA.pairId = pair._id; regB.pairId = pair._id;
      await regA.save(); await regB.save();

      return res.status(201).json({ message: 'Paired registration created.', pair });
    }

    // Default: create a normal registration (no partner workflow data)
>>>>>>> 32dff5c (Add pair approval and dashboard updates)
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
<<<<<<< HEAD
=======
      gender: tournCategory.includes('doubles-women') ? 'Female' : (tournCategory.includes('doubles-men') ? 'Male' : (cleanedGender || 'Male')),
>>>>>>> 32dff5c (Add pair approval and dashboard updates)
    });

    res.status(201).json(reg);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

<<<<<<< HEAD
module.exports = router;
=======
// Find partner for already-registered players: create a partner request between two existing waiting players
router.post('/find-partner', async (req, res) => {
  const { tournament, yourRollNumber, partnerRollNumber } = req.body;
  if (!tournament || !yourRollNumber || !partnerRollNumber) return res.status(400).json({ message: 'Required fields missing.' });
  if (yourRollNumber === partnerRollNumber) return res.status(400).json({ message: 'Cannot request yourself.' });

  try {
    const sports = ['badminton', 'table-tennis', 'carrom'];
    let targetSport = null;
    let tournamentDoc = null;
    for (const s of sports) {
      const { Tournament } = getModelsForSport(s);
      const t = await Tournament.findById(tournament);
      if (t) { targetSport = s; tournamentDoc = t; break; }
    }
    if (!targetSport) return res.status(404).json({ message: 'Tournament not found' });
    const { Registration, PartnerRequest } = getModelsForSport(targetSport);

    const a = await Registration.findOne({ tournament, rollNumber: yourRollNumber });
    const b = await Registration.findOne({ tournament, rollNumber: partnerRollNumber });
    if (!a || !b) return res.status(404).json({ message: 'One or both registration numbers not found for this tournament.' });
    if (a.pairStatus === 'complete' || b.pairStatus === 'complete') return res.status(400).json({ message: 'One of the players is already paired.' });
    if (a.partnerStatus !== 'looking' || b.partnerStatus !== 'looking') return res.status(400).json({ message: 'Both players must be looking for partner.' });

    // Prevent duplicate active pending request from requester
    const existing = await PartnerRequest.findOne({ tournament, requesterRegistration: a._id, status: 'pending' });
    if (existing) return res.status(400).json({ message: 'You already have an active pending request.' });

    const reqDoc = await PartnerRequest.create({ tournament, requesterRegistration: a._id, requesterRollNumber: yourRollNumber, targetRegistration: b._id, targetRollNumber: partnerRollNumber });
    return res.json({ message: 'Partner request sent.', request: reqDoc });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Lookup a partner by registration number in a tournament
router.get('/partner-lookup', async (req, res) => {
  const { tournament, rollNumber } = req.query;
  if (!tournament || !rollNumber) return res.status(400).json({ message: 'Tournament and registration number are required.' });

  try {
    const sports = ['badminton', 'table-tennis', 'carrom'];
    let targetSport = null;
    for (const s of sports) {
      const { Tournament } = getModelsForSport(s);
      const t = await Tournament.findById(tournament);
      if (t) { targetSport = s; break; }
    }
    if (!targetSport) return res.status(404).json({ message: 'Tournament not found.' });

    const { Registration } = getModelsForSport(targetSport);
    const normalizedRoll = String(rollNumber).trim().toUpperCase();
    const partnerReg = await Registration.findOne({ tournament, rollNumber: normalizedRoll });
    if (!partnerReg) return res.status(404).json({ message: 'Partner not found.' });

    if (!(partnerReg.partnerStatus === 'looking' && partnerReg.pairStatus === 'incomplete')) {
      return res.status(400).json({ message: 'Partner registration number already exists.' });
    }

    return res.json({
      playerName: partnerReg.playerName,
      rollNumber: partnerReg.rollNumber,
      department: partnerReg.department,
      phone: partnerReg.phone,
      email: partnerReg.email,
      nicNo: partnerReg.nicNo,
      gender: partnerReg.gender,
      partnerStatus: partnerReg.partnerStatus,
      pairStatus: partnerReg.pairStatus,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get pending partner requests for a given registration number (as target)
router.get('/partner-requests/:rollNumber', async (req, res) => {
  const roll = req.params.rollNumber;
  const tournament = req.query.tournament;
  if (!tournament) return res.status(400).json({ message: 'Tournament required.' });
  try {
    const sports = ['badminton', 'table-tennis', 'carrom'];
    let targetSport = null;
    for (const s of sports) {
      const { Tournament } = getModelsForSport(s);
      const t = await Tournament.findById(tournament);
      if (t) { targetSport = s; break; }
    }
    if (!targetSport) return res.status(404).json({ message: 'Tournament not found' });
    const { PartnerRequest, Registration } = getModelsForSport(targetSport);
    const requests = await PartnerRequest.find({ tournament, targetRollNumber: roll, status: 'pending' }).populate('requesterRegistration');
    return res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all pending partner requests for a tournament
router.get('/partner-requests', async (req, res) => {
  const tournament = req.query.tournament;
  if (!tournament) return res.status(400).json({ message: 'Tournament required.' });
  try {
    const sports = ['badminton', 'table-tennis', 'carrom'];
    let targetSport = null;
    for (const s of sports) {
      const { Tournament } = getModelsForSport(s);
      const t = await Tournament.findById(tournament);
      if (t) { targetSport = s; break; }
    }
    if (!targetSport) return res.status(404).json({ message: 'Tournament not found' });
    const { PartnerRequest } = getModelsForSport(targetSport);
    const requests = await PartnerRequest.find({ tournament, status: 'pending' }).populate('requesterRegistration targetRegistration');
    return res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Accept a partner request
router.post('/partner-requests/:id/accept', async (req, res) => {
  const id = req.params.id;
  try {
    // find request across sports
    const sports = ['badminton', 'table-tennis', 'carrom'];
    let found = null; let models = null;
    for (const s of sports) {
      const { PartnerRequest, Registration, Pair } = getModelsForSport(s);
      const r = await PartnerRequest.findById(id);
      if (r) { found = r; models = { PartnerRequest, Registration, Pair }; break; }
    }
    if (!found) return res.status(404).json({ message: 'Partner request not found.' });

    if (found.status !== 'pending') return res.status(400).json({ message: 'Request is not pending.' });

    const { PartnerRequest, Registration, Pair } = models;
    const requester = await Registration.findById(found.requesterRegistration);
    const target = await Registration.findById(found.targetRegistration);
    if (!requester || !target) return res.status(404).json({ message: 'One of the registrations was removed.' });
    if (requester.pairStatus === 'complete' || target.pairStatus === 'complete') return res.status(400).json({ message: 'One of the players is already paired.' });

    // Find tournament and enforce gender rules based on category
    let tournamentDoc = null; let tournamentSport = null;
    for (const s of sports) {
      const { Tournament } = getModelsForSport(s);
      const t = await Tournament.findById(found.tournament);
      if (t) { tournamentDoc = t; tournamentSport = s; break; }
    }
    if (!tournamentDoc) return res.status(404).json({ message: 'Tournament not found for this request.' });

    const category = (tournamentDoc.category || '').toLowerCase();
    if (category.includes('doubles-men')) {
      if (requester.gender !== 'Male' || target.gender !== 'Male') return res.status(400).json({ message: 'Doubles Men requires two male players.' });
    } else if (category.includes('doubles-women')) {
      if (requester.gender !== 'Female' || target.gender !== 'Female') return res.status(400).json({ message: 'Doubles Women requires two female players.' });
    } else if (category.includes('mixed')) {
      const genders = [requester.gender, target.gender];
      if (!(genders.includes('Male') && genders.includes('Female'))) return res.status(400).json({ message: 'Mixed Doubles requires one male and one female player.' });
    }

    // Create pair
    const pair = await Pair.create({ tournament: found.tournament, players: [requester._id, target._id] });
    requester.partnerName = target.playerName; requester.partnerRollNumber = target.rollNumber;
    target.partnerName = requester.playerName; target.partnerRollNumber = requester.rollNumber;
    requester.partnerStatus = 'paired'; requester.pairStatus = 'complete'; requester.pairId = pair._id;
    target.partnerStatus = 'paired'; target.pairStatus = 'complete'; target.pairId = pair._id;
    await requester.save(); await target.save();

    // mark the request accepted and remove other pending requests related to either player
    found.status = 'accepted'; await found.save();
    await PartnerRequest.updateMany({ tournament: found.tournament, $or: [ { requesterRegistration: requester._id }, { targetRegistration: requester._id }, { requesterRegistration: target._id }, { targetRegistration: target._id } ], status: 'pending' }, { status: 'rejected' });

    return res.json({ message: 'Partner request accepted and pair created.', pair });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Reject a partner request
router.post('/partner-requests/:id/reject', async (req, res) => {
  const id = req.params.id;
  try {
    const sports = ['badminton', 'table-tennis', 'carrom'];
    let found = null; let models = null;
    for (const s of sports) {
      const { PartnerRequest } = getModelsForSport(s);
      const r = await PartnerRequest.findById(id);
      if (r) { found = r; models = { PartnerRequest }; break; }
    }
    if (!found) return res.status(404).json({ message: 'Partner request not found.' });
    if (found.status !== 'pending') return res.status(400).json({ message: 'Request is not pending.' });
    found.status = 'rejected'; await found.save();
    return res.json({ message: 'Partner request rejected.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
>>>>>>> 32dff5c (Add pair approval and dashboard updates)
