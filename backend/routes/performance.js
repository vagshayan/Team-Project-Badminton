const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Match = require('../models/Match');
const Admin = require('../models/Admin');
const StandaloneTournament = require('../models/Tournament');
const { getModelsForSport } = require('../models/SportModels');
const { protect } = require('../middleware/auth');
const { logAdminAction } = require('../utils/auditLogger');
const {
  getPlayerPerformance,
  searchPlayersPerformance,
} = require('../utils/performanceCalculator');
const { generatePerformancePDF } = require('../utils/pdfReportGenerator');

const ALL_SPORTS = ['badminton', 'table-tennis', 'carrom'];
const norm = (val) => (val ? String(val).trim().toUpperCase() : '');

/**
 * GET /api/performance/search
 * Search for player performance across sports (supports both Admin and Student search)
 */
router.get('/search', async (req, res) => {
  try {
    const {
      q,
      query,
      sport = 'all',
      tournamentId,
      matchStatus = 'all',
      category = 'all',
      period = 'all',
      page = 1,
      limit = 10,
    } = req.query;

    const effectiveQuery = (q || query || '').trim();

    // Check if an admin token is present
    let adminSport = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const adminDoc = await Admin.findById(decoded.id).select('sport role');
        if (adminDoc && adminDoc.role !== 'super_admin' && adminDoc.sport) {
          adminSport = adminDoc.sport;
        }
      } catch (tokenErr) {
        // Continue as unauthenticated public query
      }
    }

    let selectedSport = sport;
    if (adminSport && adminSport !== 'all' && (!sport || sport === 'all')) {
      selectedSport = adminSport;
    }

    const result = await searchPlayersPerformance({
      query: effectiveQuery,
      sport: selectedSport,
      tournamentId,
      matchStatus,
      category,
      period,
      page: Number(page) || 1,
      limit: Number(limit) || 10,
    });

    res.json(result);
  } catch (err) {
    console.error('Performance search error:', err);
    res.status(500).json({ message: err.message || 'Failed to search player performance' });
  }
});

/**
 * GET /api/performance/tournaments
 * Fetch all available tournaments for filter dropdowns
 */
router.get('/tournaments', async (req, res) => {
  try {
    const { sport } = req.query;
    const sports = sport && ALL_SPORTS.includes(sport.toLowerCase())
      ? [sport.toLowerCase()]
      : ALL_SPORTS;

    const tournaments = [];
    for (const s of sports) {
      const { Tournament } = getModelsForSport(s);
      const list = await Tournament.find({ isActive: true })
        .select('_id sport year category venue date isLocked isPublished')
        .sort({ date: -1 })
        .lean();
      list.forEach((t) => {
        tournaments.push({
          _id: t._id,
          sport: t.sport || s,
          year: t.year,
          category: t.category,
          name: `${(t.sport || s).toUpperCase()} ${t.year} (${t.category})`,
          date: t.date,
          venue: t.venue,
        });
      });
    }

    res.json(tournaments);
  } catch (err) {
    console.error('Error fetching tournaments for filters:', err);
    res.status(500).json({ message: 'Failed to fetch tournaments' });
  }
});

/**
 * POST /api/performance/player/verify
 * Public endpoint for players to verify access to their private performance dashboard
 */
router.post('/player/verify', async (req, res) => {
  try {
    const { rollNumber, verification } = req.body;
    if (!rollNumber || !verification) {
      return res.status(400).json({ message: 'Registration number and verification credential (NIC or Email) are required' });
    }

    const cleanRoll = norm(rollNumber);
    const cleanVer = verification.trim().toLowerCase();

    // Search across sports for a matching registration or player
    let matchedPlayer = null;

    for (const s of ALL_SPORTS) {
      const { Registration, Player } = getModelsForSport(s);

      // Check Registration as main player
      const regMain = await Registration.findOne({
        rollNumber: cleanRoll,
        $or: [
          { nicNo: { $regex: new RegExp(`^${cleanVer}$`, 'i') } },
          { email: { $regex: new RegExp(`^${cleanVer}$`, 'i') } },
        ],
      }).lean();

      if (regMain) {
        matchedPlayer = {
          name: regMain.playerName,
          rollNumber: regMain.rollNumber,
          department: regMain.department,
          email: regMain.email,
          phone: regMain.phone,
          sport: s,
        };
        break;
      }

      // Check Registration as partner
      const regPartner = await Registration.findOne({
        partnerRollNumber: cleanRoll,
      }).lean();

      if (regPartner) {
        // Also check if Player table has the partner's NIC or email
        const pDoc = await Player.findOne({
          rollNumber: cleanRoll,
          $or: [
            { nicNo: { $regex: new RegExp(`^${cleanVer}$`, 'i') } },
            { email: { $regex: new RegExp(`^${cleanVer}$`, 'i') } },
          ],
        }).lean();

        if (pDoc) {
          matchedPlayer = {
            name: pDoc.name,
            rollNumber: pDoc.rollNumber,
            department: pDoc.department,
            email: pDoc.email,
            phone: pDoc.phone,
            sport: s,
          };
          break;
        }
      }

      // Check in Player collection directly
      const pDoc = await Player.findOne({
        rollNumber: cleanRoll,
        $or: [
          { nicNo: { $regex: new RegExp(`^${cleanVer}$`, 'i') } },
          { email: { $regex: new RegExp(`^${cleanVer}$`, 'i') } },
        ],
      }).lean();

      if (pDoc) {
        matchedPlayer = {
          name: pDoc.name,
          rollNumber: pDoc.rollNumber,
          department: pDoc.department,
          email: pDoc.email,
          phone: pDoc.phone,
          sport: s,
        };
        break;
      }
    }

    if (!matchedPlayer) {
      return res.status(401).json({
        message: 'Verification failed. The registration number does not match the provided NIC or Email.',
      });
    }

    res.json({
      verified: true,
      player: matchedPlayer,
    });
  } catch (err) {
    console.error('Player verification error:', err);
    res.status(500).json({ message: 'Internal server error during verification' });
  }
});

/**
 * GET /api/performance/player/:rollNumber
 * Fetch comprehensive performance analysis for a player
 */
router.get('/player/:rollNumber', async (req, res) => {
  try {
    const { rollNumber } = req.params;
    const { sport, tournamentId, limit, startDate, endDate } = req.query;

    const data = await getPlayerPerformance({
      rollNumber,
      sport,
      tournamentId,
      limit,
      startDate,
      endDate,
    });

    if (!data) {
      return res.status(404).json({ message: 'Player not found in tournament records' });
    }

    res.json(data);
  } catch (err) {
    console.error('Error fetching player performance:', err);
    res.status(500).json({ message: err.message || 'Failed to fetch player performance' });
  }
});

/**
 * GET /api/performance/player/:rollNumber/pdf
 * Generates and downloads the official performance report PDF
 */
router.get('/player/:rollNumber/pdf', async (req, res) => {
  try {
    const { rollNumber } = req.params;
    const { sport, tournamentId } = req.query;

    const data = await getPlayerPerformance({
      rollNumber,
      sport,
      tournamentId,
    });

    if (!data) {
      return res.status(404).json({ message: 'Player not found' });
    }

    const safeRoll = (data.player?.rollNumber || rollNumber).replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Performance_Report_${safeRoll}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    generatePerformancePDF(data, res);
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ message: 'Failed to generate performance PDF report' });
  }
});

/**
 * PUT /api/performance/match/:matchId/stats
 * Admin endpoint to enter/update missing match statistics (points, sets/games/boards, fouls, coins)
 */
router.put('/match/:matchId/stats', protect, async (req, res) => {
  try {
    const { matchId } = req.params;
    const {
      score1,
      score2,
      winnerId,
      player1Stats = {},
      player2Stats = {},
      notes = '',
      matchDate,
    } = req.body;

    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }

    // Verify admin access to this tournament's sport
    let tournament = null;
    let matchSport = null;
    for (const s of ALL_SPORTS) {
      const { Tournament } = getModelsForSport(s);
      const t = await Tournament.findById(match.tournament);
      if (t) {
        tournament = t;
        matchSport = s;
        break;
      }
    }

    if (!tournament) {
      tournament = await StandaloneTournament.findById(match.tournament);
    }

    // Role check: non-super admins can only edit their own sport
    if (req.admin.role !== 'super_admin' && req.admin.sport !== matchSport && req.admin.sport !== tournament?.sport) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to manage this sport' });
    }

    if (score1 !== undefined) match.score1 = Number(score1) || 0;
    if (score2 !== undefined) match.score2 = Number(score2) || 0;

    if (winnerId) {
      const wStr = String(winnerId);
      const p1Str = match.player1 ? String(match.player1) : null;
      const p2Str = match.player2 ? String(match.player2) : null;
      if (wStr !== p1Str && wStr !== p2Str) {
        return res.status(400).json({ message: 'winnerId must be one of the two players in the match' });
      }
      match.winner = winnerId;
      match.isCompleted = true;
    }

    // Update detailed player performance stats
    match.player1Stats = {
      pointsScored: Number(player1Stats.pointsScored) || 0,
      pointsConceded: Number(player1Stats.pointsConceded) || 0,
      setsWon: Number(player1Stats.setsWon) || 0,
      setsLost: Number(player1Stats.setsLost) || 0,
      gamesWon: Number(player1Stats.gamesWon) || 0,
      gamesLost: Number(player1Stats.gamesLost) || 0,
      boardsWon: Number(player1Stats.boardsWon) || 0,
      boardsLost: Number(player1Stats.boardsLost) || 0,
      coinsPocketed: Number(player1Stats.coinsPocketed) || 0,
      fouls: Number(player1Stats.fouls) || 0,
    };

    match.player2Stats = {
      pointsScored: Number(player2Stats.pointsScored) || 0,
      pointsConceded: Number(player2Stats.pointsConceded) || 0,
      setsWon: Number(player2Stats.setsWon) || 0,
      setsLost: Number(player2Stats.setsLost) || 0,
      gamesWon: Number(player2Stats.gamesWon) || 0,
      gamesLost: Number(player2Stats.gamesLost) || 0,
      boardsWon: Number(player2Stats.boardsWon) || 0,
      boardsLost: Number(player2Stats.boardsLost) || 0,
      coinsPocketed: Number(player2Stats.coinsPocketed) || 0,
      fouls: Number(player2Stats.fouls) || 0,
    };

    match.statsEnteredByAdmin = true;
    if (notes !== undefined) match.notes = String(notes);
    if (matchDate) match.matchDate = new Date(matchDate);

    await match.save();

    // Log admin audit action
    await logAdminAction({
      adminId: req.admin._id,
      action: 'UPDATE_MATCH_PERFORMANCE_STATS',
      targetId: match._id,
      targetModel: 'Match',
      details: {
        tournamentId: match.tournament,
        round: match.round,
        matchNumber: match.matchNumber,
        winner: match.winner,
        player1Stats: match.player1Stats,
        player2Stats: match.player2Stats,
      },
      req,
    });

    res.json({
      message: 'Match performance statistics updated successfully',
      match,
    });
  } catch (err) {
    console.error('Error updating match stats:', err);
    res.status(500).json({ message: err.message || 'Failed to update match statistics' });
  }
});

module.exports = router;

