const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');
const { getModelsForSport } = require('../models/SportModels');
const Match = require('../models/Match');
const { protect } = require('../middleware/auth');

// Stats for Admin Dashboard
router.get('/stats', protect, async (req, res) => {
  try {
    const { Tournament, Registration } = getModelsForSport(req.admin.sport);
    const sportTournaments = await Tournament.find({ sport: req.admin.sport });
    const tournamentIds = sportTournaments.map(t => t._id);

    const totalPlayers = await Registration.countDocuments({
      tournament: { $in: tournamentIds },
      status: 'confirmed'
    });

    const pendingApprovals = await Registration.countDocuments({
      tournament: { $in: tournamentIds },
      status: 'pending'
    });

    const activeCategories = [...new Set(sportTournaments.map(t => t.category))].length;

    res.json({ totalPlayers, pendingApprovals, activeCategories });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Public — students view
router.get('/public/:sport', async (req, res) => {
  try {
    const { Tournament } = getModelsForSport(req.params.sport);
    const tournaments = await Tournament.find({ sport: req.params.sport, isActive: true })
      .populate('createdBy', 'name')
      .sort({ date: 1 });
    res.json(tournaments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin — own sport only
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

// Create
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

// Update — password required
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

// Delete — password required
router.delete('/:id', protect, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ message: 'Password is required to delete' });
  try {
    const admin = await Admin.findById(req.admin._id);
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Incorrect password' });

    const { Tournament, Registration } = getModelsForSport(req.admin.sport);

    // Check if tournament exists and get it before deletion
    const tournament = await Tournament.findOne({ _id: req.params.id, sport: req.admin.sport });
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });

    // Update all registrations for this tournament to 'cancelled' status
    await Registration.updateMany(
      { tournament: req.params.id },
      { status: 'cancelled' }
    );

    // Delete the tournament
    await Tournament.findOneAndDelete({ _id: req.params.id, sport: req.admin.sport });

    res.json({
      message: 'Tournament deleted successfully. All registrations have been cancelled.',
      cancelledRegistrations: true
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get Matches for a Tournament
router.get('/:id/matches', protect, async (req, res) => {
  try {
    const matches = await Match.find({ tournament: req.params.id })
      .populate('player1 player2 winner')
      .sort({ round: 1, matchNumber: 1 });
    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Generate Draws (Brackets)
router.post('/:id/generate-draws', protect, async (req, res) => {
  try {
    const { Tournament, Registration } = getModelsForSport(req.admin.sport);
    const tournament = await Tournament.findOne({ _id: req.params.id, sport: req.admin.sport });
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
    if (tournament.isLocked) return res.status(400).json({ message: 'Draws already generated' });

    const confirmedRegs = await Registration.find({ tournament: req.params.id, status: 'confirmed' });
    if (confirmedRegs.length < 2) return res.status(400).json({ message: 'At least 2 confirmed players required' });

    // Shuffle players
    const players = confirmedRegs.sort(() => Math.random() - 0.5);
    const n = players.length;

    // Determine bracket size (next power of 2)
    let bracketSize = 1;
    let rounds = 0;
    while (bracketSize < n) {
      bracketSize *= 2;
      rounds++;
    }

    // Lock the tournament
    tournament.isLocked = true;
    await tournament.save();

    // 1. Create all matches for all rounds first to have IDs for nextMatchId
    // Total matches in single elimination = n-1 (if we don't count byes as matches)
    // But for a fixed bracket size, it's bracketSize - 1.
    const matchesByRound = [];
    let currentRoundMatches = bracketSize / 2;
    let lastRoundMatches = [];

    for (let r = rounds; r >= 1; r--) {
      const roundMatches = [];
      for (let m = 0; m < currentRoundMatches; m++) {
        const match = new Match({
          tournament: tournament._id,
          round: rounds - r + 1,
          matchNumber: m + 1,
        });

        // Set nextMatchId if not the final round (round 1 in our loop is actually the final round)
        if (lastRoundMatches.length > 0) {
          const nextMatchIdx = Math.floor(m / 2);
          match.nextMatchId = lastRoundMatches[nextMatchIdx]._id;
          match.positionInNextMatch = (m % 2) === 0 ? 1 : 2;
        }

        await match.save();
        roundMatches.push(match);
      }
      matchesByRound.unshift(roundMatches);
      lastRoundMatches = roundMatches;
      currentRoundMatches /= 2;
    }

    // 2. Assign players to Round 1
    const round1Matches = matchesByRound[0];
    for (let i = 0; i < bracketSize / 2; i++) {
        const p1 = players[i * 2];
        const p2 = players[i * 2 + 1];
        
        const match = round1Matches[i];
        match.player1 = p1 ? p1._id : null;
        match.player2 = p2 ? p2._id : null;

        // Auto-advance if it's a bye
        if (p1 && !p2) {
            match.winner = p1._id;
            match.isCompleted = true;
            match.score1 = 1; match.score2 = 0;
            await match.save();
            await advanceWinner(match);
        } else if (!p1 && p2) {
            match.winner = p2._id;
            match.isCompleted = true;
            match.score1 = 0; match.score2 = 1;
            await match.save();
            await advanceWinner(match);
        } else {
            await match.save();
        }
    }

    res.json({ message: 'Draws generated successfully', rounds: matchesByRound.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update Match Score
router.put('/matches/:matchId/score', protect, async (req, res) => {
  try {
    const { score1, score2 } = req.body;
    const match = await Match.findById(req.params.matchId);
    if (!match) return res.status(404).json({ message: 'Match not found' });
    if (match.isCompleted) return res.status(400).json({ message: 'Match already completed' });

    match.score1 = score1;
    match.score2 = score2;
    match.isCompleted = true;
    match.winner = score1 > score2 ? match.player1 : match.player2;
    await match.save();

    // Advance winner to next match if exists
    if (match.nextMatchId) {
      await advanceWinner(match);
    } else {
      // This was the final!
      const { Tournament } = getModelsForSport(req.admin.sport);
      await Tournament.findByIdAndUpdate(match.tournament, { winner: match.winner });
    }

    res.json({ message: 'Score updated', match });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

async function advanceWinner(match) {
    if (!match.nextMatchId) return;
    const nextMatch = await Match.findById(match.nextMatchId);
    if (match.positionInNextMatch === 1) {
        nextMatch.player1 = match.winner;
    } else {
        nextMatch.player2 = match.winner;
    }
    await nextMatch.save();

    // If both players present in next match and one is a bye (unlikely here but good for safety)
    // or if we want to handle cascading byes...
}

module.exports = router;