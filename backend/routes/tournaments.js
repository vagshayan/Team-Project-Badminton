const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Admin = require('../models/Admin');
const AuditLog = require('../models/AuditLog');
const { getModelsForSport } = require('../models/SportModels');
const Match = require('../models/Match');
const { protect } = require('../middleware/auth');
const { logAdminAction } = require('../utils/auditLogger');
const {
  sendScheduleUpdateBatchEmail,
  sendDrawPublishedEmail,
} = require('../utils/emailService');

const SINGLES = ['singles-men', 'singles-women'];
const CATEGORY_LABELS = {
  'singles-men': "Men's Singles",
  'singles-women': "Women's Singles",
  'doubles-men': "Men's Doubles",
  'doubles-women': "Women's Doubles",
  'mixed-doubles': 'Mixed Doubles',
};

function nextPowerOf2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDoublesByeOrder(teams, bracketSize) {
  const shuffledTeams = shuffle(teams);
  const byeCount = bracketSize - shuffledTeams.length;
  const teamsPlayingFirstRound = shuffledTeams.length - byeCount;
  const matchSlots = [];

  for (let i = 0; i < teamsPlayingFirstRound; i += 2) {
    matchSlots.push([shuffledTeams[i], shuffledTeams[i + 1]]);
  }

  for (let i = teamsPlayingFirstRound; i < shuffledTeams.length; i++) {
    matchSlots.push([shuffledTeams[i], null]);
  }

  if (
    matchSlots.length !== bracketSize / 2 ||
    matchSlots.some(([team1, team2]) => !team1 && !team2)
  ) {
    throw new Error('Unable to create a valid doubles bracket without empty matches.');
  }

  return shuffle(matchSlots).flat();
}

function buildDoublesPairEntries(approvedRegs) {
  const used = new Set();
  const pairs = [];
  const unresolved = [];

  const addPair = (leader, partner) => {
    if (!leader || !partner) return;
    const leaderId = leader._id.toString();
    const partnerId = partner._id.toString();
    if (leaderId === partnerId || used.has(leaderId) || used.has(partnerId)) return;

    used.add(leaderId);
    used.add(partnerId);
    pairs.push(leader);
  };

  approvedRegs.forEach((reg) => {
    if (used.has(reg._id.toString())) return;

    const partnerByPairId = approvedRegs.find((candidate) => {
      if (candidate._id.toString() === reg._id.toString()) return false;
      return candidate.pairId && reg.pairId && candidate.pairId.toString() === reg.pairId.toString();
    });

    if (partnerByPairId) {
      addPair(reg, partnerByPairId);
      return;
    }

    const partnerByRoll = approvedRegs.find((candidate) => {
      if (candidate._id.toString() === reg._id.toString()) return false;
      return candidate.rollNumber && reg.partnerRollNumber && candidate.rollNumber.trim().toLowerCase() === reg.partnerRollNumber.trim().toLowerCase();
    });

    if (partnerByRoll) {
      addPair(reg, partnerByRoll);
      return;
    }

    unresolved.push(reg);
  });

  return { pairs, unresolved };
}

function buildSeededOrder(players, championId, runnerUpId, bracketSize) {
  const seeded1 = players.find(p => p._id.toString() === String(championId));
  let seeded2 = players.find(p => p._id.toString() === String(runnerUpId));

  if (seeded1 && seeded2 && seeded1._id.toString() === seeded2._id.toString()) {
    seeded2 = null;
  }

  const rest = shuffle(players.filter(p => {
    if (seeded1 && p._id.toString() === seeded1._id.toString()) return false;
    if (seeded2 && p._id.toString() === seeded2._id.toString()) return false;
    return true;
  }));

  const totalMatches = bracketSize / 2;
  const naturalByes = bracketSize - players.length;

  // Full brackets have no bye slots, so keep the two seeds in opposite halves.
  if (naturalByes === 0 && bracketSize >= 4) {
    const result = new Array(bracketSize).fill(null);
    const halfSize = bracketSize / 2;

    if (seeded1) {
      result[Math.floor(Math.random() * halfSize)] = seeded1;
    }
    if (seeded2) {
      result[halfSize + Math.floor(Math.random() * halfSize)] = seeded2;
    }

    let restIdx = 0;
    for (let i = 0; i < result.length; i++) {
      if (!result[i]) result[i] = rest[restIdx++];
    }

    return result;
  }

  const fightingPlayers = players.length - naturalByes;
  const r1Winners = fightingPlayers / 2;

  const canPlaceChamp = !!seeded1 && naturalByes >= 1 && r1Winners >= 1;
  const canPlaceRunnerup = !!seeded2 && naturalByes >= 2 && r1Winners >= 2;
  const activeSeedByes = (canPlaceChamp ? 1 : 0) + (canPlaceRunnerup ? 1 : 0);

  // Seeds that can't be placed rejoin as fighters
  const extraFighters = [];
  if (seeded1 && !canPlaceChamp) extraFighters.push(seeded1);
  if (seeded2 && !canPlaceRunnerup) extraFighters.push(seeded2);

  const allRest = [...rest, ...extraFighters];
  const restByes = naturalByes - activeSeedByes; // e.g. 4-2=2
  const fighters = allRest.slice(0, fightingPlayers); // exactly 8
  const byeRest = allRest.slice(fightingPlayers);    // exactly 2

  // Pre-calculate which matchIdx slots are reserved
  // M0 = first fighting match (always)
  // M1 = Champion bye (if canPlaceChamp)
  // M(last-1) = last fighting match (if canPlaceRunnerup)
  // M(last)   = Runner-up bye (if canPlaceRunnerup)
  // Everything else = distribute remaining fighters first, then byeRest

  const reservedSlots = new Set();
  reservedSlots.add(0); // first fighting match
  if (canPlaceChamp) reservedSlots.add(1);
  if (canPlaceRunnerup) reservedSlots.add(totalMatches - 1);
  if (canPlaceRunnerup) reservedSlots.add(totalMatches - 2);

  // Count how many middle slots exist
  const middleSlots = [];
  for (let i = 0; i < totalMatches; i++) {
    if (!reservedSlots.has(i)) middleSlots.push(i);
  }

  // Fighters used: 2 for M0 + 2 for M(last-1) if runnerup = fightingPlayers
  // Remaining fighters for middle = fightingPlayers - 2 - (canPlaceRunnerup ? 2 : 0)
  const fightersUsedByReserved = 2 + (canPlaceRunnerup ? 2 : 0);
  const middleFighterPairs = (fightingPlayers - fightersUsedByReserved) / 2;
  // Remaining middle slots go to byeRest players

  const result = new Array(bracketSize).fill(null);
  let fighterIdx = 0;
  let byeRestIdx = 0;
  let middleFighterPairsPlaced = 0;

  for (let matchIdx = 0; matchIdx < totalMatches; matchIdx++) {
    const slot = matchIdx * 2;

    if (matchIdx === 0) {
      // First fighting match → winner faces Champion in R2
      result[slot] = fighters[fighterIdx++];
      result[slot + 1] = fighters[fighterIdx++];

    } else if (matchIdx === 1 && canPlaceChamp) {
      // Champion bye
      result[slot] = seeded1;
      result[slot + 1] = null;

    } else if (matchIdx === totalMatches - 2 && canPlaceRunnerup) {
      // Last fighting match → winner faces Runner-up in R2
      result[slot] = fighters[fighterIdx++];
      result[slot + 1] = fighters[fighterIdx++];

    } else if (matchIdx === totalMatches - 1 && canPlaceRunnerup) {
      // Runner-up bye
      result[slot] = seeded2;
      result[slot + 1] = null;

    } else {
      // Middle slots - fighters first, then byeRest
      if (middleFighterPairsPlaced < middleFighterPairs) {
        result[slot] = fighters[fighterIdx++];
        result[slot + 1] = fighters[fighterIdx++];
        middleFighterPairsPlaced++;
      } else {
        result[slot] = byeRest[byeRestIdx++] || null;
        result[slot + 1] = null;
      }
    }
  }

  return result;
}

async function advanceWinner(match) {
  if (!match.nextMatchId) return;
  const nextMatch = await Match.findById(match.nextMatchId);
  if (!nextMatch) return;
  if (match.positionInNextMatch === 1) {
    nextMatch.player1 = match.winner;
  } else {
    nextMatch.player2 = match.winner;
  }
  await nextMatch.save();
}

// ─── STATS ───────────────────────────────────────────────
router.get('/stats', protect, async (req, res) => {
  try {
    const { Tournament, Registration } = getModelsForSport(req.admin.sport);
    const sportTournaments = await Tournament.find({ createdBy: req.admin._id });
    const tournamentIds = sportTournaments.map(t => t._id);
    const totalPlayers = await Registration.countDocuments({ tournament: { $in: tournamentIds }, status: 'confirmed' });
    const pendingApprovals = await Registration.countDocuments({ tournament: { $in: tournamentIds }, status: 'pending' });
    const activeCategories = [...new Set(sportTournaments.map(t => t.category))].length;
    res.json({ totalPlayers, pendingApprovals, activeCategories });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── ADMIN DASHBOARD SUMMARY ─────────────────────────────
router.get('/dashboard-summary', protect, async (req, res) => {
  try {
    const { Tournament, Registration } = getModelsForSport(req.admin.sport);
    const tournaments = await Tournament.find({ createdBy: req.admin._id }).sort({ date: 1 }).lean();
    const tournamentIds = tournaments.map((tournament) => tournament._id);
    const registrations = await Registration.find({ tournament: { $in: tournamentIds } }).lean();
    const matches = await Match.find({ tournament: { $in: tournamentIds } }).sort({ createdAt: 1 }).lean();
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const tournamentById = new Map(tournaments.map((tournament) => [String(tournament._id), tournament]));
    const registrationsByTournament = new Map();
    registrations.forEach((registration) => {
      const key = String(registration.tournament);
      if (!registrationsByTournament.has(key)) registrationsByTournament.set(key, []);
      registrationsByTournament.get(key).push(registration);
    });
    const matchesByTournament = new Map();
    matches.forEach((match) => {
      const key = String(match.tournament);
      if (!matchesByTournament.has(key)) matchesByTournament.set(key, []);
      matchesByTournament.get(key).push(match);
    });

    const tournamentData = tournaments.map((tournament) => {
      const tournamentMatches = matchesByTournament.get(String(tournament._id)) || [];
      const tournamentRegistrations = registrationsByTournament.get(String(tournament._id)) || [];
      const confirmedPlayers = tournamentRegistrations.filter((registration) => registration.status === 'confirmed').length;
      const completedMatches = tournamentMatches.filter((match) => match.isCompleted).length;
      const totalMatches = tournamentMatches.length;
      const progress = totalMatches ? Math.round((completedMatches / totalMatches) * 100) : 0;
      const currentRound = tournamentMatches.filter((match) => !match.isCompleted).reduce((round, match) => Math.max(round, match.round || 0), 0);
      const deadline = tournament.registrationDeadline || tournament.date;
      const status = tournament.isPublished || tournament.isLocked ? 'In Progress' : (new Date(deadline) >= dayStart ? 'Registration Open' : 'Completed');
      return {
        ...tournament,
        confirmedPlayers,
        totalRegistrations: tournamentRegistrations.length,
        completedMatches,
        totalMatches,
        progress,
        currentRound,
        status,
      };
    });

    const activeTournaments = tournamentData.filter((tournament) => tournament.isActive && tournament.status !== 'Completed');
    const pendingApprovals = registrations.filter((registration) => registration.status === 'pending').length;
    const matchesToday = matches.filter((match) => {
      const tournament = tournamentById.get(String(match.tournament));
      return tournament && new Date(tournament.date) >= dayStart && new Date(tournament.date) < dayEnd;
    });
    const upcomingMatches = matches.filter((match) => !match.isCompleted && match.player1 && match.player2)
      .map((match) => ({ ...match, tournament: tournamentById.get(String(match.tournament)) }))
      .filter((match) => match.tournament)
      .sort((a, b) => new Date(a.tournament.date) - new Date(b.tournament.date))
      .slice(0, 5);
    const auditLogs = await AuditLog.find({ admin: req.admin._id, sport: req.admin.sport })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();

    res.json({
      confirmedPlayers: registrations.filter((registration) => registration.status === 'confirmed').length,
      pendingApprovals,
      activeTournaments: activeTournaments.length,
      matchesToday: matchesToday.length,
      activeTournamentData: activeTournaments,
      upcomingMatches,
      attentionItems: [
        pendingApprovals > 0 ? { type: 'pending', count: pendingApprovals, message: `${pendingApprovals} player approval${pendingApprovals === 1 ? '' : 's'} pending`, tab: 'pending-approvals' } : null,
        activeTournaments.filter((tournament) => tournament.confirmedPlayers >= 2 && !tournament.isLocked).map((tournament) => ({ type: 'bracket', message: `Generate bracket for ${CATEGORY_LABELS[tournament.category] || tournament.category}`, tab: 'brackets' })),
      ].flat().filter(Boolean),
      recentActivity: auditLogs,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── PUBLIC - students view tournaments for REGISTRATION ──
router.get('/public/:sport', async (req, res) => {
  try {
    const { Tournament } = getModelsForSport(req.params.sport);
    const tournaments = await Tournament.find({
      sport: req.params.sport,
      isActive: true,
      // No isPublished filter - ALL active tournaments visible for registration
    })
      .populate('createdBy', 'name')
      .sort({ date: 1 });

    const validTournaments = tournaments.filter((tournament) => tournament.createdBy && tournament.createdBy._id);
    res.json(validTournaments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── PUBLIC - students view matches (no login needed) ────
router.get('/public/:tournamentId/matches', async (req, res) => {
  try {
    const { sport } = req.query;
    if (!sport) return res.status(400).json({ message: 'sport query parameter required' });
    const { Tournament, Registration } = getModelsForSport(sport);

    const tournament = await Tournament.findOne({
      _id: req.params.tournamentId,
      isPublished: true
    });
    if (!tournament) return res.status(404).json({ message: 'Tournament not found or not published yet' });

    const matches = await Match.find({ tournament: req.params.tournamentId })
      .sort({ round: 1, matchNumber: 1 });

    const populated = await Promise.all(matches.map(async (m) => {
      const obj = m.toObject();
      if (m.player1) obj.player1 = await Registration.findById(m.player1);
      if (m.player2) obj.player2 = await Registration.findById(m.player2);
      if (m.winner) obj.winner = await Registration.findById(m.winner);
      return obj;
    }));

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── ADMIN - own sport tournaments ───────────────────────
router.get('/admin', protect, async (req, res) => {
  try {
    const { Tournament } = getModelsForSport(req.admin.sport);
    const tournaments = await Tournament.find({ createdBy: req.admin._id })
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
    res.json(tournaments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── ADMIN - audit logs for current admin ─────────────────────
router.get('/audit-logs', protect, async (req, res) => {
  try {
    const { search, from, to, action } = req.query;
    const query = { admin: req.admin._id, sport: req.admin.sport };

    if (action && action !== 'all') query.action = action;

    if (search) {
      const q = new RegExp(search, 'i');
      query.$or = [
        { action: q },
        { targetModel: q },
        { details: q },
        { 'admin.name': q }
      ];
    }

    const createdAtQuery = {};
    if (from) {
      const start = new Date(from);
      if (!Number.isNaN(start.getTime())) {
        createdAtQuery.$gte = start;
      }
    }
    if (to) {
      const end = new Date(to);
      if (!Number.isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        createdAtQuery.$lte = end;
      }
    }
    if (Object.keys(createdAtQuery).length > 0) {
      query.createdAt = createdAtQuery;
    }

    const logs = await AuditLog.find(query)
      .populate('admin', 'name username sport')
      .sort({ createdAt: -1 })
      .limit(500);

    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── CREATE ───────────────────────────────────────────────
router.post('/', protect, async (req, res) => {
  const { year, date, time, venue, category, registrationDeadline } = req.body;
  if (!registrationDeadline) return res.status(400).json({ message: 'Registration deadline is required' });
  const currentYear = new Date().getFullYear();
  if (year < currentYear) return res.status(400).json({ message: 'Year cannot be in the past' });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (new Date(date) < today) return res.status(400).json({ message: 'Date cannot be in the past' });
  
  const deadlineDate = new Date(registrationDeadline);
  if (deadlineDate < today) return res.status(400).json({ message: 'Registration deadline cannot be in the past' });
  if (deadlineDate > new Date(date)) return res.status(400).json({ message: 'Registration deadline cannot be after the tournament date' });

  try {
    const { Tournament } = getModelsForSport(req.admin.sport);
    const existing = await Tournament.findOne({ sport: req.admin.sport, year, category, createdBy: req.admin._id });
    if (existing) return res.status(400).json({ message: `A ${category} tournament already exists for ${year}.` });
    const tournament = await Tournament.create({
      sport: req.admin.sport, year, date, time, venue, category, registrationDeadline: deadlineDate, createdBy: req.admin._id,
    });
    // Log Audit action
    await logAdminAction({
      adminId: req.admin._id,
      action: 'CREATE_TOURNAMENT',
      targetId: tournament._id,
      targetModel: 'Tournament',
      details: { sport: req.admin.sport, year, category, date, venue },
      req
    });
    res.status(201).json(tournament);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ─── UPDATE - password required ──────────────────────────
router.put('/:id', protect, async (req, res) => {
  const { password, year, date, time, venue, category, registrationDeadline } = req.body;
  try {
    if (!password) return res.status(400).json({ message: 'Password is required to update' });

    const admin = await Admin.findById(req.admin._id);
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Incorrect password' });

    const currentYear = new Date().getFullYear();
    if (year < currentYear) return res.status(400).json({ message: 'Year cannot be in the past' });
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (new Date(date) < today) return res.status(400).json({ message: 'Date cannot be in the past' });

    if (registrationDeadline && new Date(registrationDeadline) > new Date(date)) {
      return res.status(400).json({ message: 'Registration deadline cannot be after the tournament date' });
    }

    const { Tournament } = getModelsForSport(req.admin.sport);
    const tournament = await Tournament.findOne({ _id: req.params.id, createdBy: req.admin._id });
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
    if (tournament.isPublished || tournament.isLocked) {
      return res.status(400).json({ message: 'Cannot update a locked or published tournament' });
    }

    const existing = await Tournament.findOne({ _id: { $ne: req.params.id }, sport: req.admin.sport, year, category, createdBy: req.admin._id });
    if (existing) return res.status(400).json({ message: `A ${category} tournament already exists for ${year}.` });

    const beforeValues = {
      year: tournament.year,
      date: tournament.date,
      time: tournament.time,
      venue: tournament.venue,
      category: tournament.category,
      registrationDeadline: tournament.registrationDeadline,
    };

    const updateFields = { year, date, time, venue, category };
    if (registrationDeadline) updateFields.registrationDeadline = new Date(registrationDeadline);

    Object.assign(tournament, updateFields);
    await tournament.save();

    await logAdminAction({
      adminId: req.admin._id,
      action: 'UPDATE_TOURNAMENT',
      targetId: tournament._id,
      targetModel: 'Tournament',
      details: {
        before: beforeValues,
        after: updateFields,
      },
      req
    });

    // Detect what changed to notify affected registered participants
    const changes = [];
    const beforeDate = beforeValues.date ? new Date(beforeValues.date).toISOString().split('T')[0] : '';
    const newDate = tournament.date ? new Date(tournament.date).toISOString().split('T')[0] : '';
    if (beforeDate && newDate && beforeDate !== newDate) {
      changes.push({
        field: 'Event Date',
        previous: new Date(beforeValues.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
        updated: new Date(tournament.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
      });
    }

    if (beforeValues.time && tournament.time && beforeValues.time.trim() !== tournament.time.trim()) {
      changes.push({
        field: 'Start Time',
        previous: beforeValues.time,
        updated: tournament.time,
      });
    }

    if (beforeValues.venue && tournament.venue && beforeValues.venue.trim() !== tournament.venue.trim()) {
      changes.push({
        field: 'Venue',
        previous: beforeValues.venue,
        updated: tournament.venue,
      });
    }

    const beforeDeadline = beforeValues.registrationDeadline ? new Date(beforeValues.registrationDeadline).toISOString().split('T')[0] : '';
    const newDeadline = tournament.registrationDeadline ? new Date(tournament.registrationDeadline).toISOString().split('T')[0] : '';
    if (beforeDeadline && newDeadline && beforeDeadline !== newDeadline) {
      changes.push({
        field: 'Registration Deadline',
        previous: new Date(beforeValues.registrationDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        updated: new Date(tournament.registrationDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      });
    }

    if (changes.length > 0) {
      // Find all registered participants for this specific tournament
      const { Registration } = getModelsForSport(req.admin.sport);
      const registeredParticipants = await Registration.find({
        tournament: tournament._id,
        status: { $in: ['pending', 'confirmed'] },
      }).select('email playerName');

      if (registeredParticipants.length > 0) {
        sendScheduleUpdateBatchEmail({
          participants: registeredParticipants,
          sport: req.admin.sport,
          category: tournament.category,
          changes,
          currentSchedule: {
            date: tournament.date,
            time: tournament.time,
            venue: tournament.venue,
            registrationDeadline: tournament.registrationDeadline,
          },
        }).catch((emailErr) => {
          console.error('[Notification] Schedule update batch email error:', emailErr.message);
        });
      }
    }

    res.json(tournament);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ─── RESET DRAW (blocked if published) ───────────────────
router.delete('/:id/reset-draw', protect, async (req, res) => {
  try {
    const { Tournament } = getModelsForSport(req.admin.sport);
    const tournament = await Tournament.findOne({
      _id: req.params.id,
      createdBy: req.admin._id
    });
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
    if (tournament.isPublished) return res.status(400).json({ message: 'Cannot reset a published draw. Draw is already public!' });
    tournament.isLocked = false;
    tournament.winner = null;
    await tournament.save();
    await Match.deleteMany({ tournament: req.params.id });
    // Log Audit action
    await logAdminAction({
      adminId: req.admin._id,
      action: 'RESET_DRAW',
      targetId: tournament._id,
      targetModel: 'Tournament',
      details: { category: tournament.category, year: tournament.year },
      req
    });
    res.json({ message: 'Draw reset successfully. You can now regenerate.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// ─── FORCE UNLOCK (testing only - bypasses publish safety) ─
router.delete('/:id/force-unlock', protect, async (req, res) => {
  try {
    const { Tournament } = getModelsForSport(req.admin.sport);
    const tournament = await Tournament.findOne({
      _id: req.params.id,
      createdBy: req.admin._id
    });
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
    tournament.isLocked = false;
    tournament.isPublished = false;
    tournament.winner = null;
    await tournament.save();
    await Match.deleteMany({ tournament: req.params.id });
    // Log Audit action
    await logAdminAction({
      adminId: req.admin._id,
      action: 'FORCE_UNLOCK_DRAW',
      targetId: tournament._id,
      targetModel: 'Tournament',
      details: { category: tournament.category, year: tournament.year },
      req
    });
    res.json({ message: 'Tournament force-unlocked for testing. Draw, lock, and publish status all reset.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// ─── DELETE TOURNAMENT - password required ────────────────
router.delete('/:id', protect, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ message: 'Password is required to delete' });
  try {
    const admin = await Admin.findById(req.admin._id);
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Incorrect password' });
    const { Tournament, Registration, Player, Pair, PartnerRequest } = getModelsForSport(req.admin.sport);
    const tournament = await Tournament.findOne({ _id: req.params.id, createdBy: req.admin._id });
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const registrations = await Registration.find({ tournament: req.params.id }).session(session);
        const regRollNumbers = registrations.map((reg) => String(reg.rollNumber || '').trim().toUpperCase()).filter(Boolean);

        for (const reg of registrations) {
          const partnerRoll = String(reg.partnerRollNumber || '').trim().toUpperCase();
          if (partnerRoll) {
            await Registration.findOneAndUpdate(
              { tournament: req.params.id, rollNumber: partnerRoll },
              {
                partnerRollNumber: '',
                partnerName: '',
                partnerStatus: 'looking',
                pairStatus: 'incomplete',
                pairId: null,
              },
              { session }
            );
          }
        }

        await Player.updateMany(
          { rollNumber: { $in: regRollNumbers } },
          { $pull: { tournamentHistory: req.params.id } },
          { session }
        );
        await Player.deleteMany({ rollNumber: { $in: regRollNumbers }, tournamentHistory: { $size: 0 } }, { session });

        const pairIds = registrations.map((reg) => reg.pairId).filter(Boolean).map((id) => id.toString());
        await Pair.deleteMany({ tournament: req.params.id }, { session });
        if (pairIds.length > 0) {
          await Pair.deleteMany({ _id: { $in: pairIds } }, { session });
        }

        await PartnerRequest.deleteMany({ tournament: req.params.id }, { session });
        await Match.deleteMany({ tournament: req.params.id }, { session });
        await Registration.deleteMany({ tournament: req.params.id }, { session });
        await Tournament.findOneAndDelete({ _id: req.params.id, createdBy: req.admin._id }, { session });
        await logAdminAction({
          adminId: req.admin._id,
          action: 'DELETE_TOURNAMENT',
          targetId: tournament._id,
          targetModel: 'Tournament',
          details: { category: tournament.category, year: tournament.year },
          req,
          session,
        });
      });
    } finally {
      await session.endSession();
    }
    res.json({ message: 'Tournament deleted successfully. All registrations have been cancelled.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── GET MATCHES - admin ──────────────────────────────────
router.get('/:id/matches', protect, async (req, res) => {
  try {
    const { Tournament, Registration } = getModelsForSport(req.admin.sport);
    const tournament = await Tournament.findOne({
      _id: req.params.id,
      createdBy: req.admin._id
    });
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });

    const matches = await Match.find({ tournament: req.params.id })
      .sort({ round: 1, matchNumber: 1 });
    const populated = await Promise.all(matches.map(async (m) => {
      const obj = m.toObject();
      if (m.player1) obj.player1 = await Registration.findById(m.player1);
      if (m.player2) obj.player2 = await Registration.findById(m.player2);
      if (m.winner) obj.winner = await Registration.findById(m.winner);
      return obj;
    }));
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── GENERATE DRAWS ───────────────────────────────────────
/*
router.post('/:id/generate-draws', protect, async (req, res) => {
  try {
    const { Tournament, Registration } = getModelsForSport(req.admin.sport);
    const tournament = await Tournament.findOne({ _id: req.params.id, createdBy: req.admin._id });
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
    if (tournament.isLocked) return res.status(400).json({ message: 'Draws already generated' });

    const confirmedRegs = await Registration.find({ tournament: req.params.id, status: 'confirmed' });
    if (confirmedRegs.length < 2) return res.status(400).json({ message: 'At least 2 confirmed players required' });
    
    const n = confirmedRegs.length;
    let bracketSize = nextPowerOf2(n);
    const rounds = Math.log2(bracketSize);

    let orderedPlayers;
    if (SINGLES.includes(tournament.category)) {
      const { championId, runnerUpId } = req.body;
      orderedPlayers = buildSeededOrder(confirmedRegs, championId, runnerUpId, bracketSize);
    } else {
      orderedPlayers = shuffle(confirmedRegs);
    }

    await Match.deleteMany({ tournament: req.params.id });
    tournament.isLocked = true;
    await tournament.save();

    const matchesByRound = [];
    for (let round = 1; round <= rounds; round++) {
      const matchCount = bracketSize / Math.pow(2, round);
      const roundMatches = [];
      for (let m = 0; m < matchCount; m++) {
        const match = new Match({
          tournament: tournament._id,
          round,
          matchNumber: m + 1,
        });
        roundMatches.push(match);
      }
      matchesByRound.push(roundMatches);
    }

    for (let round = 0; round < matchesByRound.length - 1; round++) {
      const currentRoundMatches = matchesByRound[round];
      const nextRoundMatches = matchesByRound[round + 1];
      currentRoundMatches.forEach((match, idx) => {
        const nextMatch = nextRoundMatches[Math.floor(idx / 2)];
        match.nextMatchId = nextMatch._id;
        match.positionInNextMatch = (idx % 2) === 0 ? 1 : 2;
      });
    }

    await Promise.all(matchesByRound.flat().map(match => match.save()));

    const round1Matches = matchesByRound[0];
    for (let i = 0; i < bracketSize / 2; i++) {
      const p1 = orderedPlayers[i * 2];
      const p2 = orderedPlayers[i * 2 + 1];
      const match = round1Matches[i];
      match.player1 = p1 ? p1._id : null;
      match.player2 = p2 ? p2._id : null;

      if (p1 && !p2) {
        match.winner = p1._id;
        match.isCompleted = true;
        match.score1 = 1;
        match.score2 = 0;
        await match.save();
        await advanceWinner(match);
      } else if (!p1 && p2) {
        match.winner = p2._id;
        match.isCompleted = true;
        match.score1 = 0;
        match.score2 = 1;
        await match.save();
        await advanceWinner(match);
      } else {
        await match.save();
      }
    }

    // Log Audit action
    await logAdminAction({
      adminId: req.admin._id,
      action: 'GENERATE_DRAW',
      targetId: tournament._id,
      targetModel: 'Tournament',
      details: { 
        category: tournament.category, 
        year: tournament.year, 
        confirmedPlayersCount: confirmedRegs.length, 
        bracketSize,
        championId: req.body.championId || null,
        runnerUpId: req.body.runnerUpId || null
      },
      req
    });

    res.json({ message: 'Draws generated successfully', rounds: matchesByRound.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});*/
// ─── GENERATE DRAWS ───────────────────────────────────────
// ─── GENERATE DRAWS ───────────────────────────────────────
router.post('/:id/generate-draws', protect, async (req, res) => {
  try {
    const { Tournament, Registration } = getModelsForSport(req.admin.sport);
    const tournament = await Tournament.findOne({ _id: req.params.id, createdBy: req.admin._id });
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
    if (tournament.isLocked) return res.status(400).json({ message: 'Draws already generated' });

    const confirmedRegs = await Registration.find({ tournament: req.params.id, status: 'confirmed' });
    if (confirmedRegs.length < 2) return res.status(400).json({ message: 'At least 2 confirmed players required' });

    const n = confirmedRegs.length;
    let bracketSize, rounds, orderedPlayers;

    if (!SINGLES.includes(tournament.category)) {
      // ── DOUBLES / MIXED: only use approved pairs ──
      const approvedRegs = confirmedRegs.filter(r => r.pairStatus === 'approved');

      if (approvedRegs.length < 2) {
        return res.status(400).json({
          message: 'At least 2 players in approved pairs required. Make sure pairs are approved before generating draw.'
        });
      }

      const { pairs, unresolved } = buildDoublesPairEntries(approvedRegs);

      if (pairs.length < 2) {
        const message = unresolved.length > 0
          ? 'Some approved registrations are missing a complete partner link. Please link or approve pairs before generating the draw.'
          : 'Only 1 complete approved pair was found. Need at least 2 pairs to generate draw.';

        return res.status(400).json({ message });
      }

      bracketSize    = nextPowerOf2(pairs.length);
      rounds         = Math.log2(bracketSize);
      orderedPlayers = buildDoublesByeOrder(pairs, bracketSize);

    } else {
      // ── SINGLES: seeded/random logic unchanged ──
      bracketSize    = nextPowerOf2(n);
      rounds         = Math.log2(bracketSize);
      const { championId, runnerUpId } = req.body;
      orderedPlayers = buildSeededOrder(confirmedRegs, championId, runnerUpId, bracketSize);
    }

    await Match.deleteMany({ tournament: req.params.id });
    tournament.isLocked = true;
    await tournament.save();

    const matchesByRound = [];
    for (let round = 1; round <= rounds; round++) {
      const matchCount = bracketSize / Math.pow(2, round);
      const roundMatches = [];
      for (let m = 0; m < matchCount; m++) {
        const match = new Match({
          tournament: tournament._id,
          round,
          matchNumber: m + 1,
        });
        roundMatches.push(match);
      }
      matchesByRound.push(roundMatches);
    }

    for (let round = 0; round < matchesByRound.length - 1; round++) {
      const currentRoundMatches = matchesByRound[round];
      const nextRoundMatches    = matchesByRound[round + 1];
      currentRoundMatches.forEach((match, idx) => {
        const nextMatch = nextRoundMatches[Math.floor(idx / 2)];
        match.nextMatchId         = nextMatch._id;
        match.positionInNextMatch = (idx % 2) === 0 ? 1 : 2;
      });
    }

    await Promise.all(matchesByRound.flat().map(match => match.save()));

    const round1Matches = matchesByRound[0];
    for (let i = 0; i < bracketSize / 2; i++) {
      const p1    = orderedPlayers[i * 2];
      const p2    = orderedPlayers[i * 2 + 1];
      const match = round1Matches[i];
      match.player1 = p1 ? p1._id : null;
      match.player2 = p2 ? p2._id : null;

      if (p1 && !p2) {
        match.winner      = p1._id;
        match.isCompleted = true;
        match.score1      = 1;
        match.score2      = 0;
        await match.save();
        await advanceWinner(match);
      } else if (!p1 && p2) {
        match.winner      = p2._id;
        match.isCompleted = true;
        match.score1      = 0;
        match.score2      = 1;
        await match.save();
        await advanceWinner(match);
      } else {
        await match.save();
      }
    }

    res.json({ message: 'Draws generated successfully', rounds: matchesByRound.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// ─── PUBLISH DRAW ─────────────────────────────────────────
router.post('/:id/publish-draw', protect, async (req, res) => {
  try {
    const { Tournament } = getModelsForSport(req.admin.sport);
    const tournament = await Tournament.findOne({
      _id: req.params.id,
      createdBy: req.admin._id
    });
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
    if (!tournament.isLocked) return res.status(400).json({ message: 'Generate draw first before publishing' });
    if (tournament.isPublished) return res.status(400).json({ message: 'Draw already published' });
    tournament.isPublished = true;
    await tournament.save();
    // Log Audit action
    await logAdminAction({
      adminId: req.admin._id,
      action: 'PUBLISH_DRAW',
      targetId: tournament._id,
      targetModel: 'Tournament',
      details: { category: tournament.category, year: tournament.year },
      req
    });

    // Notify all confirmed participants that the official draw and bracket are published
    const { Registration } = getModelsForSport(req.admin.sport);
    const confirmedPlayers = await Registration.find({
      tournament: tournament._id,
      status: 'confirmed',
    }).select('email playerName');

    for (const player of confirmedPlayers) {
      if (player.email) {
        sendDrawPublishedEmail({
          email: player.email,
          playerName: player.playerName,
          sport: req.admin.sport,
          category: tournament.category,
          tournamentDate: tournament.date,
          venue: tournament.venue,
        }).catch((err) => {
          console.error(`[Notification] Draw publish email error for ${player.email}:`, err.message);
        });
      }
    }

    res.json({ message: 'Draw published! Students can now see the bracket.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
/*
// ─── UPDATE MATCH SCORE ───────────────────────────────────
router.put('/matches/:matchId/score', protect, async (req, res) => {
  try {
    const { score1, score2 } = req.body;
    if (score1 === score2) return res.status(400).json({ message: 'Scores cannot be equal - there must be a winner' });
    const match = await Match.findById(req.params.matchId);
    if (!match) return res.status(404).json({ message: 'Match not found' });
    if (match.isCompleted) return res.status(400).json({ message: 'Match already completed' });
    match.score1 = score1;
    match.score2 = score2;
    match.isCompleted = true;
    match.winner = score1 > score2 ? match.player1 : match.player2;
    await match.save();
    if (match.nextMatchId) {
      await advanceWinner(match);
    } else {
      const { Tournament } = getModelsForSport(req.admin.sport);
      await Tournament.findByIdAndUpdate(match.tournament, { winner: match.winner });
    }
    res.json({ message: 'Score updated', match });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});*/
// ─── UPDATE MATCH RESULT (W/L only - no score numbers) ────
router.put('/matches/:matchId/score', protect, async (req, res) => {
  try {
    const { winnerId } = req.body;
    if (!winnerId) return res.status(400).json({ message: 'winnerId is required' });

    const match = await Match.findById(req.params.matchId);
    if (!match) return res.status(404).json({ message: 'Match not found' });

    const { Tournament } = getModelsForSport(req.admin.sport);
    const tournament = await Tournament.findOne({
      _id: match.tournament,
      createdBy: req.admin._id
    });
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });

    if (match.isCompleted) return res.status(400).json({ message: 'Match already completed' });

    const winnerStr = String(winnerId);
    const p1Str = match.player1 ? String(match.player1) : null;
    const p2Str = match.player2 ? String(match.player2) : null;

    if (winnerStr !== p1Str && winnerStr !== p2Str) {
      return res.status(400).json({ message: 'winnerId must be one of the two players in this match' });
    }

    if (req.body.score1 !== undefined) match.score1 = Number(req.body.score1) || 0;
    if (req.body.score2 !== undefined) match.score2 = Number(req.body.score2) || 0;
    if (req.body.player1Stats) {
      match.player1Stats = req.body.player1Stats;
      match.statsEnteredByAdmin = true;
    }
    if (req.body.player2Stats) {
      match.player2Stats = req.body.player2Stats;
      match.statsEnteredByAdmin = true;
    }

    match.winner = winnerId;
    match.isCompleted = true;
    await match.save();

    if (match.nextMatchId) {
      await advanceWinner(match);
    } else {
      const { Tournament } = getModelsForSport(req.admin.sport);
      await Tournament.findByIdAndUpdate(match.tournament, { winner: match.winner });
    }

    // Log Audit action
    await logAdminAction({
      adminId: req.admin._id,
      action: 'UPDATE_MATCH_SCORE',
      targetId: match._id,
      targetModel: 'Match',
      details: { 
        tournamentId: match.tournament,
        round: match.round, 
        matchNumber: match.matchNumber, 
        winnerId,
        player1: match.player1,
        player2: match.player2
      },
      req
    });

    res.json({ message: 'Result updated', match });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── CLEAR ALL AUDIT LOGS ────────────────────────────────
router.delete('/audit-logs/clear-all', protect, async (req, res) => {
  try {
    const result = await AuditLog.deleteMany({ admin: req.admin._id, sport: req.admin.sport });
    res.json({ 
      message: `Cleared ${result.deletedCount} audit logs for ${req.admin.sport}`,
      deletedCount: result.deletedCount 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
module.exports.buildDoublesPairEntries = buildDoublesPairEntries;
