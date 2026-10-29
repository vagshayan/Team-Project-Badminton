const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');
const { getModelsForSport } = require('../models/SportModels');
const { protect } = require('../middleware/auth');
const { publicRegistrationLimiter, publicPartnerLookupLimiter } = require('../middleware/rateLimiter');
const { logAdminAction } = require('../utils/auditLogger');
const { isPartnerCompatible, getPartnerCompatibilityError } = require('../utils/partnerCompatibility');
const crypto = require('crypto');
const {
  sendRegistrationConfirmationEmail,
  sendRegistrationApprovedEmail,
  sendRegistrationRejectedEmail,
  sendPartnerSelectionEmail,
  sendPartnershipConfirmedEmail,
  sendPartnershipRejectedEmail,
  sendRegistrationCancellationEmail,
} = require('../utils/emailService');

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

      // 🔔 Send rejection email to participant
      if (reg.email) {
        sendRegistrationRejectedEmail({
          email: reg.email,
          playerName: reg.playerName,
          rollNumber: reg.rollNumber,
          sport: req.admin.sport,
          category: reg.tournament?.category || '',
          partnerName: reg.partnerName || '',
          partnerRollNumber: reg.partnerRollNumber || '',
        }).catch((err) => console.error('[Notification] Rejection email error:', err.message));
      }

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

      // 🔔 Send approval email to participant
      if (reg.email) {
        sendRegistrationApprovedEmail({
          email: reg.email,
          playerName: reg.playerName,
          rollNumber: reg.rollNumber,
          sport: req.admin.sport,
          category: reg.tournament?.category || '',
          partnerName: reg.partnerName || '',
          partnerRollNumber: reg.partnerRollNumber || '',
          tournamentDate: reg.tournament?.date,
          tournamentTime: reg.tournament?.time,
          venue: reg.tournament?.venue,
        }).catch((err) => console.error('[Notification] Approval email error:', err.message));
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
    } else if (status === 'cancelled') {
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

       const p = await Player.findOne({ rollNumber: reg.rollNumber });
       if (p && p.tournamentHistory.length === 0) {
         await Player.deleteOne({ rollNumber: reg.rollNumber });
       }

       if (reg.partnerRollNumber) {
          const pt = await Player.findOne({ rollNumber: reg.partnerRollNumber });
          if (pt && pt.tournamentHistory.length === 0) await Player.deleteOne({ rollNumber: reg.partnerRollNumber });
       }

       if (reg.email) {
         sendRegistrationCancellationEmail({
           email: reg.email,
           playerName: reg.playerName,
           rollNumber: reg.rollNumber,
           sport: req.admin.sport,
           category: reg.tournament?.category || '',
         }).catch((err) => console.error('[Notification] Cancellation email error:', err.message));
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
    rollNumber, department, gender, partnerName, partnerRollNumber,
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
  const cleanedGender = normalize(gender);

  if (!cleanedName || !cleanedNic || !cleanedAddress || !cleanedEmail || !cleanedPhone || !cleanedRoll || !department)
    return res.status(400).json({ message: 'All required fields must be filled' });
  if (cleanedGender && !['Male', 'Female'].includes(cleanedGender)) return res.status(400).json({ message: 'Gender must be Male or Female.' });

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

  const previousPartnerRoll = (reg.partnerRollNumber || '').trim().toUpperCase();
  const previousPartnerName = reg.partnerName || '';
  const nextPartnerRoll = cleanedPartnerRoll;
  const nextPartnerName = cleanedPartnerName;

  let nextPartner = null;
  if (nextPartnerRoll) {
    nextPartner = await Registration.findOne({ tournament: reg.tournament._id, rollNumber: nextPartnerRoll });
    if (!nextPartner) {
      return res.status(404).json({ message: 'Partner registration not found for this tournament.' });
    }
  }

  const updatedFields = {};
  if (reg.playerName !== cleanedName) updatedFields.playerName = cleanedName;
  if (reg.nicNo !== cleanedNic) updatedFields.nicNo = cleanedNic;
  if (reg.address !== cleanedAddress) updatedFields.address = cleanedAddress;
  if (reg.email !== cleanedEmail) updatedFields.email = cleanedEmail;
  if (reg.phone !== cleanedPhone) updatedFields.phone = cleanedPhone;
  if (reg.rollNumber !== cleanedRoll) updatedFields.rollNumber = cleanedRoll;
  if (reg.department !== department) updatedFields.department = department;
  if (cleanedGender && reg.gender !== cleanedGender) updatedFields.gender = cleanedGender;
  if (reg.partnerName !== cleanedPartnerName) updatedFields.partnerName = cleanedPartnerName;
  if (reg.partnerRollNumber !== cleanedPartnerRoll) updatedFields.partnerRollNumber = cleanedPartnerRoll;

  const partnerChanged = previousPartnerRoll !== nextPartnerRoll;

  reg.playerName = cleanedName;
  reg.nicNo = cleanedNic;
  reg.address = cleanedAddress;
  reg.email = cleanedEmail;
  reg.phone = cleanedPhone;
  reg.rollNumber = cleanedRoll;
  reg.department = department;
  if (cleanedGender) reg.gender = cleanedGender;
  reg.partnerName = cleanedPartnerName;
  reg.partnerRollNumber = cleanedPartnerRoll;
  const pairInitiatedAt = nextPartner ? new Date() : null;
  if (nextPartner) {
    reg.pairInitiatedByRollNumber = reg.rollNumber;
    reg.pairInitiatedAt = pairInitiatedAt;
  }

  await reg.save();

  if (partnerChanged && previousPartnerRoll) {
    const oldPartner = await Registration.findOne({ tournament: reg.tournament._id, rollNumber: previousPartnerRoll });
    if (oldPartner && oldPartner.partnerRollNumber?.trim().toUpperCase() === reg.rollNumber.trim().toUpperCase()) {
      oldPartner.partnerRollNumber = '';
      oldPartner.partnerName = '';
      oldPartner.partnerStatus = 'looking';
      oldPartner.pairStatus = 'incomplete';
      oldPartner.pairId = null;
      await oldPartner.save();
    }
  }

  if (nextPartner && nextPartner._id.toString() !== reg._id.toString()) {
    nextPartner.partnerRollNumber = reg.rollNumber;
    nextPartner.partnerName = reg.playerName;
    nextPartner.pairInitiatedByRollNumber = reg.rollNumber;
    nextPartner.pairInitiatedAt = pairInitiatedAt;
    nextPartner.partnerStatus = 'paired';
    nextPartner.pairStatus = reg.pairStatus || 'incomplete';
    nextPartner.pairId = reg.pairId || null;
    await nextPartner.save();
  }

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

    const partnerRoll = (reg.partnerRollNumber || '').trim().toUpperCase();
    if (!partnerRoll) return res.status(400).json({ message: 'No partner linked to this registration.' });

    const partner = await Registration.findOne({ tournament: reg.tournament._id, rollNumber: partnerRoll });
    if (!partner) return res.status(400).json({ message: 'Linked partner registration could not be found in this tournament.' });
    if ((partner.partnerRollNumber || '').trim().toUpperCase() !== reg.rollNumber.trim().toUpperCase()) {
      return res.status(400).json({ message: 'Both players must be linked to each other before approval.' });
    }

    reg.pairStatus = 'approved';
    await reg.save();

    await Registration.findOneAndUpdate(
      { tournament: reg.tournament._id, rollNumber: partnerRoll },
      { pairStatus: 'approved' },
      { new: true }
    );

    await logAdminAction({
      adminId: req.admin._id,
      action: 'APPROVE_PAIR',
      targetId: reg._id,
      targetModel: 'Registration',
      details: { tournament: reg.tournament._id, registrationId: reg._id, partnerId: partner?._id || null, partnerRollNumber: partnerRoll },
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

// Admin — remove a paired registration link completely
router.patch('/:id/remove-pair', protect, async (req, res) => {
  try {
    const { Registration, Pair } = getModelsForSport(req.admin.sport);
    const reg = await Registration.findById(req.params.id).populate('tournament');
    if (!reg) return res.status(404).json({ message: 'Registration not found' });

    if (reg.tournament.createdBy.toString() !== req.admin._id.toString())
      return res.status(401).json({ message: 'Unauthorized' });

    if (!reg.partnerRollNumber) return res.status(400).json({ message: 'This registration has no partner to remove.' });

    const partner = await Registration.findOne({ tournament: reg.tournament._id, rollNumber: reg.partnerRollNumber });
    const removedPartnerRoll = reg.partnerRollNumber;
    const removedPartnerName = reg.partnerName || null;
    const removedPairId = reg.pairId || partner?.pairId || null;

    reg.partnerRollNumber = '';
    reg.partnerName = '';
    reg.partnerStatus = 'looking';
    reg.pairStatus = 'incomplete';
    reg.pairId = null;
    await reg.save();

    if (partner) {
      partner.partnerRollNumber = '';
      partner.partnerName = '';
      partner.partnerStatus = 'looking';
      partner.pairStatus = 'incomplete';
      partner.pairId = null;
      await partner.save();
    }

    if (removedPairId) {
      await Pair.findByIdAndDelete(removedPairId);
    }

    await logAdminAction({
      adminId: req.admin._id,
      action: 'REMOVE_PAIR',
      targetId: reg._id,
      targetModel: 'Registration',
      details: {
        tournament: reg.tournament._id,
        registrationId: reg._id,
        partnerId: partner?._id || null,
        partnerRollNumber: removedPartnerRoll,
        partnerName: removedPartnerName,
        pairId: removedPairId,
      },
      req,
    });

    res.json({ message: 'Pair removed and both players are now unlinked.' });
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

    // Must be in the exact same tournament record
    if (reg.tournament._id.toString() !== partner.tournament._id.toString())
      return res.status(400).json({ message: 'Both players must be in the same tournament.' });

    // Neither should already have a partner
    if (reg.partnerRollNumber && reg.partnerRollNumber.trim())
      return res.status(400).json({ message: 'This player already has a partner assigned.' });
    if (partner.partnerRollNumber && partner.partnerRollNumber.trim())
      return res.status(400).json({ message: 'The selected player already has a partner assigned.' });

    const category = reg.tournament.category;
    const compatibilityError = getPartnerCompatibilityError(category, reg.gender, partner.gender);

    if (!compatibilityError) {
      // proceed
    } else if (category === 'mixed-doubles' || category === 'doubles-men' || category === 'doubles-women') {
      return res.status(400).json({ message: compatibilityError });
    } else {
      return res.status(400).json({ message: 'Manual partner linking is only allowed for doubles categories.' });
    }

    // Link bidirectionally
    const pairInitiatedAt = new Date();
    reg.partnerRollNumber = partner.rollNumber;
    reg.partnerName = partner.playerName;
    reg.pairInitiatedByRollNumber = reg.rollNumber;
    reg.pairInitiatedAt = pairInitiatedAt;
    await reg.save();

    partner.partnerRollNumber = reg.rollNumber;
    partner.partnerName = reg.playerName;
    partner.pairInitiatedByRollNumber = reg.rollNumber;
    partner.pairInitiatedAt = pairInitiatedAt;
    await partner.save();

    await logAdminAction({
      adminId: req.admin._id,
      action: 'LINK_PARTNER',
      targetId: reg._id,
      targetModel: 'Registration',
      details: { tournament: reg.tournament._id, registrationId: reg._id, partnerId: partner._id, partnerRollNumber: partner.rollNumber },
      req
    });

    sendPartnershipConfirmedEmail({
      requesterEmail: reg.email,
      requesterName: reg.playerName,
      targetEmail: partner.email,
      targetName: partner.playerName,
      sport: req.admin.sport,
      category: reg.tournament?.category || '',
    }).catch((emailErr) => {
      console.error('[Notification] Admin link-partner confirmation email error:', emailErr.message);
    });

    res.json({ message: 'Players linked as partners successfully.' });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// Admin — view registrations for a tournament
router.get('/tournament/:tournamentId', protect, async (req, res) => {
  try {
    const { Tournament, Registration } = getModelsForSport(req.admin.sport);
    const tournament = await Tournament.findOne({
      _id: req.params.tournamentId,
      createdBy: req.admin._id,
    }).select('_id');
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });

    const registrations = await Registration.find({
      tournament: tournament._id,
    }).sort({ createdAt: -1 });
    res.json(registrations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Public — lookup registration by number within a tournament
router.get('/lookup/:regNo?', publicPartnerLookupLimiter, async (req, res) => {
  const tournament = req.query.tournament;
  const regNo = req.params.regNo || req.query.regNo;
  if (!tournament || !regNo) return res.status(400).json({ message: 'Tournament and registration number are required' });

  try {
    const sports = ['badminton', 'table-tennis', 'carrom'];
    let foundReg = null;

    for (const s of sports) {
      const { Registration } = getModelsForSport(s);
      const reg = await Registration.findOne({ tournament, rollNumber: regNo.trim().toUpperCase() })
        .select('-_id playerName rollNumber department status');
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
router.post('/', publicRegistrationLimiter, async (req, res) => {
  const {
    tournament, playerName, nicNo, address, email, phone,
    rollNumber, department, year, gender, partnerName, partnerRollNumber,
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
  const cleanedGender = normalize(gender);

  if (!tournament || !cleanedName || !cleanedNic || !cleanedAddress || !cleanedEmail || !cleanedPhone || !cleanedRoll || !department)
    return res.status(400).json({ message: 'All required fields must be filled' });
  if (cleanedGender && !['Male', 'Female'].includes(cleanedGender)) return res.status(400).json({ message: 'Gender must be Male or Female.' });

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

    const existingNic = await Registration.findOne({ tournament, nicNo: cleanedNic });
    if (existingNic) {
      return res.status(400).json({ message: `This NIC number is already registered for this tournament: ${cleanedNic}` });
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

      const compatibilityError = getPartnerCompatibilityError(tournamentDoc.category, cleanedGender, partnerRecord.gender);
      if ((tournamentDoc.category === 'mixed-doubles' || tournamentDoc.category === 'doubles-men' || tournamentDoc.category === 'doubles-women') && compatibilityError) {
        return res.status(400).json({ message: compatibilityError });
      }
    }

    const pairInitiatedAt = cleanedPartnerRoll ? new Date() : null;
    let reg = await Registration.create({
      tournament,
      playerName: cleanedName,
      rollNumber: cleanedRoll,
      nicNo: cleanedNic,
      address: cleanedAddress,
      email: cleanedEmail,
      phone: cleanedPhone,
      department,
      year: year || 'N/A',
      partnerName: cleanedPartnerName,
      partnerRollNumber: cleanedPartnerRoll,
      ...(cleanedPartnerRoll ? {
        pairInitiatedByRollNumber: cleanedRoll,
        pairInitiatedAt,
      } : {}),
      ...(cleanedGender ? { gender: cleanedGender } : {}),
    });

    if (cleanedPartnerRoll) {
      try {
        const updated = await Registration.findOneAndUpdate(
          { tournament, rollNumber: cleanedPartnerRoll },
          {
            partnerRollNumber: cleanedRoll,
            partnerName: cleanedName,
            pairInitiatedByRollNumber: cleanedRoll,
            pairInitiatedAt,
          },
          { new: true }
        );

        if (!updated) {
          throw new Error(`Partner update failed: could not locate partner ${cleanedPartnerRoll} in tournament ${tournament}`);
        }
      } catch (partnerErr) {
        await Registration.deleteOne({ _id: reg._id });
        return res.status(400).json({ message: partnerErr.message });
      }
    }

    // ── Email Notifications (sent only after successful database save) ──
    sendRegistrationConfirmationEmail({
      email: reg.email,
      playerName: reg.playerName,
      rollNumber: reg.rollNumber,
      nicNo: reg.nicNo,
      department: reg.department,
      sport: targetSport,
      category: tournamentDoc.category,
      partnerName: reg.partnerName,
      partnerRollNumber: reg.partnerRollNumber,
      status: reg.status,
      tournamentDate: tournamentDoc.date,
      tournamentTime: tournamentDoc.time,
      venue: tournamentDoc.venue,
    }).catch((emailErr) => {
      console.error('[Notification] Registration confirmation email error:', emailErr.message);
    });

    if (cleanedPartnerRoll && partnerRecord && partnerRecord.email) {
      try {
        const { PartnerRequest } = getModelsForSport(targetSport);
        const confirmationToken = crypto.randomBytes(32).toString('hex');
        
        let partnerReqDoc = await PartnerRequest.findOne({
          tournament: tournamentDoc._id,
          requesterRegistration: reg._id,
          targetRegistration: partnerRecord._id,
        });

        if (!partnerReqDoc) {
          partnerReqDoc = await PartnerRequest.create({
            tournament: tournamentDoc._id,
            requesterRegistration: reg._id,
            requesterRollNumber: reg.rollNumber,
            targetRegistration: partnerRecord._id,
            targetRollNumber: partnerRecord.rollNumber,
            confirmationToken,
            status: 'pending',
            notificationSent: true,
          });
        }

        sendPartnerSelectionEmail({
          partnerEmail: partnerRecord.email,
          partnerName: partnerRecord.playerName,
          partnerRollNumber: partnerRecord.rollNumber,
          requesterName: reg.playerName,
          requesterRollNumber: reg.rollNumber,
          sport: targetSport,
          category: tournamentDoc.category,
          tournamentDate: tournamentDoc.date,
          venue: tournamentDoc.venue,
          requestId: partnerReqDoc._id,
          confirmationToken: partnerReqDoc.confirmationToken || confirmationToken,
        }).catch((emailErr) => {
          console.error('[Notification] Partner selection notification email error:', emailErr.message);
        });
      } catch (partnerNotifErr) {
        console.error('[Notification] Failed to create partner request / notify partner:', partnerNotifErr.message);
      }
    }

    res.status(201).json(reg);
  } catch (err) {
    if (err.code === 11000) {
      const dupKey = Object.keys(err.keyValue || {})[0];
      if (dupKey === 'nicNo') {
        return res.status(400).json({ message: `This NIC number is already registered for this tournament: ${err.keyValue[dupKey]}` });
      }
      if (dupKey === 'rollNumber') {
        return res.status(400).json({ message: `This registration number is already registered for this tournament: ${err.keyValue[dupKey]}` });
      }
      return res.status(400).json({ message: `Duplicate field detected for this tournament.` });
    }
    res.status(400).json({ message: err.message });
  }
});

// Find partner for already-registered players: create a partner request between two existing waiting players
router.post('/find-partner', publicRegistrationLimiter, async (req, res) => {
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

    const confirmationToken = crypto.randomBytes(32).toString('hex');
    const reqDoc = await PartnerRequest.create({
      tournament,
      requesterRegistration: a._id,
      requesterRollNumber: yourRollNumber,
      targetRegistration: b._id,
      targetRollNumber: partnerRollNumber,
      confirmationToken,
      notificationSent: true,
      status: 'pending',
    });

    if (b.email) {
      sendPartnerSelectionEmail({
        partnerEmail: b.email,
        partnerName: b.playerName,
        partnerRollNumber: b.rollNumber,
        requesterName: a.playerName,
        requesterRollNumber: a.rollNumber,
        sport: targetSport,
        category: tournamentDoc.category,
        tournamentDate: tournamentDoc.date,
        venue: tournamentDoc.venue,
        requestId: reqDoc._id,
        confirmationToken,
      }).catch((emailErr) => {
        console.error('[Notification] Find-partner email dispatch error:', emailErr.message);
      });
    }

    return res.json({ message: 'Partner request sent.', request: reqDoc });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Lookup a partner by registration number in a tournament
router.get('/partner-lookup', publicPartnerLookupLimiter, async (req, res) => {
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
    const partnerReg = await Registration.findOne({ tournament, rollNumber: normalizedRoll })
      .select('-_id playerName rollNumber department status partnerStatus pairStatus');
    if (!partnerReg) return res.status(404).json({ message: 'Partner not found.' });

    if (!(partnerReg.partnerStatus === 'looking' && partnerReg.pairStatus === 'incomplete')) {
      return res.status(400).json({ message: 'Partner registration number already exists.' });
    }

    return res.json({
      playerName: partnerReg.playerName,
      rollNumber: partnerReg.rollNumber,
      department: partnerReg.department,
      status: partnerReg.status,
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
    const compatibilityError = getPartnerCompatibilityError(category, requester.gender, target.gender);
    if (compatibilityError) {
      return res.status(400).json({ message: compatibilityError });
    }

    // Create pair
    const pair = await Pair.create({ tournament: found.tournament, players: [requester._id, target._id] });
    const pairInitiatedAt = found.createdAt || new Date();
    requester.partnerName = target.playerName; requester.partnerRollNumber = target.rollNumber;
    requester.pairInitiatedByRollNumber = requester.rollNumber; requester.pairInitiatedAt = pairInitiatedAt;
    target.partnerName = requester.playerName; target.partnerRollNumber = requester.rollNumber;
    target.pairInitiatedByRollNumber = requester.rollNumber; target.pairInitiatedAt = pairInitiatedAt;
    requester.partnerStatus = 'paired'; requester.pairStatus = 'complete'; requester.pairId = pair._id;
    target.partnerStatus = 'paired'; target.pairStatus = 'complete'; target.pairId = pair._id;
    await requester.save(); await target.save();

    // mark the request accepted and remove other pending requests related to either player
    found.status = 'accepted'; await found.save();
    await PartnerRequest.updateMany({ tournament: found.tournament, $or: [ { requesterRegistration: requester._id }, { targetRegistration: requester._id }, { requesterRegistration: target._id }, { targetRegistration: target._id } ], status: 'pending' }, { status: 'rejected' });

    sendPartnershipConfirmedEmail({
      requesterEmail: requester.email,
      requesterName: requester.playerName,
      targetEmail: target.email,
      targetName: target.playerName,
      sport: tournamentSport,
      category: tournamentDoc.category,
    }).catch((emailErr) => {
      console.error('[Notification] Partner accept confirmation email error:', emailErr.message);
    });

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

    let requesterReg = null;
    let tournamentSport = null;
    let tournamentDoc = null;
    for (const s of sports) {
      const { Registration, Tournament } = getModelsForSport(s);
      const reg = await Registration.findById(found.requesterRegistration);
      if (reg) {
        requesterReg = reg;
        tournamentSport = s;
        tournamentDoc = await Tournament.findById(found.tournament);
        break;
      }
    }

    if (requesterReg && requesterReg.email) {
      sendPartnershipRejectedEmail({
        requesterEmail: requesterReg.email,
        requesterName: requesterReg.playerName,
        targetName: found.targetRollNumber,
        sport: tournamentSport || '',
        category: tournamentDoc?.category || '',
      }).catch((emailErr) => {
        console.error('[Notification] Partner reject email error:', emailErr.message);
      });
    }

    return res.json({ message: 'Partner request rejected.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Direct link response for email action buttons (Accept / Reject)
router.get('/partner-requests/:id/respond', async (req, res) => {
  const { id } = req.params;
  const { action, token } = req.query;

  const getPortalUrl = (sport = '') => {
    const base = process.env.FRONTEND_URL || process.env.CLIENT_ORIGIN || 'http://localhost:3000';
    return sport ? `${base}/${sport.toLowerCase()}` : base;
  };

  const renderResponsePage = ({ title, heading, message, isSuccess, sport }) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} - University of Jaffna Sports</title>
      <style>
        body {
          margin: 0; padding: 0;
          background: #0B192C; color: #F8FAFC;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex; align-items: center; justify-content: center; min-height: 100vh;
        }
        .card {
          background: #1E293B; border: 1px solid #334155; border-radius: 20px;
          padding: 40px; max-width: 520px; width: 90%; text-align: center;
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
        }
        .icon { font-size: 54px; margin-bottom: 16px; }
        h1 { font-size: 24px; font-weight: 800; margin: 0 0 12px 0; color: ${isSuccess ? '#10B981' : '#F59E0B'}; }
        p { font-size: 15px; color: #94A3B8; line-height: 1.6; margin: 0 0 24px 0; }
        .btn {
          display: inline-block; background: #3B82F6; color: #FFF;
          padding: 12px 28px; border-radius: 10px; text-decoration: none;
          font-weight: 700; font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">${isSuccess ? '🏆' : 'ℹ️'}</div>
        <h1>${heading}</h1>
        <p>${message}</p>
        <a href="${getPortalUrl(sport)}" class="btn">Open Tournament Portal</a>
      </div>
    </body>
    </html>
  `;

  const mongoose = require('mongoose');
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).send(renderResponsePage({
      title: 'Not Found',
      heading: 'Request Not Found',
      message: 'This partner request could not be located or may have been deleted.',
      isSuccess: false,
    }));
  }

  try {
    const sports = ['badminton', 'table-tennis', 'carrom'];
    let found = null;
    let models = null;
    let targetSport = null;

    for (const s of sports) {
      const currentModels = getModelsForSport(s);
      const r = await currentModels.PartnerRequest.findById(id);
      if (r) {
        found = r;
        models = currentModels;
        targetSport = s;
        break;
      }
    }

    if (!found) {
      return res.status(404).send(renderResponsePage({
        title: 'Not Found',
        heading: 'Request Not Found',
        message: 'This partner request could not be located or may have been deleted.',
        isSuccess: false,
      }));
    }

    if (found.confirmationToken && token && found.confirmationToken !== token) {
      return res.status(403).send(renderResponsePage({
        title: 'Invalid Link',
        heading: 'Invalid Confirmation Link',
        message: 'The security verification token for this action link is invalid.',
        isSuccess: false,
      }));
    }

    if (found.status !== 'pending') {
      return res.send(renderResponsePage({
        title: 'Already Processed',
        heading: `Request Already ${found.status.toUpperCase()}`,
        message: `This partnership request has already been ${found.status}. No further action is required.`,
        isSuccess: found.status === 'accepted',
        sport: targetSport,
      }));
    }

    if (action === 'reject') {
      found.status = 'rejected';
      await found.save();

      const requester = await models.Registration.findById(found.requesterRegistration);
      const tournamentDoc = await models.Tournament.findById(found.tournament);

      if (requester && requester.email) {
        sendPartnershipRejectedEmail({
          requesterEmail: requester.email,
          requesterName: requester.playerName,
          targetName: found.targetRollNumber,
          sport: targetSport,
          category: tournamentDoc?.category || '',
        }).catch((err) => console.error('[Notification] Error sending reject email:', err.message));
      }

      return res.send(renderResponsePage({
        title: 'Request Declined',
        heading: 'Partner Request Declined',
        message: 'You have declined this partnership invitation. Your player status has been returned to the available pool.',
        isSuccess: false,
        sport: targetSport,
      }));
    }

    if (action === 'accept') {
      const requester = await models.Registration.findById(found.requesterRegistration);
      const target = await models.Registration.findById(found.targetRegistration);

      if (!requester || !target) {
        return res.status(404).send(renderResponsePage({
          title: 'Error',
          heading: 'Registration Missing',
          message: 'One of the participant registrations could not be found.',
          isSuccess: false,
        }));
      }

      if (requester.pairStatus === 'complete' || target.pairStatus === 'complete') {
        return res.status(400).send(renderResponsePage({
          title: 'Already Paired',
          heading: 'Player Already Paired',
          message: 'One of the players has already finalized another partnership.',
          isSuccess: false,
          sport: targetSport,
        }));
      }

      const tournamentDoc = await models.Tournament.findById(found.tournament);
      const category = (tournamentDoc?.category || '').toLowerCase();
      const compatibilityError = getPartnerCompatibilityError(category, requester.gender, target.gender);
      if (compatibilityError) {
        return res.status(400).send(renderResponsePage({
          title: 'Compatibility Conflict',
          heading: 'Category Incompatible',
          message: compatibilityError,
          isSuccess: false,
          sport: targetSport,
        }));
      }

      // Create pair & update statuses
      const pair = await models.Pair.create({
        tournament: found.tournament,
        players: [requester._id, target._id],
      });

      const pairInitiatedAt = found.createdAt || new Date();
      requester.partnerName = target.playerName;
      requester.partnerRollNumber = target.rollNumber;
      requester.pairInitiatedByRollNumber = requester.rollNumber;
      requester.pairInitiatedAt = pairInitiatedAt;
      requester.partnerStatus = 'paired';
      requester.pairStatus = 'complete';
      requester.pairId = pair._id;

      target.partnerName = requester.playerName;
      target.partnerRollNumber = requester.rollNumber;
      target.pairInitiatedByRollNumber = requester.rollNumber;
      target.pairInitiatedAt = pairInitiatedAt;
      target.partnerStatus = 'paired';
      target.pairStatus = 'complete';
      target.pairId = pair._id;

      await requester.save();
      await target.save();

      found.status = 'accepted';
      await found.save();

      await models.PartnerRequest.updateMany(
        {
          tournament: found.tournament,
          $or: [
            { requesterRegistration: requester._id },
            { targetRegistration: requester._id },
            { requesterRegistration: target._id },
            { targetRegistration: target._id },
          ],
          status: 'pending',
        },
        { status: 'rejected' }
      );

      sendPartnershipConfirmedEmail({
        requesterEmail: requester.email,
        requesterName: requester.playerName,
        targetEmail: target.email,
        targetName: target.playerName,
        sport: targetSport,
        category: tournamentDoc?.category || '',
      }).catch((emailErr) => console.error('[Notification] Email respond confirmation error:', emailErr.message));

      return res.send(renderResponsePage({
        title: 'Partnership Confirmed',
        heading: '🎉 Partnership Confirmed!',
        message: `You and ${requester.playerName} (${requester.rollNumber}) are now officially paired for ${tournamentDoc?.category ? tournamentDoc.category.replace(/-/g, ' ') : 'doubles'}. Good luck in the tournament!`,
        isSuccess: true,
        sport: targetSport,
      }));
    }

    return res.status(400).send(renderResponsePage({
      title: 'Invalid Action',
      heading: 'Invalid Request Action',
      message: 'The requested partnership action could not be identified.',
      isSuccess: false,
    }));
  } catch (err) {
    console.error('Direct link respond error:', err);
    res.status(500).send(renderResponsePage({
      title: 'Server Error',
      heading: 'Server Error',
      message: 'An unexpected error occurred while processing your request.',
      isSuccess: false,
    }));
  }
});

module.exports = router;
