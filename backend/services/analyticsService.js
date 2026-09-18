/**
 * analyticsService.js
 * -------------------
 * Core analytics engine for Player Performance Analytics and Personalized Suggestions.
 * Supports Badminton, Table Tennis, and Carrom.
 *
 * Design principles:
 *  - Calculates all statistics dynamically from actual completed match records.
 *  - Reusable across all sports using sport-specific models or generic models.
 *  - Generates rule-based smart suggestions.
 *  - Computes 100-point performance score with transparent breakdown.
 *  - Produces structured, chart-ready datasets for responsive frontend rendering.
 */

'use strict';

const mongoose = require('mongoose');
const Match = require('../models/Match');
const UniversityTeamMember = require('../models/UniversityTeamMember');
const { getModelsForSport } = require('../models/SportModels');

// Fallback legacy models if needed
let LegacyTournament;
let LegacyRegistration;
try {
  LegacyTournament = require('../models/Tournament');
  LegacyRegistration = require('../models/Registration');
} catch (e) {
  // Ignored if not present
}

const SUPPORTED_SPORTS = ['badminton', 'table-tennis', 'carrom'];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalizes a sport string to standard slug.
 */
function normalizeSport(sport) {
  if (!sport) return 'badminton';
  const clean = String(sport).toLowerCase().trim().replace(/_/g, '-');
  return SUPPORTED_SPORTS.includes(clean) ? clean : 'badminton';
}

/**
 * Normalizes a registration / roll number for flexible lookup.
 */
function normalizeRollNumber(roll) {
  if (!roll) return '';
  return String(roll).trim();
}

/**
 * Checks if a string matches a roll number (case-insensitive and trimmed).
 */
function isRollNumberMatch(target, search) {
  if (!target || !search) return false;
  return target.trim().toLowerCase() === search.trim().toLowerCase();
}

// ── Core Calculations ─────────────────────────────────────────────────────────

/**
 * Calculates the 100-point Performance Score based on the 4 pillars:
 * 1. Win Rate (Max 40 pts): (winPercentage / 100) * 40
 * 2. Recent Form (Max 30 pts): Win rate of last 5 matches * 30
 * 3. Match Participation (Max 15 pts): min(15, (totalMatches / 10) * 15)
 * 4. Winning Streak (Max 15 pts): min(15, currentWinStreak * 5)
 */
function calculatePerformanceScore(stats, recentMatches) {
  const { totalMatches, winPercentage, currentWinningStreak } = stats;

  if (totalMatches === 0) {
    return {
      totalScore: 0,
      classification: 'Needs Improvement',
      breakdown: {
        winRatePoints: 0,
        recentFormPoints: 0,
        participationPoints: 0,
        streakPoints: 0,
      },
    };
  }

  // 1. Win Rate Pillar (40 max)
  const winRatePoints = Math.round(((winPercentage || 0) / 100) * 40 * 10) / 10;

  // 2. Recent Form Pillar (30 max) - last 5 matches
  const last5 = (recentMatches || []).slice(0, 5);
  const recentWins = last5.filter((m) => m.result === 'W').length;
  const recentFormRate = last5.length > 0 ? (recentWins / last5.length) : (winPercentage / 100);
  const recentFormPoints = Math.round(recentFormRate * 30 * 10) / 10;

  // 3. Participation Pillar (15 max)
  const participationPoints = Math.min(15, Math.round((totalMatches / 10) * 15 * 10) / 10);

  // 4. Winning Streak Pillar (15 max)
  const streakPoints = Math.min(15, (currentWinningStreak || 0) * 5);

  const rawTotal = winRatePoints + recentFormPoints + participationPoints + streakPoints;
  const totalScore = Math.min(100, Math.max(0, Math.round(rawTotal)));

  // Classification
  let classification = 'Needs Improvement';
  if (totalScore >= 90) classification = 'Outstanding';
  else if (totalScore >= 75) classification = 'Excellent';
  else if (totalScore >= 60) classification = 'Good';
  else if (totalScore >= 40) classification = 'Developing';

  return {
    totalScore,
    classification,
    breakdown: {
      winRatePoints,
      recentFormPoints,
      participationPoints,
      streakPoints,
    },
  };
}

/**
 * Generates personalized rule-based suggestions based on player metrics.
 */
function generateSuggestions(stats, chronologicalMatches, lastMatchDate) {
  const suggestions = [];
  const { totalMatches, winPercentage, currentLosingStreak } = stats;

  // Rule 6: New Player (< 3 matches)
  if (totalMatches < 3) {
    suggestions.push({
      id: 'new-player',
      type: 'info',
      title: 'New Player Insights',
      icon: '🌱',
      message: 'More match data is needed to provide a detailed performance analysis. Participate in more matches to receive personalized insights.',
      priority: 1,
    });
  }

  // Rule 1: Low Performance (Win rate < 40% with >= 3 matches)
  if (totalMatches >= 3 && winPercentage < 40) {
    suggestions.push({
      id: 'low-performance',
      type: 'warning',
      title: 'Strategy & Consistency',
      icon: '🎯',
      message: 'Your current win rate is below average. Try participating in more practice matches and focus on improving your strategy and consistency.',
      priority: 2,
    });
  }

  // Rule 4: High Performance (Win rate >= 75% with >= 3 matches)
  if (totalMatches >= 3 && winPercentage >= 75) {
    suggestions.push({
      id: 'high-performance',
      type: 'success',
      title: 'Peak Form & Consistency',
      icon: '👑',
      message: 'Excellent performance! You are performing at a high level. Keep maintaining your consistency and continue challenging strong opponents.',
      priority: 2,
    });
  }

  // Rule 3: Losing Streak (>= 3 consecutive losses)
  if (currentLosingStreak >= 3) {
    suggestions.push({
      id: 'losing-streak',
      type: 'danger',
      title: 'Losing Streak Alert',
      icon: '⚠️',
      message: 'You are currently on a losing streak. Review your recent matches, identify weaknesses, and focus on improving before your next match.',
      priority: 1,
    });
  }

  // Rule 2: Improving Performance (recent matches win rate > earlier matches win rate)
  if (chronologicalMatches && chronologicalMatches.length >= 4) {
    const splitPoint = Math.floor(chronologicalMatches.length / 2);
    const earlier = chronologicalMatches.slice(0, splitPoint);
    const recent = chronologicalMatches.slice(splitPoint);

    const earlierWins = earlier.filter((m) => m.result === 'W').length;
    const earlierRate = earlier.length > 0 ? (earlierWins / earlier.length) : 0;

    const recentWins = recent.filter((m) => m.result === 'W').length;
    const recentRate = recent.length > 0 ? (recentWins / recent.length) : 0;

    if (recentRate > earlierRate && recentWins >= 2) {
      suggestions.push({
        id: 'improving-performance',
        type: 'success',
        title: 'Positive Trajectory',
        icon: '📈',
        message: 'Great progress! Your recent performance is improving. Keep practicing and maintain your current momentum.',
        priority: 3,
      });
    }
  }

  // Rule 5: Inactive Player (>= 30 days since last match)
  if (lastMatchDate) {
    const daysSinceLastMatch = Math.floor((Date.now() - new Date(lastMatchDate).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceLastMatch >= 30) {
      suggestions.push({
        id: 'inactive-player',
        type: 'warning',
        title: 'Activity Reminder',
        icon: '⏳',
        message: `You have not played recently (${daysSinceLastMatch} days ago). Participate in upcoming matches to maintain your performance and ranking.`,
        priority: 4,
      });
    }
  }

  // Default fallback if no suggestions triggered
  if (suggestions.length === 0 && totalMatches >= 3) {
    suggestions.push({
      id: 'steady-performance',
      type: 'info',
      title: 'Steady Performance',
      icon: '⚡',
      message: 'You have a steady competitive record. Focus on match endurance, placement precision, and tactical adaptability to boost your win rate.',
      priority: 5,
    });
  }

  return suggestions.sort((a, b) => a.priority - b.priority);
}

/**
 * Builds chart-ready payloads for frontend visualization.
 */
function buildChartData(stats, chronologicalMatches, benchmarks) {
  const { wins, losses, winPercentage } = stats;

  // 1. Win vs Loss Bar Chart
  const winLossBar = [
    { label: 'Wins', value: wins, color: '#10B981', percentage: stats.totalMatches ? Math.round((wins / stats.totalMatches) * 100) : 0 },
    { label: 'Losses', value: losses, color: '#EF4444', percentage: stats.totalMatches ? Math.round((losses / stats.totalMatches) * 100) : 0 },
  ];

  // 2. Win / Loss Percentage Donut
  const winPercentageDonut = [
    { label: 'Win', percentage: winPercentage, count: wins, color: '#10B981' },
    { label: 'Loss', percentage: Math.round((100 - winPercentage) * 10) / 10, count: losses, color: '#EF4444' },
  ];

  // 3. Recent Performance Trend (Line chart)
  let cumulativeWins = 0;
  const recentTrend = (chronologicalMatches || []).slice(-10).map((m, idx) => {
    if (m.result === 'W') cumulativeWins++;
    const rollingWinRate = Math.round((cumulativeWins / (idx + 1)) * 100);
    return {
      matchIndex: idx + 1,
      matchName: `M${idx + 1}`,
      date: m.date ? new Date(m.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : `Match ${idx + 1}`,
      result: m.result,
      scoreText: m.scoreText,
      opponent: m.opponentName,
      rollingWinRate,
      isWin: m.result === 'W' ? 1 : 0,
    };
  });

  // 4. Comparison with Sport Average & Top Performer
  const comparison = {
    metrics: [
      {
        name: 'Win Rate (%)',
        player: winPercentage,
        sportAverage: benchmarks?.averageWinRate ?? 50,
        topPerformer: benchmarks?.topWinRate ?? 100,
      },
      {
        name: 'Matches Played',
        player: stats.totalMatches,
        sportAverage: benchmarks?.averageMatches ?? 0,
        topPerformer: benchmarks?.topMatches ?? 0,
      },
      {
        name: 'Performance Score',
        player: stats.performanceScore?.totalScore || 0,
        sportAverage: benchmarks?.averageScore ?? 50,
        topPerformer: benchmarks?.topScore ?? 100,
      },
    ],
    topPlayer: benchmarks?.topPlayer || null,
  };

  return {
    winLossBar,
    winPercentageDonut,
    recentTrend,
    comparison,
  };
}

// ── Service Methods ───────────────────────────────────────────────────────────

/**
 * Lists players registered in a sport (or all sports) matching an optional search term.
 */
async function listPlayersForSport(sport, search = '', limit = 30) {
  const sportsToQuery = sport && sport !== 'all' ? [normalizeSport(sport)] : SUPPORTED_SPORTS;
  const searchRegex = search ? new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;

  const playerMap = new Map();

  for (const s of sportsToQuery) {
    try {
      const { Registration } = getModelsForSport(s);
      const query = { status: { $ne: 'rejected' } };
      if (searchRegex) {
        query.$or = [
          { playerName: searchRegex },
          { rollNumber: searchRegex },
          { partnerName: searchRegex },
          { partnerRollNumber: searchRegex },
        ];
      }

      const regs = await Registration.find(query)
        .select('playerName rollNumber department partnerName partnerRollNumber')
        .limit(100)
        .lean();

      regs.forEach((r) => {
        if (r.rollNumber && (!searchRegex || searchRegex.test(r.rollNumber) || searchRegex.test(r.playerName))) {
          const key = `${r.rollNumber.trim().toUpperCase()}_${s}`;
          if (!playerMap.has(key)) {
            playerMap.set(key, {
              playerName: r.playerName,
              rollNumber: r.rollNumber.trim(),
              department: r.department || 'N/A',
              sport: s,
            });
          }
        }

        // Include partner if available
        if (r.partnerRollNumber && (!searchRegex || searchRegex.test(r.partnerRollNumber) || searchRegex.test(r.partnerName))) {
          const pKey = `${r.partnerRollNumber.trim().toUpperCase()}_${s}`;
          if (!playerMap.has(pKey)) {
            playerMap.set(pKey, {
              playerName: r.partnerName || 'Partner',
              rollNumber: r.partnerRollNumber.trim(),
              department: r.department || 'N/A',
              sport: s,
            });
          }
        }
      });
    } catch (err) {
      console.warn(`[AnalyticsService] Failed to query registrations for sport ${s}:`, err.message);
    }
  }

  // Also query UniversityTeamMembers
  try {
    const teamQuery = {};
    if (sportsToQuery.length === 1) teamQuery.sport = sportsToQuery[0];
    if (searchRegex) {
      teamQuery.$or = [
        { fullName: searchRegex },
        { registrationNumber: searchRegex },
      ];
    }
    const teamMembers = await UniversityTeamMember.find(teamQuery).limit(50).lean();
    teamMembers.forEach((tm) => {
      const key = `${tm.registrationNumber.trim().toUpperCase()}_${tm.sport || 'badminton'}`;
      if (!playerMap.has(key)) {
        playerMap.set(key, {
          playerName: tm.fullName,
          rollNumber: tm.registrationNumber.trim(),
          department: tm.faculty || 'University Team',
          sport: tm.sport || 'badminton',
          photo: tm.photo || '',
        });
      }
    });
  } catch (err) {
    console.warn('[AnalyticsService] Failed to query university team members:', err.message);
  }

  return Array.from(playerMap.values()).slice(0, limit);
}

/**
 * Computes sport-wide benchmarks (average win rate, top player, average matches).
 */
async function getSportBenchmarks(sport) {
  const cleanSport = normalizeSport(sport);
  const { Tournament, Registration } = getModelsForSport(cleanSport);

  try {
    // 1. Get all tournaments for this sport
    const tournaments = await Tournament.find({}).select('_id').lean();
    const tournamentIds = tournaments.map((t) => t._id);

    if (tournamentIds.length === 0) {
      return {
        averageWinRate: 50,
        averageMatches: 0,
        averageScore: 50,
        topWinRate: 100,
        topMatches: 0,
        topScore: 100,
        topPlayer: null,
      };
    }

    // 2. Find completed matches
    const matches = await Match.find({
      tournament: { $in: tournamentIds },
      isCompleted: true,
    })
      .populate('player1', 'playerName rollNumber')
      .populate('player2', 'playerName rollNumber')
      .populate('winner', 'playerName rollNumber')
      .lean();

    if (matches.length === 0) {
      return {
        averageWinRate: 50,
        averageMatches: 0,
        averageScore: 50,
        topWinRate: 100,
        topMatches: 0,
        topScore: 100,
        topPlayer: null,
      };
    }

    // Aggregate stats per player
    const playerStatsMap = new Map();

    matches.forEach((m) => {
      // Exclude byes
      if (!m.player1 || !m.player2) return;

      const p1Roll = m.player1.rollNumber;
      const p2Roll = m.player2.rollNumber;
      const winRoll = m.winner ? m.winner.rollNumber : null;

      if (p1Roll) {
        if (!playerStatsMap.has(p1Roll)) {
          playerStatsMap.set(p1Roll, { roll: p1Roll, name: m.player1.playerName, matches: 0, wins: 0 });
        }
        const p1 = playerStatsMap.get(p1Roll);
        p1.matches += 1;
        if (winRoll && winRoll === p1Roll) p1.wins += 1;
      }

      if (p2Roll) {
        if (!playerStatsMap.has(p2Roll)) {
          playerStatsMap.set(p2Roll, { roll: p2Roll, name: m.player2.playerName, matches: 0, wins: 0 });
        }
        const p2 = playerStatsMap.get(p2Roll);
        p2.matches += 1;
        if (winRoll && winRoll === p2Roll) p2.wins += 1;
      }
    });

    const playersList = Array.from(playerStatsMap.values()).map((p) => {
      const winRate = p.matches > 0 ? Math.round((p.wins / p.matches) * 100) : 0;
      const score = Math.round((winRate * 0.5) + (Math.min(10, p.matches) * 5));
      return { ...p, winRate, score };
    });

    if (playersList.length === 0) {
      return {
        averageWinRate: 50,
        averageMatches: 0,
        averageScore: 50,
        topWinRate: 100,
        topMatches: 0,
        topScore: 100,
        topPlayer: null,
      };
    }

    const totalWinRate = playersList.reduce((acc, p) => acc + p.winRate, 0);
    const totalMatchesCount = playersList.reduce((acc, p) => acc + p.matches, 0);
    const totalScoreCount = playersList.reduce((acc, p) => acc + p.score, 0);

    const averageWinRate = Math.round(totalWinRate / playersList.length);
    const averageMatches = Math.round((totalMatchesCount / playersList.length) * 10) / 10;
    const averageScore = Math.round(totalScoreCount / playersList.length);

    // Sort to find top player
    playersList.sort((a, b) => b.score - a.score || b.winRate - a.winRate || b.matches - a.matches);
    const top = playersList[0];

    return {
      averageWinRate,
      averageMatches,
      averageScore,
      topWinRate: top ? top.winRate : 100,
      topMatches: top ? top.matches : 0,
      topScore: top ? top.score : 100,
      topPlayer: top ? { name: top.name, rollNumber: top.roll, winRate: top.winRate, matches: top.matches, score: top.score } : null,
      rankedPlayersCount: playersList.length,
      allPlayersList: playersList,
    };
  } catch (err) {
    console.error(`[AnalyticsService] Benchmark calculation error for ${cleanSport}:`, err.message);
    return {
      averageWinRate: 50,
      averageMatches: 0,
      averageScore: 50,
      topWinRate: 100,
      topMatches: 0,
      topScore: 100,
      topPlayer: null,
    };
  }
}

/**
 * Calculates complete analytics and performance metrics for a player.
 *
 * @param {string} registrationNumber - Player roll/registration number
 * @param {string} [sport] - Sport name (badminton, table-tennis, carrom)
 * @returns {Promise<object|null>}
 */
async function calculatePlayerPerformance(registrationNumber, sport = 'badminton') {
  const cleanRoll = normalizeRollNumber(registrationNumber);
  if (!cleanRoll) {
    throw new Error('Registration number is required');
  }

  const cleanSport = normalizeSport(sport);
  const { Tournament, Registration } = getModelsForSport(cleanSport);

  // 1. Locate all registrations associated with this rollNumber (either main or partner)
  const rollRegex = new RegExp(`^${cleanRoll.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

  const registrations = await Registration.find({
    $or: [{ rollNumber: rollRegex }, { partnerRollNumber: rollRegex }],
  })
    .populate('tournament')
    .lean();

  // If not found in sport-specific table, also check legacy registrations or other sports
  let primaryInfo = null;

  if (registrations.length > 0) {
    const isMain = registrations.find((r) => isRollNumberMatch(r.rollNumber, cleanRoll));
    if (isMain) {
      primaryInfo = {
        name: isMain.playerName,
        rollNumber: isMain.rollNumber,
        department: isMain.department || 'N/A',
        year: isMain.year || 'N/A',
        email: isMain.email || '',
        phone: isMain.phone || '',
      };
    } else {
      const isPartner = registrations.find((r) => isRollNumberMatch(r.partnerRollNumber, cleanRoll));
      if (isPartner) {
        primaryInfo = {
          name: isPartner.partnerName || 'Player',
          rollNumber: isPartner.partnerRollNumber,
          department: isPartner.department || 'N/A',
          year: isPartner.year || 'N/A',
          email: '',
          phone: '',
        };
      }
    }
  }

  // Check UniversityTeamMember for extra metadata (photo, faculty)
  let teamMember = null;
  try {
    teamMember = await UniversityTeamMember.findOne({
      registrationNumber: rollRegex,
      sport: cleanSport,
    }).lean();

    if (!teamMember) {
      teamMember = await UniversityTeamMember.findOne({ registrationNumber: rollRegex }).lean();
    }
  } catch (e) {
    // Non-fatal
  }

  if (!primaryInfo && teamMember) {
    primaryInfo = {
      name: teamMember.fullName,
      rollNumber: teamMember.registrationNumber,
      department: teamMember.faculty || 'University Team',
      year: 'N/A',
      email: '',
      phone: '',
    };
  }

  // If still not found anywhere, return null (404)
  if (!primaryInfo) {
    return null;
  }

  const regIds = registrations.map((r) => r._id);

  // 2. Fetch all completed matches for these registrations
  let matches = [];
  if (regIds.length > 0) {
    matches = await Match.find({
      $or: [{ player1: { $in: regIds } }, { player2: { $in: regIds } }],
      isCompleted: true,
    })
      .populate('tournament')
      .populate('player1')
      .populate('player2')
      .populate('winner')
      .sort({ createdAt: 1 })
      .lean();
  }

  // 3. Process matches and filter out empty / bye matches
  let totalMatches = 0;
  let wins = 0;
  let losses = 0;
  const processedMatches = [];

  matches.forEach((m) => {
    // Must have both players for a valid completed match
    if (!m.player1 || !m.player2) return;

    const p1IsPlayer = regIds.some((id) => id.toString() === (m.player1._id ? m.player1._id.toString() : m.player1.toString()));
    const p2IsPlayer = regIds.some((id) => id.toString() === (m.player2._id ? m.player2._id.toString() : m.player2.toString()));

    if (!p1IsPlayer && !p2IsPlayer) return;

    totalMatches++;

    const isWinner = m.winner && regIds.some((id) => id.toString() === (m.winner._id ? m.winner._id.toString() : m.winner.toString()));

    if (isWinner) {
      wins++;
    } else {
      losses++;
    }

    const opponent = p1IsPlayer ? m.player2 : m.player1;
    const myScore = p1IsPlayer ? (m.score1 || 0) : (m.score2 || 0);
    const oppScore = p1IsPlayer ? (m.score2 || 0) : (m.score1 || 0);

    const matchDate = m.tournament?.date || m.updatedAt || m.createdAt;

    processedMatches.push({
      id: m._id,
      matchNumber: m.matchNumber,
      round: m.round,
      tournamentYear: m.tournament?.year || 'N/A',
      tournamentCategory: m.tournament?.category || 'Singles',
      tournamentVenue: m.tournament?.venue || 'Campus Arena',
      date: matchDate,
      result: isWinner ? 'W' : 'L',
      myScore,
      oppScore,
      scoreText: `${myScore} - ${oppScore}`,
      opponentName: opponent ? (opponent.playerName || 'Opponent') : 'Opponent',
      opponentRoll: opponent ? (opponent.rollNumber || 'N/A') : 'N/A',
      partnerName: p1IsPlayer ? (m.player1.partnerName || null) : (m.player2.partnerName || null),
    });
  });

  // Sort chronological
  processedMatches.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Calculate Streaks from the end of chronological matches backwards
  let currentWinningStreak = 0;
  let currentLosingStreak = 0;

  for (let i = processedMatches.length - 1; i >= 0; i--) {
    const res = processedMatches[i].result;
    if (res === 'W') {
      if (currentLosingStreak === 0) currentWinningStreak++;
      else break;
    } else if (res === 'L') {
      if (currentWinningStreak === 0) currentLosingStreak++;
      else break;
    }
  }

  const winPercentage = totalMatches > 0 ? Math.round((wins / totalMatches) * 100 * 10) / 10 : 0;
  const lastMatch = processedMatches.length > 0 ? processedMatches[processedMatches.length - 1] : null;
  const lastMatchDate = lastMatch ? lastMatch.date : null;

  // Compute benchmarks across the sport
  const benchmarks = await getSportBenchmarks(cleanSport);

  // Compute Player Ranking in the sport
  let playerRank = null;
  if (benchmarks.allPlayersList && benchmarks.allPlayersList.length > 0) {
    const rankIndex = benchmarks.allPlayersList.findIndex((p) => isRollNumberMatch(p.roll, cleanRoll));
    if (rankIndex !== -1) {
      playerRank = rankIndex + 1;
    }
  }

  // Compute Performance Score
  const rawStats = {
    totalMatches,
    wins,
    losses,
    winPercentage,
    currentWinningStreak,
    currentLosingStreak,
  };

  const performanceScore = calculatePerformanceScore(rawStats, processedMatches.slice().reverse());

  // Generate Personalized Smart Suggestions
  const suggestions = generateSuggestions(rawStats, processedMatches, lastMatchDate);

  // Build Chart Payloads
  const chartData = buildChartData(
    { ...rawStats, performanceScore },
    processedMatches,
    benchmarks
  );

  return {
    player: {
      name: primaryInfo.name,
      rollNumber: primaryInfo.rollNumber,
      department: primaryInfo.department,
      sport: cleanSport,
      photo: teamMember?.photo || '',
      position: teamMember?.position || 'Tournament Player',
      isUniversityTeam: Boolean(teamMember),
      rank: playerRank,
      totalRankedPlayers: benchmarks.rankedPlayersCount || 0,
    },
    statistics: {
      totalMatches,
      wins,
      losses,
      winPercentage,
      currentWinningStreak,
      currentLosingStreak,
      lastMatchDate,
      recentResults: processedMatches.slice(-5).reverse().map((m) => m.result),
    },
    performanceScore,
    suggestions,
    charts: chartData,
    recentMatches: processedMatches.slice().reverse(), // latest first for table
  };
}

module.exports = {
  calculatePlayerPerformance,
  listPlayersForSport,
  getSportBenchmarks,
  calculatePerformanceScore,
  generateSuggestions,
  buildChartData,
  normalizeSport,
  normalizeRollNumber,
};
