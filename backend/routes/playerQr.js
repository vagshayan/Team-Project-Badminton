'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const mongoose = require('mongoose');
const { getModelsForSport } = require('../models/SportModels');
const Match = require('../models/Match');
const { protect } = require('../middleware/auth');
const { logAdminAction } = require('../utils/auditLogger');

const SPORTS = ['badminton', 'table-tennis', 'carrom'];

const SPORT_META = {
  badminton: { label: 'Badminton', icon: '🏸', color: '#3B82F6', unit: 'Court' },
  'table-tennis': { label: 'Table Tennis', icon: '🏓', color: '#8B5CF6', unit: 'Table' },
  carrom: { label: 'Carrom', icon: '🎯', color: '#EC4899', unit: 'Board' },
};

const CAT_LABELS = {
  'singles-men': 'Singles — Men',
  'singles-women': 'Singles — Women',
  'doubles-men': 'Doubles — Men',
  'doubles-women': 'Doubles — Women',
  'mixed-doubles': 'Mixed Doubles',
};

/**
 * Helper: Find registration and sport by QR Token across sport models.
 */
async function findRegistrationByToken(token) {
  if (!token || typeof token !== 'string') return null;
  const cleanToken = token.trim();

  for (const sport of SPORTS) {
    const { Registration, Tournament } = getModelsForSport(sport);
    let reg = await Registration.findOne({ qrToken: cleanToken }).populate('tournament');
    if (reg) {
      return { reg, sport, Registration, Tournament };
    }
  }

  // Fallback: Check standalone Registration model if exists
  try {
    const StandaloneRegistration = require('../models/Registration');
    const StandaloneTournament = require('../models/Tournament');
    let reg = await StandaloneRegistration.findOne({ qrToken: cleanToken }).populate('tournament');
    if (reg) {
      const sport = (reg.tournament && reg.tournament.sport) || 'badminton';
      return { reg, sport, Registration: StandaloneRegistration, Tournament: StandaloneTournament };
    }
  } catch (_) {}

  return null;
}

/**
 * Helper: Find registration and sport by Roll Number and optional sport.
 */
async function findRegistrationByRollNumber(rollNumber, preferredSport = null) {
  if (!rollNumber) return null;
  const cleanRoll = rollNumber.trim().toUpperCase();
  const searchSports = preferredSport ? [preferredSport, ...SPORTS.filter(s => s !== preferredSport)] : SPORTS;

  for (const sport of searchSports) {
    const { Registration, Tournament } = getModelsForSport(sport);
    // Find latest registration for this roll number
    let reg = await Registration.findOne({ rollNumber: cleanRoll }).populate('tournament').sort({ createdAt: -1 });
    if (reg) {
      return { reg, sport, Registration, Tournament };
    }
  }
  return null;
}

/**
 * Helper: Format round label based on round number and tournament bracket.
 */
function formatRoundLabel(round, maxRound) {
  if (!round) return 'Match';
  if (maxRound) {
    const diff = maxRound - round;
    if (diff === 0) return 'Final';
    if (diff === 1) return 'Semi-Final';
    if (diff === 2) return 'Quarter-Final';
    if (diff === 3) return 'Round of 16';
  }
  return `Round ${round}`;
}

// ─── 1. PUBLIC: GET PLAYER PASS BY TOKEN ──────────────────────────────────────
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const lookup = await findRegistrationByToken(token);

    if (!lookup) {
      return res.status(404).json({
        success: false,
        message: 'Invalid QR Code. No player registration found for this pass.',
      });
    }

    const { reg, sport } = lookup;

    if (reg.qrTokenRevoked) {
      return res.status(403).json({
        success: false,
        status: 'revoked',
        message: 'This QR code pass has been revoked or expired.',
      });
    }

    const sportMeta = SPORT_META[sport] || { label: sport, icon: '🏆', color: '#3B82F6', unit: 'Court' };
    const tournament = reg.tournament || {};

    const passData = {
      success: true,
      qrToken: reg.qrToken,
      qrTokenCreatedAt: reg.qrTokenCreatedAt || reg.createdAt,
      sport,
      sportLabel: sportMeta.label,
      sportIcon: sportMeta.icon,
      sportColor: sportMeta.color,
      courtUnit: sportMeta.unit,
      player: {
        id: reg._id,
        name: reg.playerName,
        rollNumber: reg.rollNumber,
        department: reg.department,
        year: reg.year || 'N/A',
        email: reg.email,
        phone: reg.phone,
        gender: reg.gender,
        partnerName: reg.partnerName || null,
        partnerRollNumber: reg.partnerRollNumber || null,
        pairStatus: reg.pairStatus || 'none',
      },
      tournament: {
        id: tournament._id,
        year: tournament.year,
        category: tournament.category,
        categoryLabel: CAT_LABELS[tournament.category] || tournament.category,
        venue: tournament.venue,
        date: tournament.date,
        time: tournament.time,
        isPublished: !!tournament.isPublished,
      },
      registration: {
        id: reg._id,
        status: reg.status, // 'pending' | 'confirmed' | 'rejected' | 'cancelled'
        statusLabel:
          reg.status === 'confirmed' ? 'Approved' :
          reg.status === 'pending' ? 'Pending' :
          reg.status === 'rejected' ? 'Rejected' : 'Cancelled',
        createdAt: reg.createdAt,
      },
    };

    res.json(passData);
  } catch (err) {
    console.error('Error fetching player pass:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve player pass.' });
  }
});

// ─── 2. PUBLIC: GET MATCHES & SCHEDULE FOR PLAYER PASS ────────────────────────
router.get('/:token/matches', async (req, res) => {
  try {
    const { token } = req.params;
    const lookup = await findRegistrationByToken(token);

    if (!lookup) {
      return res.status(404).json({ success: false, message: 'Player registration not found.' });
    }

    const { reg, sport } = lookup;
    const sportMeta = SPORT_META[sport] || { label: sport, icon: '🏆', unit: 'Court' };
    const tournamentId = reg.tournament ? reg.tournament._id : null;

    if (!tournamentId) {
      return res.json({ success: true, nextMatch: null, upcomingMatches: [], matchHistory: [] });
    }

    // Find all matches in this tournament or associated with this registration
    const allMatches = await Match.find({ tournament: tournamentId })
      .populate('player1')
      .populate('player2')
      .populate('winner')
      .populate('tournament')
      .sort({ round: 1, matchNumber: 1 });

    const maxRound = allMatches.reduce((max, m) => Math.max(max, m.round || 1), 1);

    const relevantMatches = [];

    for (const m of allMatches) {
      const p1Id = m.player1 ? (m.player1._id ? m.player1._id.toString() : m.player1.toString()) : null;
      const p2Id = m.player2 ? (m.player2._id ? m.player2._id.toString() : m.player2.toString()) : null;
      const regIdStr = reg._id.toString();

      // Check if player is player1 or player2
      const isPlayer1 = p1Id === regIdStr;
      const isPlayer2 = p2Id === regIdStr;

      if (!isPlayer1 && !isPlayer2) continue;

      const opponentDoc = isPlayer1 ? m.player2 : m.player1;

      const isWinner = m.isCompleted && m.winner && (
        (m.winner._id ? m.winner._id.toString() : m.winner.toString()) === regIdStr
      );

      const checkInRecord = (m.checkIns || []).find(
        (ci) => ci.rollNumber && ci.rollNumber.toUpperCase() === reg.rollNumber.toUpperCase()
      );

      const tDoc = m.tournament || reg.tournament || {};

      relevantMatches.push({
        id: m._id,
        round: m.round,
        roundLabel: formatRoundLabel(m.round, maxRound),
        matchNumber: m.matchNumber,
        sport,
        sportLabel: sportMeta.label,
        sportIcon: sportMeta.icon,
        category: tDoc.category,
        categoryLabel: CAT_LABELS[tDoc.category] || tDoc.category,
        venue: m.venue || tDoc.venue || 'Indoor Sports Complex',
        court: m.court || `${sportMeta.unit} ${m.matchNumber || 1}`,
        date: m.scheduledDate || tDoc.date,
        time: m.scheduledTime || tDoc.time || 'TBD',
        status: m.status || (m.isCompleted ? 'completed' : 'scheduled'),
        isCompleted: m.isCompleted,
        isWinner: !!isWinner,
        myScore: isPlayer1 ? m.score1 : m.score2,
        opponentScore: isPlayer1 ? m.score2 : m.score1,
        opponent: opponentDoc
          ? {
              name: opponentDoc.playerName || opponentDoc.name || 'Opponent',
              rollNumber: opponentDoc.rollNumber || '',
              department: opponentDoc.department || '',
              partnerName: opponentDoc.partnerName || null,
            }
          : { name: 'To Be Decided (Bye)', rollNumber: '', department: '' },
        isCheckedIn: !!checkInRecord,
        checkedInAt: checkInRecord ? checkInRecord.checkedInAt : null,
      });
    }

    const upcomingMatches = relevantMatches.filter((m) => !m.isCompleted && m.status !== 'cancelled');
    const matchHistory = relevantMatches.filter((m) => m.isCompleted || m.status === 'completed');
    const nextMatch = upcomingMatches.length > 0 ? upcomingMatches[0] : null;

    res.json({
      success: true,
      nextMatch,
      upcomingMatches,
      matchHistory,
      totalMatches: relevantMatches.length,
    });
  } catch (err) {
    console.error('Error fetching player matches:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve match schedule.' });
  }
});

// ─── 3. PUBLIC: GET NOTIFICATION & MATCH UPDATE TIMELINE ──────────────────────
router.get('/:token/timeline', async (req, res) => {
  try {
    const { token } = req.params;
    const lookup = await findRegistrationByToken(token);

    if (!lookup) {
      return res.status(404).json({ success: false, message: 'Player registration not found.' });
    }

    const { reg, sport } = lookup;
    const sportMeta = SPORT_META[sport] || { label: sport, icon: '🏆', unit: 'Court' };
    const timeline = [];

    // 1. Registration created event
    timeline.push({
      id: 'reg-created',
      title: 'Registration Received',
      message: `Registration submitted for ${sportMeta.label} (${CAT_LABELS[reg.tournament?.category] || 'Tournament'}).`,
      timestamp: reg.createdAt,
      type: 'registration',
      icon: '📝',
    });

    // 2. Registration status event
    if (reg.status === 'confirmed') {
      timeline.push({
        id: 'reg-approved',
        title: 'Registration Approved',
        message: 'Your registration has been officially approved by tournament administration.',
        timestamp: reg.updatedAt || reg.createdAt,
        type: 'approval',
        icon: '🟢',
      });
    } else if (reg.status === 'rejected') {
      timeline.push({
        id: 'reg-rejected',
        title: 'Registration Update',
        message: 'Registration was reviewed and rejected. Please contact sports admin for details.',
        timestamp: reg.updatedAt || reg.createdAt,
        type: 'rejection',
        icon: '🔴',
      });
    }

    // 3. Match timeline and events
    if (reg.tournament) {
      const allMatches = await Match.find({ tournament: reg.tournament._id })
        .populate('player1')
        .populate('player2')
        .populate('winner');

      for (const m of allMatches) {
        const p1Id = m.player1 ? (m.player1._id ? m.player1._id.toString() : m.player1.toString()) : null;
        const p2Id = m.player2 ? (m.player2._id ? m.player2._id.toString() : m.player2.toString()) : null;
        const regIdStr = reg._id.toString();

        if (p1Id !== regIdStr && p2Id !== regIdStr) continue;

        const isPlayer1 = p1Id === regIdStr;
        const opponent = isPlayer1 ? m.player2 : m.player1;
        const opponentName = opponent ? opponent.playerName || opponent.name || 'Opponent' : 'TBD';

        // Match scheduled event
        timeline.push({
          id: `match-sched-${m._id}`,
          title: `Match Scheduled (Round ${m.round})`,
          message: `Match vs ${opponentName} scheduled at ${m.venue || reg.tournament.venue || 'Indoor Complex'} (${m.court || `${sportMeta.unit} ${m.matchNumber}`}) on ${m.scheduledTime || reg.tournament.time || 'TBD'}.`,
          timestamp: m.createdAt,
          type: 'match-scheduled',
          icon: '📅',
        });

        // Match custom timeline updates (e.g. court changed, postponed)
        if (Array.isArray(m.timeline)) {
          m.timeline.forEach((item, idx) => {
            timeline.push({
              id: `match-update-${m._id}-${idx}`,
              title: 'Match Update',
              message: item.message,
              timestamp: item.timestamp || m.updatedAt,
              type: item.type || 'update',
              icon: item.type === 'court' ? '📍' : item.type === 'time' ? '⏰' : '🔔',
            });
          });
        }

        // Check-in event
        const checkIn = (m.checkIns || []).find(
          ci => ci.rollNumber && ci.rollNumber.toUpperCase() === reg.rollNumber.toUpperCase()
        );
        if (checkIn) {
          timeline.push({
            id: `checkin-${m._id}`,
            title: 'Player Checked In',
            message: `Successfully verified and checked in at venue for Round ${m.round} match.`,
            timestamp: checkIn.checkedInAt,
            type: 'check-in',
            icon: '✅',
          });
        }

        // Match completed event
        if (m.isCompleted) {
          const isWinner = m.winner && (m.winner._id ? m.winner._id.toString() : m.winner.toString()) === regIdStr;
          timeline.push({
            id: `match-done-${m._id}`,
            title: isWinner ? 'Match Won 🏆' : 'Match Completed',
            message: isWinner
              ? `Congratulations! You won Round ${m.round} match vs ${opponentName}.`
              : `Round ${m.round} match vs ${opponentName} has concluded.`,
            timestamp: m.updatedAt,
            type: 'result',
            icon: isWinner ? '🏆' : '🏁',
          });
        }
      }
    }

    // Sort newest first
    timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({ success: true, timeline });
  } catch (err) {
    console.error('Error fetching player timeline:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve timeline.' });
  }
});

// ─── 4. GENERATE / RE-ISSUE QR TOKEN FOR REGISTRATION ────────────────────────
router.post('/generate', async (req, res) => {
  try {
    const { registrationId, rollNumber, sport } = req.body;
    let targetReg = null;
    let targetSport = sport || 'badminton';

    if (registrationId) {
      for (const s of (sport ? [sport] : SPORTS)) {
        const { Registration } = getModelsForSport(s);
        const r = await Registration.findById(registrationId);
        if (r) { targetReg = r; targetSport = s; break; }
      }
    } else if (rollNumber) {
      const lookup = await findRegistrationByRollNumber(rollNumber, sport);
      if (lookup) {
        targetReg = lookup.reg;
        targetSport = lookup.sport;
      }
    }

    if (!targetReg) {
      return res.status(404).json({ success: false, message: 'Registration not found.' });
    }

    if (!targetReg.qrToken) {
      targetReg.qrToken = crypto.randomBytes(20).toString('hex');
      targetReg.qrTokenCreatedAt = new Date();
      targetReg.qrTokenRevoked = false;
      await targetReg.save();
    }

    res.json({
      success: true,
      qrToken: targetReg.qrToken,
      qrUrl: `/player/qr/${targetReg.qrToken}`,
      sport: targetSport,
      playerName: targetReg.playerName,
      rollNumber: targetReg.rollNumber,
    });
  } catch (err) {
    console.error('Error generating QR token:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── 5. ADMIN: VERIFY SCANNED QR PASS / ROLL NUMBER ───────────────────────────
router.post('/admin/verify', protect, async (req, res) => {
  try {
    const { qrInput, rollNumber } = req.body;
    let lookup = null;

    if (qrInput) {
      // Clean scanned input: could be full URL "http://.../player/qr/abc123" or raw token "abc123"
      let token = qrInput.trim();
      const matchUrl = token.match(/\/player\/qr\/([a-zA-Z0-9_-]+)/i) || token.match(/\/pass\/([a-zA-Z0-9_-]+)/i) || token.match(/\/player-pass\/([a-zA-Z0-9_-]+)/i);
      if (matchUrl && matchUrl[1]) {
        token = matchUrl[1];
      }
      lookup = await findRegistrationByToken(token);
    }

    if (!lookup && rollNumber) {
      lookup = await findRegistrationByRollNumber(rollNumber, req.admin.sport);
    }

    if (!lookup) {
      return res.status(404).json({
        success: false,
        verified: false,
        message: 'Invalid QR code or Player not found.',
      });
    }

    const { reg, sport } = lookup;
    const sportMeta = SPORT_META[sport] || { label: sport, icon: '🏆', unit: 'Court' };
    const tournament = reg.tournament || {};

    // Validate admin authority / sport alignment
    const isAuthorizedSport = req.admin.sport === 'superadmin' || req.admin.sport === sport;

    // Find current or upcoming match
    const upcomingMatches = await Match.find({
      tournament: tournament._id,
      isCompleted: false,
      status: { $ne: 'cancelled' },
      $or: [{ player1: reg._id }, { player2: reg._id }],
    }).populate('player1').populate('player2').sort({ round: 1 });

    const currentMatch = upcomingMatches.length > 0 ? upcomingMatches[0] : null;

    let checkInRecord = null;
    if (currentMatch && Array.isArray(currentMatch.checkIns)) {
      checkInRecord = currentMatch.checkIns.find(
        ci => ci.rollNumber && ci.rollNumber.toUpperCase() === reg.rollNumber.toUpperCase()
      );
    }

    // Eligibility computation
    let eligible = true;
    let reason = 'Player is approved and eligible for tournament play.';

    if (reg.qrTokenRevoked) {
      eligible = false;
      reason = 'QR pass is revoked or expired.';
    } else if (reg.status === 'pending') {
      eligible = false;
      reason = 'Registration is pending admin approval.';
    } else if (reg.status === 'rejected') {
      eligible = false;
      reason = 'Registration was rejected by administration.';
    } else if (reg.status === 'cancelled') {
      eligible = false;
      reason = 'Registration has been cancelled.';
    } else if (!isAuthorizedSport) {
      eligible = false;
      reason = `Sport mismatch: Pass is for ${sportMeta.label}, but current admin is ${req.admin.sport}.`;
    }

    let opponentName = 'TBD';
    if (currentMatch) {
      const p1Id = currentMatch.player1 ? currentMatch.player1._id.toString() : null;
      const isPlayer1 = p1Id === reg._id.toString();
      const opp = isPlayer1 ? currentMatch.player2 : currentMatch.player1;
      if (opp) opponentName = opp.playerName || opp.name || 'Opponent';
    }

    res.json({
      success: true,
      verified: true,
      eligible,
      reason,
      sport,
      sportLabel: sportMeta.label,
      sportIcon: sportMeta.icon,
      player: {
        id: reg._id,
        name: reg.playerName,
        rollNumber: reg.rollNumber,
        department: reg.department,
        year: reg.year,
        nicNo: reg.nicNo,
        email: reg.email,
        phone: reg.phone,
        partnerName: reg.partnerName || null,
        partnerRollNumber: reg.partnerRollNumber || null,
      },
      registration: {
        id: reg._id,
        status: reg.status,
        statusLabel: reg.status === 'confirmed' ? 'Approved' : reg.status === 'pending' ? 'Pending' : reg.status,
        createdAt: reg.createdAt,
        qrToken: reg.qrToken,
      },
      tournament: {
        id: tournament._id,
        category: tournament.category,
        categoryLabel: CAT_LABELS[tournament.category] || tournament.category,
        year: tournament.year,
        venue: tournament.venue,
        date: tournament.date,
        time: tournament.time,
      },
      currentMatch: currentMatch
        ? {
            id: currentMatch._id,
            round: currentMatch.round,
            matchNumber: currentMatch.matchNumber,
            opponentName,
            venue: currentMatch.venue || tournament.venue,
            court: currentMatch.court || `${sportMeta.unit} ${currentMatch.matchNumber}`,
            date: currentMatch.scheduledDate || tournament.date,
            time: currentMatch.scheduledTime || tournament.time,
            status: currentMatch.status,
            isCheckedIn: !!checkInRecord,
            checkedInAt: checkInRecord ? checkInRecord.checkedInAt : null,
          }
        : null,
    });
  } catch (err) {
    console.error('Error verifying player pass:', err);
    res.status(500).json({ success: false, message: 'Verification failed: ' + err.message });
  }
});

// ─── 6. ADMIN: CHECK-IN PLAYER FOR MATCH ──────────────────────────────────────
router.post('/admin/check-in', protect, async (req, res) => {
  try {
    const { qrToken, rollNumber, matchId } = req.body;

    let lookup = null;
    if (qrToken) lookup = await findRegistrationByToken(qrToken);
    if (!lookup && rollNumber) lookup = await findRegistrationByRollNumber(rollNumber, req.admin.sport);

    if (!lookup) {
      return res.status(404).json({ success: false, message: 'Player registration not found.' });
    }

    const { reg, sport } = lookup;
    const sportMeta = SPORT_META[sport] || { label: sport, icon: '🏆', unit: 'Court' };

    if (reg.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: `Cannot check in: player registration is ${reg.status.toUpperCase()} (Approval required).`,
      });
    }

    // Find the match
    let match = null;
    if (matchId) {
      match = await Match.findById(matchId);
    } else {
      // Find current upcoming match
      match = await Match.findOne({
        tournament: reg.tournament._id,
        isCompleted: false,
        status: { $ne: 'cancelled' },
        $or: [{ player1: reg._id }, { player2: reg._id }],
      }).sort({ round: 1 });
    }

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'No active or scheduled match found to check in for this player.',
      });
    }

    if (!Array.isArray(match.checkIns)) {
      match.checkIns = [];
    }

    // Duplicate check-in verification
    const existingCheckIn = match.checkIns.find(
      ci => ci.rollNumber && ci.rollNumber.toUpperCase() === reg.rollNumber.toUpperCase()
    );

    if (existingCheckIn) {
      return res.status(400).json({
        success: false,
        alreadyCheckedIn: true,
        message: `Player ${reg.playerName} (${reg.rollNumber}) has already checked in for Match #${match.matchNumber}.`,
        checkIn: existingCheckIn,
      });
    }

    const newCheckIn = {
      rollNumber: reg.rollNumber,
      playerName: reg.playerName,
      checkedInAt: new Date(),
      checkedInBy: req.admin._id,
    };

    match.checkIns.push(newCheckIn);

    if (!Array.isArray(match.timeline)) match.timeline = [];
    match.timeline.push({
      message: `Player ${reg.playerName} (${reg.rollNumber}) checked in for Round ${match.round} match.`,
      timestamp: new Date(),
      type: 'check-in',
    });

    await match.save();

    // Log admin audit action
    await logAdminAction({
      adminId: req.admin._id,
      action: 'CHECKIN_PLAYER',
      targetId: match._id,
      targetModel: 'Match',
      details: {
        rollNumber: reg.rollNumber,
        playerName: reg.playerName,
        matchId: match._id,
        round: match.round,
        sport,
      },
      req,
    }).catch(() => {});

    res.json({
      success: true,
      message: `🟢 Player ${reg.playerName} checked in successfully for Round ${match.round} (${match.court || `${sportMeta.unit} ${match.matchNumber}`}).`,
      checkIn: newCheckIn,
      match: {
        id: match._id,
        round: match.round,
        matchNumber: match.matchNumber,
        court: match.court,
        venue: match.venue,
      },
    });
  } catch (err) {
    console.error('Error during match check-in:', err);
    res.status(500).json({ success: false, message: 'Check-in failed: ' + err.message });
  }
});

// ─── 7. ADMIN: UPDATE MATCH SCHEDULE & TIMELINE (Court, Venue, Time, Status) ──
router.patch('/admin/matches/:matchId/schedule', protect, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { court, venue, scheduledTime, scheduledDate, status, note } = req.body;

    const match = await Match.findById(matchId).populate('player1').populate('player2');
    if (!match) return res.status(404).json({ success: false, message: 'Match not found.' });

    const updates = [];

    if (court !== undefined && court !== match.court) {
      updates.push(`Court changed from "${match.court || 'Default'}" to "${court}"`);
      match.court = court;
    }

    if (venue !== undefined && venue !== match.venue) {
      updates.push(`Venue changed to "${venue}"`);
      match.venue = venue;
    }

    if (scheduledTime !== undefined && scheduledTime !== match.scheduledTime) {
      updates.push(`Match time updated to ${scheduledTime}`);
      match.scheduledTime = scheduledTime;
    }

    if (scheduledDate !== undefined) {
      match.scheduledDate = scheduledDate;
      updates.push(`Match date scheduled for ${new Date(scheduledDate).toLocaleDateString()}`);
    }

    if (status && status !== match.status) {
      updates.push(`Match status updated to ${status.toUpperCase()}`);
      match.status = status;
    }

    if (note) {
      updates.push(note);
    }

    if (!Array.isArray(match.timeline)) match.timeline = [];

    updates.forEach((msg) => {
      match.timeline.push({
        message: msg,
        timestamp: new Date(),
        type: 'update',
      });
    });

    await match.save();

    await logAdminAction({
      adminId: req.admin._id,
      action: 'UPDATE_MATCH_SCHEDULE',
      targetId: match._id,
      targetModel: 'Match',
      details: { updates, matchId },
      req,
    }).catch(() => {});

    res.json({
      success: true,
      message: 'Match schedule updated successfully.',
      match,
      updates,
    });
  } catch (err) {
    console.error('Error updating match schedule:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── 8. ADMIN: GET ALL CHECK-INS FOR TOURNAMENT ───────────────────────────────
router.get('/admin/check-ins/:tournamentId', protect, async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const matches = await Match.find({ tournament: tournamentId })
      .populate('player1')
      .populate('player2');

    const checkInsList = [];

    matches.forEach((m) => {
      if (Array.isArray(m.checkIns)) {
        m.checkIns.forEach((ci) => {
          checkInsList.push({
            matchId: m._id,
            round: m.round,
            matchNumber: m.matchNumber,
            court: m.court,
            rollNumber: ci.rollNumber,
            playerName: ci.playerName,
            checkedInAt: ci.checkedInAt,
            checkedInBy: ci.checkedInBy,
          });
        });
      }
    });

    res.json({ success: true, checkIns: checkInsList, totalCheckIns: checkInsList.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
module.exports.findRegistrationByToken = findRegistrationByToken;
module.exports.findRegistrationByRollNumber = findRegistrationByRollNumber;
