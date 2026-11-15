const mongoose = require('mongoose');
const Match = require('../models/Match');
const StandaloneTournament = require('../models/Tournament'); // Ensures 'Tournament' model is registered
const PlayerPerformance = require('../models/PlayerPerformance');
const { getModelsForSport } = require('../models/SportModels');
const { generateFeedback } = require('./feedbackGenerator');

const ALL_SPORTS = ['badminton', 'table-tennis', 'carrom'];

/**
 * Normalizes roll numbers for consistent comparisons
 */
const norm = (val) => (val ? String(val).trim().toUpperCase() : '');

/**
 * Finds tournament details by ID across all sport models
 */
async function findTournamentById(tournamentId) {
  if (!tournamentId) return null;
  const tId = String(tournamentId._id || tournamentId);
  if (!mongoose.isValidObjectId(tId)) return null;

  for (const s of ALL_SPORTS) {
    const { Tournament } = getModelsForSport(s);
    const t = await Tournament.findById(tId).lean();
    if (t) return { ...t, sport: t.sport || s };
  }
  const st = await StandaloneTournament.findById(tId).lean();
  if (st) return st;
  return null;
}

/**
 * Calculates complete performance analytics for a single player
 */
async function getPlayerPerformance({
  rollNumber,
  sport = null,
  tournamentId = null,
  limit = null,
  startDate = null,
  endDate = null,
}) {
  const cleanRoll = norm(rollNumber);
  if (!cleanRoll) {
    throw new Error('Valid player roll number is required');
  }

  const sportsToQuery = sport && ALL_SPORTS.includes(sport.toLowerCase())
    ? [sport.toLowerCase()]
    : ALL_SPORTS;

  // 1. Gather player profile and all registrations across queried sports
  let playerProfile = null;
  const registrationsBySport = {};
  const allRegistrations = [];

  for (const s of sportsToQuery) {
    const { Tournament, Registration, Player } = getModelsForSport(s);

    // Look in Player model
    if (!playerProfile) {
      const p = await Player.findOne({ rollNumber: cleanRoll }).lean();
      if (p) {
        playerProfile = {
          name: p.name,
          rollNumber: p.rollNumber,
          nicNo: p.nicNo,
          email: p.email,
          phone: p.phone,
          department: p.department,
          sport: s,
        };
      }
    }

    // Look in Registration model (both singles and doubles)
    const regs = await Registration.find({
      $or: [
        { rollNumber: cleanRoll },
        { partnerRollNumber: cleanRoll },
      ],
    })
      .populate('tournament')
      .lean();

    registrationsBySport[s] = regs;
    regs.forEach((r) => {
      allRegistrations.push({ ...r, sportCategory: s });
      if (!playerProfile) {
        const isPartner = norm(r.partnerRollNumber) === cleanRoll;
        playerProfile = {
          name: isPartner ? (r.partnerName || r.playerName) : r.playerName,
          rollNumber: cleanRoll,
          nicNo: r.nicNo || 'N/A',
          email: r.email || 'N/A',
          phone: r.phone || 'N/A',
          department: r.department || 'N/A',
          sport: s,
        };
      }
    });
  }

  if (!playerProfile) {
    return null;
  }

  // 2. Collect all Registration IDs linked to this player
  const regIdToInfo = new Map();
  allRegistrations.forEach((r) => {
    regIdToInfo.set(String(r._id), r);
  });
  const regIds = Array.from(regIdToInfo.keys()).map((id) => new mongoose.Types.ObjectId(id));

  if (regIds.length === 0) {
    const emptySummary = buildSummaryObject([], playerProfile.sport);
    const feedback = generateFeedback(emptySummary, playerProfile.sport, []);
    return {
      player: playerProfile,
      summary: emptySummary,
      sportBreakdown: {},
      matchHistory: [],
      monthlyStats: [],
      progressComparison: { hasComparison: false },
      feedback,
    };
  }

  // 3. Find all completed matches involving this player (excluding single-player Byes)
  const matchQuery = {
    isCompleted: true,
    player1: { $ne: null },
    player2: { $ne: null },
    $or: [{ player1: { $in: regIds } }, { player2: { $in: regIds } }],
  };

  if (tournamentId && mongoose.isValidObjectId(tournamentId)) {
    matchQuery.tournament = new mongoose.Types.ObjectId(tournamentId);
  }

  let matches = await Match.find(matchQuery)
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();

  // Populate tournament and player1/player2 registration details
  for (const m of matches) {
    if (m.tournament) {
      m.tournament = await findTournamentById(m.tournament);
    }
    if (m.player1 && !m.player1.playerName) {
      const p1Id = String(m.player1._id || m.player1);
      m.player1 = regIdToInfo.get(p1Id) || (await fetchRegistrationAnySport(p1Id));
    }
    if (m.player2 && !m.player2.playerName) {
      const p2Id = String(m.player2._id || m.player2);
      m.player2 = regIdToInfo.get(p2Id) || (await fetchRegistrationAnySport(p2Id));
    }
    if (m.winner && !m.winner.playerName) {
      const wId = String(m.winner._id || m.winner);
      m.winner = regIdToInfo.get(wId) || (await fetchRegistrationAnySport(wId));
    }
  }

  // Date range filtering if requested
  if (startDate || endDate) {
    const start = startDate ? new Date(startDate).getTime() : 0;
    const end = endDate ? new Date(endDate).getTime() : Infinity;
    matches = matches.filter((m) => {
      const d = new Date(m.matchDate || m.updatedAt || m.createdAt).getTime();
      return d >= start && d <= end;
    });
  }

  // Apply match count limit (e.g. Last 5, Last 10) if requested
  const matchesToProcess = limit && Number(limit) > 0
    ? matches.slice(0, Number(limit))
    : matches;

  // 4. Transform matches into detailed match history & compute aggregates
  const matchHistory = [];
  const monthlyMap = new Map();
  const tournamentsMap = new Map();

  let matchesWon = 0;
  let matchesLost = 0;
  let pointsScored = 0;
  let pointsConceded = 0;
  let setsWon = 0;
  let setsLost = 0;
  let gamesWon = 0;
  let gamesLost = 0;
  let boardsWon = 0;
  let boardsLost = 0;
  let coinsPocketed = 0;
  let fouls = 0;

  // Sort chronological for streak calculation
  const chronological = [...matchesToProcess].sort(
    (a, b) => new Date(a.matchDate || a.updatedAt || a.createdAt) - new Date(b.matchDate || b.updatedAt || b.createdAt)
  );

  let currentStreak = 0;
  let maxStreak = 0;
  let tempStreak = 0;

  chronological.forEach((m) => {
    const p1Id = String(m.player1?._id || m.player1 || '');
    const p2Id = String(m.player2?._id || m.player2 || '');
    const isP1 = regIdToInfo.has(p1Id);
    const isP2 = regIdToInfo.has(p2Id);

    const winnerId = String(m.winner?._id || m.winner || '');
    const isWinner = regIdToInfo.has(winnerId);

    if (isWinner) {
      tempStreak += 1;
      if (tempStreak > maxStreak) maxStreak = tempStreak;
    } else {
      tempStreak = 0;
    }
  });

  // Calculate current active streak from most recent matches backwards
  for (let i = 0; i < matchesToProcess.length; i++) {
    const winnerId = String(matchesToProcess[i].winner?._id || matchesToProcess[i].winner || '');
    if (regIdToInfo.has(winnerId)) {
      currentStreak += 1;
    } else {
      break;
    }
  }

  // Process each match record
  matchesToProcess.forEach((m) => {
    const p1Id = String(m.player1?._id || m.player1 || '');
    const isP1 = regIdToInfo.has(p1Id);
    const playerReg = isP1 ? m.player1 : m.player2;
    const opponentReg = isP1 ? m.player2 : m.player1;

    const winnerId = String(m.winner?._id || m.winner || '');
    const isWinner = regIdToInfo.has(winnerId);

    if (isWinner) {
      matchesWon += 1;
    } else {
      matchesLost += 1;
    }

    const tObj = m.tournament || {};
    const tSport = (tObj.sport || playerProfile.sport || 'badminton').toLowerCase();

    // Determine points / metrics for this match
    let mPtsScored = 0;
    let mPtsConceded = 0;
    let mSetsWon = 0;
    let mSetsLost = 0;
    let mGamesWon = 0;
    let mGamesLost = 0;
    let mBoardsWon = 0;
    let mBoardsLost = 0;
    let mCoins = 0;
    let mFouls = 0;

    const myStats = isP1 ? m.player1Stats : m.player2Stats;
    const oppStats = isP1 ? m.player2Stats : m.player1Stats;

    if (m.statsEnteredByAdmin && myStats) {
      mPtsScored = Number(myStats.pointsScored) || 0;
      mPtsConceded = Number(myStats.pointsConceded) || (oppStats ? Number(oppStats.pointsScored) || 0 : 0);
      mSetsWon = Number(myStats.setsWon) || (isWinner ? 1 : 0);
      mSetsLost = Number(myStats.setsLost) || (isWinner ? 0 : 1);
      mGamesWon = Number(myStats.gamesWon) || (isWinner ? 1 : 0);
      mGamesLost = Number(myStats.gamesLost) || (isWinner ? 0 : 1);
      mBoardsWon = Number(myStats.boardsWon) || (isWinner ? 1 : 0);
      mBoardsLost = Number(myStats.boardsLost) || (isWinner ? 0 : 1);
      mCoins = Number(myStats.coinsPocketed) || 0;
      mFouls = Number(myStats.fouls) || 0;
    } else {
      // Standard match result
      const p1Score = Number(m.score1) || 0;
      const p2Score = Number(m.score2) || 0;
      mPtsScored = isP1 ? p1Score : p2Score;
      mPtsConceded = isP1 ? p2Score : p1Score;

      if (tSport === 'badminton') {
        mSetsWon = isWinner ? 1 : 0;
        mSetsLost = isWinner ? 0 : 1;
      } else if (tSport === 'table-tennis') {
        mGamesWon = isWinner ? 1 : 0;
        mGamesLost = isWinner ? 0 : 1;
      } else if (tSport === 'carrom') {
        mBoardsWon = isWinner ? 1 : 0;
        mBoardsLost = isWinner ? 0 : 1;
      }
    }

    pointsScored += mPtsScored;
    pointsConceded += mPtsConceded;
    setsWon += mSetsWon;
    setsLost += mSetsLost;
    gamesWon += mGamesWon;
    gamesLost += mGamesLost;
    boardsWon += mBoardsWon;
    boardsLost += mBoardsLost;
    coinsPocketed += mCoins;
    fouls += mFouls;

    const matchDate = m.matchDate || m.updatedAt || m.createdAt || new Date();
    const dateObj = new Date(matchDate);
    const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;

    // Monthly aggregates
    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, { month: monthKey, matches: 0, wins: 0, losses: 0, pointsScored: 0, pointsConceded: 0 });
    }
    const mEntry = monthlyMap.get(monthKey);
    mEntry.matches += 1;
    if (isWinner) mEntry.wins += 1;
    else mEntry.losses += 1;
    mEntry.pointsScored += mPtsScored;
    mEntry.pointsConceded += mPtsConceded;

    // Tournament history grouping
    const tournId = String(tObj._id || 'unknown');
    if (!tournamentsMap.has(tournId)) {
      tournamentsMap.set(tournId, {
        tournamentId: tournId,
        tournamentName: `${tObj.sport ? tObj.sport.toUpperCase() : 'TOURNAMENT'} ${tObj.year || ''} (${tObj.category || 'Standard'})`,
        year: tObj.year,
        category: tObj.category,
        sport: tSport,
        date: tObj.date,
        matches: 0,
        wins: 0,
        losses: 0,
        pointsScored: 0,
        pointsConceded: 0,
      });
    }
    const tEntry = tournamentsMap.get(tournId);
    tEntry.matches += 1;
    if (isWinner) tEntry.wins += 1;
    else tEntry.losses += 1;
    tEntry.pointsScored += mPtsScored;
    tEntry.pointsConceded += mPtsConceded;

    // Opponent name formatting (singles or doubles)
    let oppName = opponentReg ? opponentReg.playerName : 'Opponent';
    if (opponentReg && opponentReg.partnerName) {
      oppName = `${opponentReg.playerName} & ${opponentReg.partnerName}`;
    }

    matchHistory.push({
      matchId: m._id,
      round: m.round,
      matchNumber: m.matchNumber,
      tournamentId: tObj._id,
      tournamentName: `${tObj.sport ? tObj.sport.toUpperCase() : ''} ${tObj.year || ''} (${tObj.category || ''})`,
      category: tObj.category || 'Standard',
      sport: tSport,
      opponentName: oppName,
      opponentRollNumber: opponentReg?.rollNumber || 'N/A',
      opponentDepartment: opponentReg?.department || 'N/A',
      outcome: isWinner ? 'WIN' : 'LOSS',
      isWinner,
      pointsScored: mPtsScored,
      pointsConceded: mPtsConceded,
      setsWon: mSetsWon,
      setsLost: mSetsLost,
      gamesWon: mGamesWon,
      gamesLost: mGamesLost,
      boardsWon: mBoardsWon,
      boardsLost: mBoardsLost,
      coinsPocketed: mCoins,
      fouls: mFouls,
      statsEnteredByAdmin: Boolean(m.statsEnteredByAdmin),
      date: matchDate,
    });
  });

  const totalMatches = matchesWon + matchesLost;
  const winPercentage = totalMatches > 0 ? Math.round((matchesWon / totalMatches) * 1000) / 10 : 0;
  const avgPointsPerMatch = totalMatches > 0 ? Math.round((pointsScored / totalMatches) * 10) / 10 : 0;

  // Recent results array (e.g. ['W', 'W', 'L', 'W', 'W'])
  const recentResults = matchHistory.slice(0, 5).map((m) => (m.isWinner ? 'W' : 'L'));

  // Calculate Overall Performance Score (Transparent formula, max 100)
  // 55% Win Rate + 25% Recent Form (last 5) + 10% Current Streak + 10% Experience
  let recentFormPct = winPercentage;
  if (recentResults.length > 0) {
    const recentWins = recentResults.filter((r) => r === 'W').length;
    recentFormPct = Math.round((recentWins / recentResults.length) * 100);
  }
  const streakFactor = Math.min(100, currentStreak * 25);
  const experienceFactor = Math.min(100, totalMatches * 10);
  const overallScore = totalMatches > 0
    ? Math.round((winPercentage * 0.55 + recentFormPct * 0.25 + streakFactor * 0.10 + experienceFactor * 0.10) * 10) / 10
    : 0;

  // Calculate Rank standing in sport
  const rank = await calculatePlayerRank(cleanRoll, playerProfile.sport, winPercentage, matchesWon);

  const summary = {
    totalMatches,
    matchesWon,
    matchesLost,
    winPercentage,
    pointsScored,
    pointsConceded,
    setsWon,
    setsLost,
    gamesWon,
    gamesLost,
    boardsWon,
    boardsLost,
    coinsPocketed,
    fouls,
    averagePointsPerMatch: avgPointsPerMatch,
    currentStreak,
    maxStreak,
    recentResults,
    overallScore,
    rank,
  };

  // Monthly stats formatted and sorted
  const monthlyStats = Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month));

  // Progress Comparison: compare latest tournament vs previous tournament
  const tournList = Array.from(tournamentsMap.values()).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  let progressComparison = { hasComparison: false };
  if (tournList.length >= 2) {
    const curr = tournList[0];
    const prev = tournList[1];
    const currWinPct = curr.matches > 0 ? Math.round((curr.wins / curr.matches) * 100) : 0;
    const prevWinPct = prev.matches > 0 ? Math.round((prev.wins / prev.matches) * 100) : 0;
    progressComparison = {
      hasComparison: true,
      currentTournament: {
        id: curr.tournamentId,
        name: curr.tournamentName,
        matches: curr.matches,
        wins: curr.wins,
        losses: curr.losses,
        winPercentage: currWinPct,
        pointsScored: curr.pointsScored,
        pointsConceded: curr.pointsConceded,
      },
      previousTournament: {
        id: prev.tournamentId,
        name: prev.tournamentName,
        matches: prev.matches,
        wins: prev.wins,
        losses: prev.losses,
        winPercentage: prevWinPct,
        pointsScored: prev.pointsScored,
        pointsConceded: prev.pointsConceded,
      },
      winPercentageDiff: currWinPct - prevWinPct,
      winsDiff: curr.wins - prev.wins,
    };
  }

  // Generate Intelligent Feedback
  const feedback = generateFeedback(summary, playerProfile.sport, matchHistory);

  // Safely update or cache snapshot in PlayerPerformance model
  try {
    await PlayerPerformance.findOneAndUpdate(
      { rollNumber: cleanRoll, sport: playerProfile.sport },
      {
        playerName: playerProfile.name,
        totalMatches,
        matchesWon,
        matchesLost,
        winPercentage,
        pointsScored,
        pointsConceded,
        setsWon,
        setsLost,
        gamesWon,
        gamesLost,
        boardsWon,
        boardsLost,
        coinsPocketed,
        fouls,
        averagePointsPerMatch: avgPointsPerMatch,
        currentStreak,
        maxStreak,
        recentResults,
        overallScore,
        lastCalculatedAt: new Date(),
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    // Non-blocking snapshot cache error
    console.error('Performance snapshot cache error:', err.message);
  }

  return {
    player: playerProfile,
    summary,
    matchHistory,
    monthlyStats,
    tournamentHistory: tournList,
    progressComparison,
    feedback,
  };
}

/**
 * Helper to build empty summary object
 */
function buildSummaryObject(matches, sport) {
  return {
    totalMatches: 0,
    matchesWon: 0,
    matchesLost: 0,
    winPercentage: 0,
    pointsScored: 0,
    pointsConceded: 0,
    setsWon: 0,
    setsLost: 0,
    gamesWon: 0,
    gamesLost: 0,
    boardsWon: 0,
    boardsLost: 0,
    coinsPocketed: 0,
    fouls: 0,
    averagePointsPerMatch: 0,
    currentStreak: 0,
    maxStreak: 0,
    recentResults: [],
    overallScore: 0,
    rank: 1,
  };
}

/**
 * Calculates a player's rank relative to all competitors in the sport
 */
async function calculatePlayerRank(rollNumber, sport, winPercentage, matchesWon) {
  try {
    const { Player, Registration } = getModelsForSport(sport);
    const regs = await Registration.find({ status: 'confirmed' }).select('rollNumber partnerRollNumber').lean();
    const uniqueRolls = new Set();
    regs.forEach((r) => {
      if (r.rollNumber) uniqueRolls.add(norm(r.rollNumber));
      if (r.partnerRollNumber) uniqueRolls.add(norm(r.partnerRollNumber));
    });

    // Approximate ranking based on completed wins in snapshot table
    const higherRanked = await PlayerPerformance.countDocuments({
      sport,
      $or: [
        { winPercentage: { $gt: winPercentage } },
        { winPercentage, matchesWon: { $gt: matchesWon } },
      ],
    });

    return higherRanked + 1;
  } catch (err) {
    return 1;
  }
}

/**
 * Helper to look up a registration in any sport
 */
async function fetchRegistrationAnySport(regId) {
  for (const s of ALL_SPORTS) {
    const { Registration } = getModelsForSport(s);
    const reg = await Registration.findById(regId).populate('tournament').lean();
    if (reg) return { ...reg, sportCategory: s };
  }
  return null;
}

/**
 * Searches and paginates players for the Admin Performance Search section
 */
async function searchPlayersPerformance({
  query = '',
  sport = 'all',
  tournamentId = null,
  matchStatus = 'all',
  category = 'all',
  period = 'all',
  page = 1,
  limit = 10,
}) {
  const sportsToSearch = sport && sport !== 'all' && ALL_SPORTS.includes(sport.toLowerCase())
    ? [sport.toLowerCase()]
    : ALL_SPORTS;

  const playerMap = new Map();

  for (const s of sportsToSearch) {
    const { Registration, Tournament, Player } = getModelsForSport(s);

    // Build filter for registration
    const regFilter = {};
    if (tournamentId && mongoose.isValidObjectId(tournamentId)) {
      regFilter.tournament = tournamentId;
    }

    if (query && query.trim()) {
      const q = query.trim();
      const regex = new RegExp(q, 'i');
      regFilter.$or = [
        { playerName: regex },
        { partnerName: regex },
        { rollNumber: regex },
        { partnerRollNumber: regex },
        { nicNo: regex },
        { email: regex },
        { phone: regex },
      ];
    }

    const regs = await Registration.find(regFilter).populate('tournament').lean();

    regs.forEach((r) => {
      const t = r.tournament;
      if (category !== 'all' && t && t.category !== category) return;

      const roll = norm(r.rollNumber);
      if (roll && !playerMap.has(roll)) {
        playerMap.set(roll, {
          name: r.playerName,
          rollNumber: roll,
          nicNo: r.nicNo || 'N/A',
          email: r.email || 'N/A',
          phone: r.phone || 'N/A',
          department: r.department || 'N/A',
          sport: s,
          category: t?.category || 'Standard',
          tournamentName: t ? `${t.sport.toUpperCase()} ${t.year} (${t.category})` : 'N/A',
          tournamentId: t?._id,
        });
      }

      // Also include partner if registered
      const pRoll = norm(r.partnerRollNumber);
      if (pRoll && !playerMap.has(pRoll)) {
        playerMap.set(pRoll, {
          name: r.partnerName || 'Partner',
          rollNumber: pRoll,
          nicNo: 'N/A',
          email: 'N/A',
          phone: 'N/A',
          department: r.department || 'N/A',
          sport: s,
          category: t?.category || 'Standard',
          tournamentName: t ? `${t.sport.toUpperCase()} ${t.year} (${t.category})` : 'N/A',
          tournamentId: t?._id,
        });
      }
    });

    // Also include from Player model if search query matches
    if (query && query.trim()) {
      const q = query.trim();
      const regex = new RegExp(q, 'i');
      const playerDocs = await Player.find({
        $or: [
          { name: regex },
          { rollNumber: regex },
          { nicNo: regex },
          { email: regex },
          { phone: regex },
        ],
      }).lean();

      playerDocs.forEach((p) => {
        const roll = norm(p.rollNumber);
        if (roll && !playerMap.has(roll)) {
          playerMap.set(roll, {
            name: p.name,
            rollNumber: roll,
            nicNo: p.nicNo,
            email: p.email,
            phone: p.phone,
            department: p.department,
            sport: s,
            category: 'Standard',
            tournamentName: 'University Player Roster',
            tournamentId: null,
          });
        }
      });
    }
  }

  const allPlayers = Array.from(playerMap.values());

  // Attach quick performance metrics for each player in the search results
  const enrichedPlayers = await Promise.all(
    allPlayers.map(async (p) => {
      // Check cached snapshot or calculate quickly
      const cached = await PlayerPerformance.findOne({ rollNumber: p.rollNumber, sport: p.sport }).lean();
      if (cached) {
        return {
          ...p,
          totalMatches: cached.totalMatches,
          wins: cached.matchesWon,
          losses: cached.matchesLost,
          winPercentage: cached.winPercentage,
          overallScore: cached.overallScore,
          latestResult: cached.recentResults && cached.recentResults.length > 0 ? cached.recentResults[0] : 'N/A',
        };
      }

      // Compute on-the-fly if not in cache
      try {
        const perf = await getPlayerPerformance({ rollNumber: p.rollNumber, sport: p.sport });
        const summary = perf?.summary || {};
        return {
          ...p,
          totalMatches: summary.totalMatches || 0,
          wins: summary.matchesWon || 0,
          losses: summary.matchesLost || 0,
          winPercentage: summary.winPercentage || 0,
          overallScore: summary.overallScore || 0,
          latestResult: summary.recentResults && summary.recentResults.length > 0 ? summary.recentResults[0] : 'N/A',
        };
      } catch (e) {
        return {
          ...p,
          totalMatches: 0,
          wins: 0,
          losses: 0,
          winPercentage: 0,
          overallScore: 0,
          latestResult: 'N/A',
        };
      }
    })
  );

  // Filter by matchStatus
  let filtered = enrichedPlayers;
  if (matchStatus === 'played') {
    filtered = filtered.filter((p) => p.totalMatches > 0);
  } else if (matchStatus === 'winners') {
    filtered = filtered.filter((p) => p.wins > 0);
  } else if (matchStatus === 'unplayed') {
    filtered = filtered.filter((p) => p.totalMatches === 0);
  }

  // Sort by matches played and win rate descending
  filtered.sort((a, b) => b.totalMatches - a.totalMatches || b.winPercentage - a.winPercentage || a.name.localeCompare(b.name));

  const total = filtered.length;
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Math.min(100, Number(limit) || 10));
  const startIndex = (pageNum - 1) * limitNum;
  const paginated = filtered.slice(startIndex, startIndex + limitNum);

  return {
    players: paginated,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum) || 1,
  };
}

module.exports = {
  getPlayerPerformance,
  searchPlayersPerformance,
};
