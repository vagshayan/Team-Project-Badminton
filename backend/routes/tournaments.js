const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');
const { getModelsForSport } = require('../models/SportModels');
const Match = require('../models/Match');
const { protect } = require('../middleware/auth');

const SINGLES = ['singles-men', 'singles-women'];

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

function buildSeededOrder(players, championId, runnerUpId, bracketSize) {
  const seeded1 = players.find(p => p._id.toString() === String(championId));
  let seeded2 = players.find(p => p._id.toString() === String(runnerUpId));

  if (seeded1 && seeded2 && seeded1._id.toString() === seeded2._id.toString()) {
    seeded2 = null;
  }

  const rest = players.filter(p => {
    if (seeded1 && p._id.toString() === seeded1._id.toString()) return false;
    if (seeded2 && p._id.toString() === seeded2._id.toString()) return false;
    return true;
  });

  const shuffledRest = shuffle(rest);
  const n = players.length;
  const byeCount = bracketSize - n;
  const fightingCount = n - byeCount;

  const result = new Array(bracketSize).fill(null);

  let restIdx = 0;
  for (let i = 0; i < fightingCount; i++) {
    result[i] = shuffledRest[restIdx++];
  }

  const byePlayers = shuffledRest.slice(restIdx);
  const totalPairs = bracketSize / 2;
  const fightingPairs = fightingCount / 2;
  const byePairs = totalPairs - fightingPairs;
  const byeSlotPlayers = new Array(byePairs).fill(null);

  if (seeded1) byeSlotPlayers[0] = seeded1;
  if (seeded2) byeSlotPlayers[byePairs - 1] = seeded2;

  let byeIdx = 0;
  for (let i = 0; i < byeSlotPlayers.length; i++) {
    if (byeSlotPlayers[i] === null && byeIdx < byePlayers.length) {
      byeSlotPlayers[i] = byePlayers[byeIdx++];
    }
  }

  for (let i = 0; i < byePairs; i++) {
    const slotIndex = fightingCount + (i * 2);
    result[slotIndex] = byeSlotPlayers[i];
    result[slotIndex + 1] = null;
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
    const sportTournaments = await Tournament.find({ sport: req.admin.sport });
    const tournamentIds = sportTournaments.map(t => t._id);
    const totalPlayers = await Registration.countDocuments({ tournament: { $in: tournamentIds }, status: 'confirmed' });
    const pendingApprovals = await Registration.countDocuments({ tournament: { $in: tournamentIds }, status: 'pending' });
    const activeCategories = [...new Set(sportTournaments.map(t => t.category))].length;
    res.json({ totalPlayers, pendingApprovals, activeCategories });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── PUBLIC — students view tournaments for REGISTRATION ──
router.get('/public/:sport', async (req, res) => {
  try {
    const { Tournament } = getModelsForSport(req.params.sport);
    const tournaments = await Tournament.find({
      sport: req.params.sport,
      isActive: true,
      // No isPublished filter — ALL active tournaments visible for registration
    })
      .populate('createdBy', 'name')
      .sort({ date: 1 });
    res.json(tournaments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── PUBLIC — students view matches (no login needed) ────
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

// ─── ADMIN — own sport tournaments ───────────────────────
router.get('/admin', protect, async (req, res) => {
  try {
    const { Tournament } = getModelsForSport(req.admin.sport);
    const tournaments = await Tournament.find({ sport: req.admin.sport })
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
    res.json(tournaments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── CREATE ───────────────────────────────────────────────
router.post('/', protect, async (req, res) => {
  const { year, date, time, venue, category } = req.body;
  const currentYear = new Date().getFullYear();
  if (year < currentYear) return res.status(400).json({ message: 'Year cannot be in the past' });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (new Date(date) < today) return res.status(400).json({ message: 'Date cannot be in the past' });
  try {
    const { Tournament } = getModelsForSport(req.admin.sport);
    const existing = await Tournament.findOne({ sport: req.admin.sport, year, category });
    if (existing) return res.status(400).json({ message: `A ${category} tournament already exists for ${year}.` });
    const tournament = await Tournament.create({
      sport: req.admin.sport, year, date, time, venue, category, createdBy: req.admin._id,
    });
    res.status(201).json(tournament);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ─── UPDATE — password required ──────────────────────────
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
    const { Tournament } = getModelsForSport(req.admin.sport);
    const existing = await Tournament.findOne({ _id: { $ne: req.params.id }, sport: req.admin.sport, year, category });
    if (existing) return res.status(400).json({ message: `A ${category} tournament already exists for ${year}.` });
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

// ─── RESET DRAW (blocked if published) ───────────────────
router.delete('/:id/reset-draw', protect, async (req, res) => {
  try {
    const { Tournament } = getModelsForSport(req.admin.sport);
    const tournament = await Tournament.findOne({
      _id: req.params.id,
      sport: req.admin.sport
    });
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
    if (tournament.isPublished) return res.status(400).json({ message: 'Cannot reset a published draw. Draw is already public!' });
    tournament.isLocked = false;
    tournament.winner = null;
    await tournament.save();
    await Match.deleteMany({ tournament: req.params.id });
    res.json({ message: 'Draw reset successfully. You can now regenerate.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── DELETE TOURNAMENT — password required ────────────────
router.delete('/:id', protect, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ message: 'Password is required to delete' });
  try {
    const admin = await Admin.findById(req.admin._id);
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Incorrect password' });
    const { Tournament, Registration } = getModelsForSport(req.admin.sport);
    const tournament = await Tournament.findOne({ _id: req.params.id, sport: req.admin.sport });
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
    await Registration.updateMany({ tournament: req.params.id }, { status: 'cancelled' });
    await Match.deleteMany({ tournament: req.params.id });
    await Tournament.findOneAndDelete({ _id: req.params.id, sport: req.admin.sport });
    res.json({ message: 'Tournament deleted successfully. All registrations have been cancelled.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── GET MATCHES — admin ──────────────────────────────────
router.get('/:id/matches', protect, async (req, res) => {
  try {
    const { Registration } = getModelsForSport(req.admin.sport);
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
router.post('/:id/generate-draws', protect, async (req, res) => {
  try {
    const { Tournament, Registration } = getModelsForSport(req.admin.sport);
    const tournament = await Tournament.findOne({ _id: req.params.id, sport: req.admin.sport });
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
    if (tournament.isLocked) return res.status(400).json({ message: 'Draws already generated' });

    const confirmedRegs = await Registration.find({ tournament: req.params.id, status: 'confirmed' });
    if (confirmedRegs.length < 2) return res.status(400).json({ message: 'At least 2 confirmed players required' });

    const n = confirmedRegs.length;
    const bracketSize = nextPowerOf2(n);
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
      sport: req.admin.sport
    });
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
    if (!tournament.isLocked) return res.status(400).json({ message: 'Generate draw first before publishing' });
    if (tournament.isPublished) return res.status(400).json({ message: 'Draw already published' });
    tournament.isPublished = true;
    await tournament.save();
    res.json({ message: 'Draw published! Students can now see the bracket.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── UPDATE MATCH SCORE ───────────────────────────────────
router.put('/matches/:matchId/score', protect, async (req, res) => {
  try {
    const { score1, score2 } = req.body;
    if (score1 === score2) return res.status(400).json({ message: 'Scores cannot be equal — there must be a winner' });
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
});

module.exports = router;