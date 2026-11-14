const express = require('express');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { protect } = require('../middleware/auth');
const { getModelsForSport } = require('../models/SportModels');
const Match = require('../models/Match');
const PlayerPass = require('../models/PlayerPass');
const { ensurePlayerPass, buildPass, findPassByToken, hashToken, encryptToken, decryptToken } = require('../utils/playerPass');

const router = express.Router();

const frontendUrl = (origin) => (process.env.FRONTEND_URL || process.env.CLIENT_ORIGIN || origin || 'http://localhost:3000').replace(/\/$/, '');
const passUrl = (token, origin) => `${frontendUrl(origin)}/pass/${encodeURIComponent(token)}`;

async function renderPassPdf(res, details, token, origin) {
  const doc = new PDFDocument({ size: 'A4', margin: 42 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="player-pass-${details.playerId}.pdf"`);
  doc.pipe(res);

  const color = ({ badminton: '#16845b', 'table-tennis': '#c44234', carrom: '#a27718' })[details.sport] || '#16845b';
  doc.rect(0, 0, doc.page.width, 120).fill(color);
  doc.fillColor('#ffffff').fontSize(11).text('TOURNAMENT PLAYER PASS', 42, 34, { characterSpacing: 1.4 });
  doc.fontSize(22).text(details.tournament.name, 42, 57, { width: 430 });
  doc.fillColor('#111827').fontSize(20).text(details.player.name, 42, 145, { width: 330 });
  doc.fillColor(color).fontSize(12).text(details.sport.replace(/-/g, ' ').toUpperCase(), 42, 176);
  doc.fillColor('#374151').fontSize(10);

  const lines = [
    ['Player ID', details.playerId],
    ['Registration ID', String(details.registrationId)],
    ['Email', details.player.email],
    ['Phone', details.player.phone],
    ['Category', details.player.category || details.tournament.category],
    ['Registration date', new Date(details.player.registrationDate).toLocaleDateString()],
    ['Registration status', details.player.registrationStatus],
    ['Tournament year', String(details.tournament.year)],
    ['Sport category', details.tournament.category],
  ];
  let y = 218;
  lines.forEach(([label, value]) => {
    doc.fillColor('#6b7280').text(label, 42, y, { width: 130 });
    doc.fillColor('#111827').text(value || 'N/A', 178, y, { width: 330 });
    y += 24;
  });

  doc.moveTo(42, y + 3).lineTo(553, y + 3).strokeColor('#d1d5db').stroke();
  y += 22;
  doc.fillColor(color).fontSize(13).text('MATCH SCHEDULE', 42, y);
  y += 25;
  const matchLines = details.match?.id ? [
    ['Match ID', String(details.match.id)],
    ['Opponent', details.match.opponent],
    ['Round', String(details.match.round)],
    ['Date', details.match.date ? new Date(details.match.date).toLocaleString() : 'Pending'],
    ['Time', details.match.time || 'Pending'],
    ['Court / Table', details.match.court || 'Pending'],
    ['Venue', details.match.venue || details.tournament.venue || 'Pending'],
    ['Match status', details.match.status],
  ] : [['Schedule', 'Match Schedule Pending']];
  doc.fillColor('#374151').fontSize(10);
  matchLines.forEach(([label, value]) => {
    doc.fillColor('#6b7280').text(label, 42, y, { width: 130 });
    doc.fillColor('#111827').text(value || 'Pending', 178, y, { width: 330 });
    y += 23;
  });
  doc.fillColor(details.passStatus === 'valid' ? '#15803d' : '#b91c1c').fontSize(11)
    .text(`PASS STATUS: ${details.passStatus.toUpperCase()}`, 42, y + 12);
  const qr = await QRCode.toBuffer(passUrl(token, origin), { errorCorrectionLevel: 'H', margin: 1, width: 160 });
  const qrY = Math.min(Math.max(y + 18, 620), 675);
  doc.image(qr, 390, qrY, { width: 120, height: 120 });
  doc.fillColor('#6b7280').fontSize(8).text('Scan to view the latest pass details', 365, qrY + 124, { width: 170, align: 'center' });
  doc.end();
}

// Admin management is restricted to the signed-in administrator's own sport and tournaments.
router.get('/admin', protect, async (req, res) => {
  try {
    const { sport: filterSport } = req.query;
    const adminSport = req.admin.sport;
    const isSuperAdmin = req.admin.role === 'super_admin';

    // Sports to query
    let sportsToQuery = [];
    if (isSuperAdmin) {
      sportsToQuery = filterSport && ['badminton', 'table-tennis', 'carrom'].includes(filterSport)
        ? [filterSport]
        : ['badminton', 'table-tennis', 'carrom'];
    } else {
      sportsToQuery = adminSport ? [adminSport] : ['badminton', 'table-tennis', 'carrom'];
    }

    const allRows = [];

    for (const sport of sportsToQuery) {
      const { Tournament, Registration } = getModelsForSport(sport);
      // Fetch tournaments for this sport
      // First try tournaments created by this admin, or if none, all active/published in that sport
      let tournamentFilter = { createdBy: req.admin._id };
      let tournaments = await Tournament.find(tournamentFilter).select('_id');

      if (tournaments.length === 0 || isSuperAdmin) {
        // If no tournaments created by this specific admin ID, fetch all tournaments in that sport
        tournaments = await Tournament.find().select('_id');
      }

      const registrations = await Registration.find({
        tournament: { $in: tournaments.map((t) => t._id) },
      })
        .sort({ createdAt: -1 })
        .lean();

      for (const registration of registrations) {
        try {
          await ensurePlayerPass(sport, registration._id);
          const details = await buildPass(sport, registration._id);
          const playerPass = await PlayerPass.findOne({
            sport,
            registration: registration._id,
          }).lean();

          if (details) {
            allRows.push({
              ...details,
              passRecordId: playerPass?._id || null,
              hasPass: Boolean(playerPass),
            });
          }
        } catch (e) {
          // ignore single item errors
        }
      }
    }

    res.json(allRows);
  } catch (error) {
    console.error('Error loading passes in /admin:', error);
    res.status(500).json({ message: 'Unable to load player passes.' });
  }
});

router.post('/scan', protect, async (req, res) => {
  try {
    const rawToken = String(req.body?.token || '').trim();
    // Support either full URL or raw token
    const token = rawToken.includes('/')
      ? rawToken.split('/').filter(Boolean).pop()
      : rawToken;

    if (!token) {
      return res.status(400).json({ passStatus: 'invalid', message: 'Token is required' });
    }

    const result = await findPassByToken(token);
    if (!result?.details) {
      return res.status(404).json({ passStatus: 'invalid' });
    }

    // Allow super admin to scan any sport, or sport admin to scan their sport
    if (req.admin.role !== 'super_admin' && req.admin.sport && result.playerPass.sport !== req.admin.sport) {
      return res.status(403).json({
        passStatus: 'invalid',
        message: `This pass belongs to ${result.playerPass.sport}, not ${req.admin.sport}.`,
      });
    }

    const details = result.details;
    if (result.playerPass.isRevoked) details.passStatus = 'cancelled';
    res.set('Cache-Control', 'no-store').json(details);
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({ message: 'Unable to scan this player pass.' });
  }
});

router.post('/admin/:registrationId/regenerate', protect, async (req, res) => {
  try {
    const { Tournament, Registration } = getModelsForSport(req.admin.sport);
    const registration = await Registration.findById(req.params.registrationId).populate('tournament');
    if (!registration || registration.tournament.createdBy.toString() !== req.admin._id.toString())
      return res.status(404).json({ message: 'Registration not found.' });
    const { playerPass, token } = await ensurePlayerPass(req.admin.sport, registration._id);
    const newToken = token || require('crypto').randomBytes(32).toString('base64url');
    playerPass.tokenHash = hashToken(newToken);
    playerPass.tokenCipher = encryptToken(newToken);
    playerPass.isRevoked = false;
    await playerPass.save();
    res.json({ passUrl: passUrl(newToken, req.get('origin')) });
  } catch (error) {
    res.status(500).json({ message: 'Unable to regenerate the pass QR code.' });
  }
});

router.get('/admin/:registrationId/pdf', protect, async (req, res) => {
  try {
    const { Registration } = getModelsForSport(req.admin.sport);
    const registration = await Registration.findById(req.params.registrationId).populate('tournament');
    if (!registration || registration.tournament.createdBy.toString() !== req.admin._id.toString())
      return res.status(404).json({ message: 'Registration not found.' });
    const details = await buildPass(req.admin.sport, registration._id);
    if (!details || details.passStatus !== 'valid')
      return res.status(403).json({ message: 'Only valid passes can be downloaded.' });
    const playerPass = await PlayerPass.findOne({ sport: req.admin.sport, registration: registration._id }).select('+tokenCipher');
    if (!playerPass) return res.status(404).json({ message: 'Player pass not found.' });
    await renderPassPdf(res, details, decryptToken(playerPass.tokenCipher), req.get('origin'));
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ message: 'Unable to generate the player pass PDF.' });
  }
});

router.patch('/admin/:registrationId/revoke', protect, async (req, res) => {
  try {
    const { Tournament, Registration } = getModelsForSport(req.admin.sport);
    const registration = await Registration.findById(req.params.registrationId).populate('tournament');
    if (!registration || registration.tournament.createdBy.toString() !== req.admin._id.toString())
      return res.status(404).json({ message: 'Registration not found.' });
    await PlayerPass.findOneAndUpdate(
      { sport: req.admin.sport, registration: registration._id },
      { $set: { isRevoked: true } }
    );
    res.json({ message: 'Player pass cancelled.' });
  } catch (error) {
    res.status(500).json({ message: 'Unable to cancel the pass.' });
  }
});

router.patch('/admin/:registrationId/schedule', protect, async (req, res) => {
  try {
    const { Tournament, Registration } = getModelsForSport(req.admin.sport);
    const registration = await Registration.findById(req.params.registrationId).populate('tournament');
    if (!registration || registration.tournament.createdBy.toString() !== req.admin._id.toString())
      return res.status(404).json({ message: 'Registration not found.' });
    const match = await Match.findOne({
      tournament: registration.tournament._id,
      $or: [{ player1: registration._id }, { player2: registration._id }],
    }).sort({ isCompleted: 1, round: 1 });
    if (!match) return res.status(404).json({ message: 'No match is scheduled for this registration.' });

    const { matchDate, scheduledTime, court, venue, round, opponentRegistrationId } = req.body;
    if (matchDate !== undefined) {
      const date = matchDate ? new Date(matchDate) : null;
      if (date && Number.isNaN(date.getTime())) return res.status(400).json({ message: 'Invalid match date.' });
      match.matchDate = date;
    }
    if (scheduledTime !== undefined) match.scheduledTime = String(scheduledTime).trim();
    if (court !== undefined) match.court = String(court).trim();
    if (venue !== undefined) match.venue = String(venue).trim();
    if (round !== undefined) {
      const parsedRound = Number(round);
      if (!Number.isInteger(parsedRound) || parsedRound < 1) return res.status(400).json({ message: 'Round must be a positive integer.' });
      match.round = parsedRound;
    }
    if (opponentRegistrationId !== undefined) {
      const opponent = await Registration.findOne({ _id: opponentRegistrationId, tournament: registration.tournament._id });
      if (!opponent) return res.status(400).json({ message: 'Opponent must be registered in the same tournament.' });
      if (String(match.player1) === String(registration._id)) match.player2 = opponent._id;
      else match.player1 = opponent._id;
    }
    await match.save();
    res.json({ message: 'Match schedule updated.' });
  } catch (error) {
    res.status(500).json({ message: 'Unable to update the match schedule.' });
  }
});

router.post('/student/verify', async (req, res) => {
  try {
    const { rollNumber, verification, sport } = req.body;
    if (!rollNumber || !verification) {
      return res.status(400).json({ message: 'Roll/Registration number and NIC or Email are required.' });
    }
    const cleanRoll = String(rollNumber).trim().toUpperCase();
    const cleanVer = String(verification).trim().toLowerCase();

    const sportsToSearch = sport && ['badminton', 'table-tennis', 'carrom'].includes(sport.toLowerCase())
      ? [sport.toLowerCase()]
      : ['badminton', 'table-tennis', 'carrom'];

    let foundReg = null;
    let foundSport = null;

    for (const s of sportsToSearch) {
      const { Registration } = getModelsForSport(s);
      const regList = await Registration.find({
        $or: [
          { rollNumber: new RegExp(`^${cleanRoll.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          { rollNumber: cleanRoll },
          { studentId: cleanRoll },
        ],
      }).sort({ createdAt: -1 });

      for (const reg of regList) {
        const regRoll = (reg.rollNumber || reg.studentId || '').trim().toUpperCase();
        const regNic = (reg.nicNo || reg.nic || '').trim().toLowerCase();
        const regEmail = (reg.email || '').trim().toLowerCase();

        if (
          regRoll === cleanRoll &&
          (regNic === cleanVer ||
            regEmail === cleanVer ||
            regNic.replace(/v$/i, '') === cleanVer.replace(/v$/i, ''))
        ) {
          foundReg = reg;
          foundSport = s;
          break;
        }
      }
      if (foundReg) break;
    }

    if (!foundReg) {
      return res.status(404).json({ message: 'No registered player pass found matching these credentials.' });
    }

    const { playerPass, token } = await ensurePlayerPass(foundSport, foundReg._id);
    let activeToken = token;
    if (!activeToken && playerPass?.tokenCipher) {
      try {
        activeToken = decryptToken(playerPass.tokenCipher);
      } catch (e) {
        activeToken = null;
      }
    }
    if (!activeToken) {
      const crypto = require('crypto');
      activeToken = crypto.randomBytes(32).toString('base64url');
      playerPass.tokenHash = hashToken(activeToken);
      playerPass.tokenCipher = encryptToken(activeToken);
      await playerPass.save();
    }

    const details = await buildPass(foundSport, foundReg._id);
    res.json({
      token: activeToken,
      passUrl: passUrl(activeToken, req.get('origin')),
      details,
    });
  } catch (error) {
    console.error('Student pass verification error:', error);
    res.status(500).json({ message: 'Unable to verify student pass at this time.' });
  }
});

router.get('/token/:token', async (req, res) => {
  try {
    const result = await findPassByToken(req.params.token);
    if (!result?.details) return res.status(404).json({ passStatus: 'invalid' });
    const { playerPass, details } = result;
    if (playerPass.isRevoked) details.passStatus = 'cancelled';
    res.set('Cache-Control', 'no-store').json(details);
  } catch (error) {
    res.status(500).json({ message: 'Unable to verify this player pass.' });
  }
});

router.get('/token/:token/pdf', async (req, res) => {
  try {
    const result = await findPassByToken(req.params.token);
    if (!result?.details) return res.status(404).json({ message: 'Pass not found.' });
    if (result.playerPass.isRevoked || result.details.passStatus !== 'valid')
      return res.status(403).json({ message: 'This player pass is not valid.' });
    await renderPassPdf(res, result.details, req.params.token);
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ message: 'Unable to generate the player pass PDF.' });
  }
});

module.exports = router;