const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');
const { getModelsForSport } = require('../models/SportModels');
const { protect } = require('../middleware/auth');
const { logAdminAction } = require('../utils/auditLogger');

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
  const { status, pairStatus } = req.body;
  if (!['pending', 'confirmed', 'rejected', 'cancelled'].includes(status))
    return res.status(400).json({ message: 'Invalid status' });

  try {
    const { Tournament, Registration, Player } = getModelsForSport(req.admin.sport);
    const reg = await Registration.findById(req.params.id).populate('tournament');
    if (!reg) return res.status(404).json({ message: 'Registration not found' });

    if (reg.tournament.createdBy.toString() !== req.admin._id.toString())
      return res.status(401).json({ message: 'Unauthorized' });

    const originalStatus = reg.status;

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

      // Update the registration status to rejected and break pair status
      reg.status = 'rejected';
      reg.pairStatus = 'none';
      await reg.save();

      // Reset partner's pairStatus
      if (reg.partnerRollNumber) {
        await Registration.findOneAndUpdate(
          { tournament: reg.tournament._id, rollNumber: reg.partnerRollNumber },
          { pairStatus: 'none' }
        );
      }

      await logAdminAction({
        adminId: req.admin._id,
        action: 'REJECT_REGISTRATION',
        targetId: reg._id,
        targetModel: 'Registration',
        details: { tournament: reg.tournament._id, rollNumber: reg.rollNumber, previousStatus: reg.status, newStatus: 'rejected' },
        req
      });

      return res.json({ message: 'Registration marked as rejected.' });
    }

    // For other status changes (pending, confirmed, cancelled)
    reg.status = status;
    
    // If not confirmed, pair is broken
    if (status !== 'confirmed') {
      reg.pairStatus = 'none';
      if (reg.partnerRollNumber) {
        await Registration.findOneAndUpdate(
          { tournament: reg.tournament._id, rollNumber: reg.partnerRollNumber },
          { pairStatus: 'none' }
        );
      }
    }

    // If pairStatus is passed
    if (pairStatus) {
      reg.pairStatus = pairStatus;
      if (pairStatus === 'complete' && reg.partnerRollNumber) {
        await Registration.findOneAndUpdate(
          { tournament: reg.tournament._id, rollNumber: reg.partnerRollNumber },
          { pairStatus: 'complete' }
        );
      }
    }

    await reg.save();

    await logAdminAction({
      adminId: req.admin._id,
      action: `${status.toUpperCase()}_REGISTRATION`,
      targetId: reg._id,
      targetModel: 'Registration',
      details: { tournament: reg.tournament._id, rollNumber: reg.rollNumber, previousStatus: originalStatus, newStatus: status },
      req
    });

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


// Admin — update registration details
router.put('/:id', protect, async (req, res) => {
  const {
    playerName, nicNo, address, email, phone,
    rollNumber, department, partnerName, partnerRollNumber,
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

  if (!cleanedName || !cleanedNic || !cleanedAddress || !cleanedEmail || !cleanedPhone || !cleanedRoll || !department)
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

//   try {
//     const { Tournament, Registration, Player } = getModelsForSport(req.admin.sport);
//   }
// });
try {
  const { Tournament, Registration, Player } = getModelsForSport(req.admin.sport);
  const reg = await Registration.findById(req.params.id).populate('tournament');
  if (!reg) return res.status(404).json({ message: 'Registration not found' });
  if (reg.tournament.createdBy.toString() !== req.admin._id.toString()) return res.status(401).json({ message: 'Unauthorized' });

  const updatedFields = {};
  if (reg.playerName !== cleanedName) updatedFields.playerName = cleanedName;
  if (reg.nicNo !== cleanedNic) updatedFields.nicNo = cleanedNic;
  if (reg.address !== cleanedAddress) updatedFields.address = cleanedAddress;
  if (reg.email !== cleanedEmail) updatedFields.email = cleanedEmail;
  if (reg.phone !== cleanedPhone) updatedFields.phone = cleanedPhone;
  if (reg.rollNumber !== cleanedRoll) updatedFields.rollNumber = cleanedRoll;
  if (reg.department !== department) updatedFields.department = department;
  if (reg.partnerName !== cleanedPartnerName) updatedFields.partnerName = cleanedPartnerName;
  if (reg.partnerRollNumber !== cleanedPartnerRoll) updatedFields.partnerRollNumber = cleanedPartnerRoll;

  reg.playerName = cleanedName;
  reg.nicNo = cleanedNic;
  reg.address = cleanedAddress;
  reg.email = cleanedEmail;
  reg.phone = cleanedPhone;
  reg.rollNumber = cleanedRoll;
  reg.department = department;
  reg.partnerName = cleanedPartnerName;
  reg.partnerRollNumber = cleanedPartnerRoll;

  await reg.save();

  if (reg.status === 'confirmed') {
    await Player.findOneAndUpdate(
      { rollNumber: cleanedRoll },
      {
        name: cleanedName,
        nicNo: cleanedNic,
        email: cleanedEmail,
        phone: cleanedPhone,
        department,
        $addToSet: { tournamentHistory: reg.tournament._id }
      },
      { upsert: true, new: true }
    );
  }

  await logAdminAction({
    adminId: req.admin._id,
    action: 'UPDATED_REGISTRATION',
    targetId: reg._id,
    targetModel: 'Registration',
    details: { tournament: reg.tournament._id, rollNumber: cleanedRoll, updatedFields },
    req
  });

  res.json(reg);
} catch (err) {
  res.status(500).json({ message: err.message });
}
});


// Admin — approve a pair (sets pairStatus: 'approved' on both players)
router.patch('/:id/approve-pair', protect, async (req, res) => {
  try {
    const { Registration } = getModelsForSport(req.admin.sport);
    const reg = await Registration.findById(req.params.id).populate('tournament');
    if (!reg) return res.status(404).json({ message: 'Registration not found' });

    if (reg.tournament.createdBy.toString() !== req.admin._id.toString())
      return res.status(401).json({ message: 'Unauthorized' });

    if (!reg.partnerRollNumber) return res.status(400).json({ message: 'No partner linked to this registration.' });

    reg.pairStatus = 'approved';
    await reg.save();

    const partner = await Registration.findOneAndUpdate(
      { tournament: reg.tournament._id, rollNumber: reg.partnerRollNumber },
      { pairStatus: 'approved' },
      { new: true }
    );

    await logAdminAction({
      adminId: req.admin._id,
      action: 'APPROVE_PAIR',
      targetId: reg._id,
      targetModel: 'Registration',
      details: { tournament: reg.tournament._id, registrationId: reg._id, partnerId: partner?._id || null, partnerRollNumber: reg.partnerRollNumber },
      req
    });

    res.json({ message: 'Pair approved successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin — reset an approved pair back to 'complete' so it can be re-approved
router.patch('/:id/reset-pair', protect, async (req, res) => {
  try {
    const { Registration } = getModelsForSport(req.admin.sport);
    const reg = await Registration.findById(req.params.id).populate('tournament');
    if (!reg) return res.status(404).json({ message: 'Registration not found' });

    if (reg.tournament.createdBy.toString() !== req.admin._id.toString())
      return res.status(401).json({ message: 'Unauthorized' });

    reg.pairStatus = 'complete';
    await reg.save();

    if (reg.partnerRollNumber) {
      await Registration.findOneAndUpdate(
        { tournament: reg.tournament._id, rollNumber: reg.partnerRollNumber },
        { pairStatus: 'complete' }
      );
    }

    await logAdminAction({
      adminId: req.admin._id,
      action: 'RESET_PAIR',
      targetId: reg._id,
      targetModel: 'Registration',
      details: { tournament: reg.tournament._id, registrationId: reg._id, partnerRollNumber: reg.partnerRollNumber || null },
      req
    });

    res.json({ message: 'Pair reset to pending approval.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin — manually link two solo registrations as partners (bidirectional)
router.patch('/:id/link-partner', protect, async (req, res) => {
  try {
    const { partnerId } = req.body;
    if (!partnerId) return res.status(400).json({ message: 'partnerId is required.' });

    const { Registration } = getModelsForSport(req.admin.sport);

    const reg = await Registration.findById(req.params.id).populate('tournament');
    if (!reg) return res.status(404).json({ message: 'Registration not found' });

    if (reg.tournament.createdBy.toString() !== req.admin._id.toString())
      return res.status(401).json({ message: 'Unauthorized' });

    const partner = await Registration.findById(partnerId).populate('tournament');
    if (!partner) return res.status(404).json({ message: 'Partner registration not found' });

    // Must be in the same tournament
    if (reg.tournament._id.toString() !== partner.tournament._id.toString())
      return res.status(400).json({ message: 'Both players must be in the same tournament.' });

    // Neither should already have a partner
    if (reg.partnerRollNumber && reg.partnerRollNumber.trim())
      return res.status(400).json({ message: 'This player already has a partner assigned.' });
    if (partner.partnerRollNumber && partner.partnerRollNumber.trim())
      return res.status(400).json({ message: 'The selected player already has a partner assigned.' });

    // Link bidirectionally
    reg.partnerRollNumber = partner.rollNumber;
    reg.partnerName = partner.playerName;
    await reg.save();

    partner.partnerRollNumber = reg.rollNumber;
    partner.partnerName = reg.playerName;
    await partner.save();

    await logAdminAction({
      adminId: req.admin._id,
      action: 'LINK_PARTNER',
      targetId: reg._id,
      targetModel: 'Registration',
      details: { tournament: reg.tournament._id, registrationId: reg._id, partnerId: partner._id, partnerRollNumber: partner.rollNumber },
      req
    });

    res.json({ message: 'Players linked as partners successfully.' });

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

// Public — lookup registration by number within a tournament
router.get('/lookup/:regNo?', async (req, res) => {
  const tournament = req.query.tournament;
  const regNo = req.params.regNo || req.query.regNo;
  if (!tournament || !regNo) return res.status(400).json({ message: 'Tournament and registration number are required' });

  try {
    const sports = ['badminton', 'table-tennis', 'carrom'];
    let foundReg = null;

    for (const s of sports) {
      const { Registration } = getModelsForSport(s);
      const reg = await Registration.findOne({ tournament, rollNumber: regNo.trim().toUpperCase() });
      if (reg) {
        foundReg = reg;
        break;
      }
    }

    if (!foundReg) return res.status(404).json({ message: 'No registration found with this number.' });
    return res.json({ registration: foundReg });
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
    if (tournamentDoc.registrationDeadline && new Date() > new Date(tournamentDoc.registrationDeadline)) {
      return res.status(400).json({ message: 'Registration deadline has passed for this tournament.' });
    }

    const { Registration } = getModelsForSport(targetSport);

    const existingSelf = await Registration.findOne({ tournament, rollNumber: cleanedRoll });
    if (existingSelf) {
      return res.status(400).json({ message: `This registration number is already registered for this tournament: ${cleanedRoll}` });
    }

    let partnerRecord = null;
    if (cleanedPartnerRoll) {
      partnerRecord = await Registration.findOne({ tournament, rollNumber: cleanedPartnerRoll });
      if (!partnerRecord) {
        return res.status(400).json({ message: 'Partner registration number is not registered for this tournament.' });
      }

      const partnerAlreadyPaired = partnerRecord.partnerRollNumber?.trim() && partnerRecord.partnerRollNumber.trim() !== cleanedRoll;
      const partnerAlreadyUsed = await Registration.findOne({
        tournament,
        partnerRollNumber: cleanedPartnerRoll,
        rollNumber: { $ne: cleanedRoll }
      });
      const selfAlreadyAssignedAsPartner = await Registration.findOne({
        tournament,
        partnerRollNumber: cleanedRoll,
        rollNumber: { $ne: cleanedPartnerRoll }
      });

      if (partnerAlreadyPaired || partnerAlreadyUsed || selfAlreadyAssignedAsPartner) {
        return res.status(400).json({ message: 'This player already has a partner assigned.' });
      }
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
      partnerName: partnerRecord ? partnerRecord.playerName : (cleanedPartnerName || ''),
      partnerRollNumber: cleanedPartnerRoll || '',
    });

    if (cleanedPartnerRoll) {
      // Try a direct match first
      let updated = await Registration.findOneAndUpdate(
        { tournament, rollNumber: cleanedPartnerRoll },
        { partnerRollNumber: cleanedRoll, partnerName: cleanedName },
        { new: true }
      );

      // Fallback: case-insensitive / flexible match to handle formatting mismatches
      if (!updated) {
        const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`^${escapeRegex(cleanedPartnerRoll)}$`, 'i');
        updated = await Registration.findOneAndUpdate(
          { tournament, rollNumber: { $regex: regex } },
          { partnerRollNumber: cleanedRoll, partnerName: cleanedName },
          { new: true }
        );
      }

      if (!updated) {
        console.warn(`Partner update failed: could not locate partner ${cleanedPartnerRoll} in tournament ${tournament}`);
      }
    }

    res.status(201).json(reg);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

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
    const { PartnerRequest } = getModelsForSport(targetSport);
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
