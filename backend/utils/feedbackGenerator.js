/**
 * Intelligent Player Feedback System
 * Generates data-driven feedback (Strengths, Weaknesses, Practical Suggestions)
 * based strictly on authoritative player performance statistics.
 */

function generateFeedback(summary, sport = 'badminton', matchHistory = []) {
  const strengths = [];
  const weaknesses = [];
  const suggestions = [];

  const {
    totalMatches = 0,
    matchesWon = 0,
    matchesLost = 0,
    winPercentage = 0,
    pointsScored = 0,
    pointsConceded = 0,
    setsWon = 0,
    setsLost = 0,
    gamesWon = 0,
    gamesLost = 0,
    boardsWon = 0,
    boardsLost = 0,
    coinsPocketed = 0,
    fouls = 0,
    currentStreak = 0,
    maxStreak = 0,
    recentResults = [],
    overallScore = 0,
  } = summary;

  if (totalMatches === 0) {
    return {
      strengths: [
        {
          type: 'OBSERVATION',
          title: 'Registered & Prepared',
          desc: 'Player is registered and verified for competitive tournament play.',
        },
      ],
      weaknesses: [
        {
          type: 'OBSERVATION',
          title: 'No Completed Matches Yet',
          desc: 'Statistical sample is not yet available because the player has not completed competitive bracket matches.',
        },
      ],
      suggestions: [
        {
          type: 'PRACTICAL_SUGGESTION',
          title: 'Tournament Preparation',
          desc: 'Participate in scheduled bracket matches to generate baseline statistical performance tracking and analysis.',
        },
      ],
    };
  }

  // ── 1. STRENGTHS (Statistically Driven) ───────────────────
  if (winPercentage >= 75) {
    strengths.push({
      type: 'STATISTICAL_STRENGTH',
      title: 'Dominant Win Percentage',
      desc: `Maintains an elite ${winPercentage}% win rate across ${totalMatches} completed matches (${matchesWon}W - ${matchesLost}L).`,
    });
  } else if (winPercentage >= 50) {
    strengths.push({
      type: 'STATISTICAL_STRENGTH',
      title: 'Positive Winning Record',
      desc: `Demonstrates reliable match execution with a positive ${winPercentage}% win conversion rate.`,
    });
  }

  if (currentStreak >= 3) {
    strengths.push({
      type: 'STATISTICAL_STRENGTH',
      title: 'Active Winning Momentum',
      desc: `Currently on an active ${currentStreak}-match winning streak in competitive tournament play.`,
    });
  } else if (maxStreak >= 4) {
    strengths.push({
      type: 'STATISTICAL_STRENGTH',
      title: 'Proven Peak Form',
      desc: `Demonstrated ability to sustain winning momentum with a career peak streak of ${maxStreak} consecutive wins.`,
    });
  }

  // Recent 5 match form
  const last5 = recentResults.slice(-5);
  const recentWins = last5.filter((r) => r === 'W').length;
  if (last5.length >= 3 && recentWins / last5.length >= 0.6) {
    strengths.push({
      type: 'STATISTICAL_STRENGTH',
      title: 'Strong Recent Match Form',
      desc: `Won ${recentWins} of the last ${last5.length} matches (${Math.round((recentWins / last5.length) * 100)}%), reflecting ascending competitive performance.`,
    });
  }

  // Scoring / Efficiency Strengths
  if (pointsScored > 0 && pointsScored > pointsConceded) {
    const diff = pointsScored - pointsConceded;
    strengths.push({
      type: 'STATISTICAL_STRENGTH',
      title: 'Positive Points Differential',
      desc: `Scored ${pointsScored} points while conceding ${pointsConceded} (+${diff} net positive differential).`,
    });
  }

  // Sport-specific strengths
  if (sport === 'badminton') {
    if (setsWon > setsLost && setsWon > 0) {
      strengths.push({
        type: 'STATISTICAL_STRENGTH',
        title: 'High Set Efficiency',
        desc: `Won ${setsWon} sets and conceded only ${setsLost} sets in competitive matches.`,
      });
    }
  } else if (sport === 'table-tennis') {
    if (gamesWon > gamesLost && gamesWon > 0) {
      strengths.push({
        type: 'STATISTICAL_STRENGTH',
        title: 'Strong Game Control',
        desc: `Secured ${gamesWon} games vs ${gamesLost} games lost across tournament rounds.`,
      });
    }
  } else if (sport === 'carrom') {
    if (boardsWon > boardsLost && boardsWon > 0) {
      strengths.push({
        type: 'STATISTICAL_STRENGTH',
        title: 'Board Dominance',
        desc: `Secured ${boardsWon} board victories vs ${boardsLost} boards lost.`,
      });
    }
    if (coinsPocketed > 0) {
      strengths.push({
        type: 'STATISTICAL_STRENGTH',
        title: 'Offensive Pocketing',
        desc: `Recorded ${coinsPocketed} total coins pocketed in official scoring boards.`,
      });
    }
    if (totalMatches >= 2 && fouls === 0) {
      strengths.push({
        type: 'STATISTICAL_STRENGTH',
        title: 'Disciplined Board Play',
        desc: 'Maintained a clean disciplinary record with zero recorded fouls in official matches.',
      });
    }
  }

  if (strengths.length === 0) {
    strengths.push({
      type: 'OBSERVATION',
      title: 'Tournament Participation',
      desc: `Player has accumulated active competitive match experience across ${totalMatches} official fixtures.`,
    });
  }

  // ── 2. WEAKNESSES (Statistically Driven) ───────────────────
  if (winPercentage < 40 && totalMatches >= 2) {
    weaknesses.push({
      type: 'STATISTICAL_WEAKNESS',
      title: 'Sub-Optimal Win Conversion',
      desc: `Overall win rate is currently ${winPercentage}% (${matchesWon}W - ${matchesLost}L), pointing to difficulty in closing out matches.`,
    });
  }

  const recentLosses = last5.filter((r) => r === 'L').length;
  if (last5.length >= 3 && recentLosses >= 3) {
    weaknesses.push({
      type: 'STATISTICAL_WEAKNESS',
      title: 'Recent Form Dip',
      desc: `Conceded ${recentLosses} losses in the last ${last5.length} matches, indicating recent performance inconsistency.`,
    });
  }

  if (pointsConceded > pointsScored && pointsConceded > 0) {
    const diff = pointsConceded - pointsScored;
    weaknesses.push({
      type: 'STATISTICAL_WEAKNESS',
      title: 'Negative Point Differential',
      desc: `Conceded ${pointsConceded} points against ${pointsScored} points scored (-${diff} net deficit).`,
    });
  }

  if (sport === 'badminton' && setsLost > setsWon) {
    weaknesses.push({
      type: 'STATISTICAL_WEAKNESS',
      title: 'Set Deficit in Deciders',
      desc: `Conceded ${setsLost} sets compared to ${setsWon} sets won in contested matches.`,
    });
  } else if (sport === 'table-tennis' && gamesLost > gamesWon) {
    weaknesses.push({
      type: 'STATISTICAL_WEAKNESS',
      title: 'High Games Conceded',
      desc: `Conceded ${gamesLost} games compared to ${gamesWon} games won against tournament opponents.`,
    });
  } else if (sport === 'carrom') {
    if (boardsLost > boardsWon) {
      weaknesses.push({
        type: 'STATISTICAL_WEAKNESS',
        title: 'Board Deficit',
        desc: `Conceded ${boardsLost} boards compared to ${boardsWon} boards won in completed matches.`,
      });
    }
    if (fouls >= 2) {
      weaknesses.push({
        type: 'STATISTICAL_WEAKNESS',
        title: 'High Penalty Rate',
        desc: `Accumulated ${fouls} recorded fouls, directly surrendering board points and striker repositioning to opponents.`,
      });
    }
  }

  if (weaknesses.length === 0) {
    weaknesses.push({
      type: 'OBSERVATION',
      title: 'Minimal Critical Vulnerabilities',
      desc: 'Statistical profile shows no severe performance deficiencies in current completed fixtures.',
    });
  }

  // ── 3. IMPROVEMENT SUGGESTIONS (Practical Actions) ─────────
  if (winPercentage < 50) {
    suggestions.push({
      type: 'PRACTICAL_SUGGESTION',
      title: 'Decisive Match-Point Strategy',
      desc: 'Focus on shot selection and rally composure during critical scoreline junctures (e.g. 18-18 in badminton or 9-9 in table tennis).',
    });
  }

  if (pointsConceded > pointsScored) {
    suggestions.push({
      type: 'PRACTICAL_SUGGESTION',
      title: 'Defensive Reinforcement',
      desc: 'Improve return-of-serve consistency and defensive court/table positioning to reduce unforced errors and lower opponent point runs.',
    });
  }

  if (sport === 'carrom' && fouls > 0) {
    suggestions.push({
      type: 'PRACTICAL_SUGGESTION',
      title: 'Striker Precision & Foul Minimization',
      desc: 'Refine striker trajectory and release speed on contested angle shots to avoid giving away free penalty points.',
    });
  }

  if (totalMatches < 4) {
    suggestions.push({
      type: 'PRACTICAL_SUGGESTION',
      title: 'Expand Competitive Match Exposure',
      desc: 'Participate in inter-departmental sparring fixtures and multiple tournament brackets to build tournament stamina.',
    });
  }

  if (currentStreak >= 2) {
    suggestions.push({
      type: 'PRACTICAL_SUGGESTION',
      title: 'Sustain Momentum & Physical Conditioning',
      desc: 'Maintain pre-match warm-up and mental focus routines to extend the active winning streak into subsequent tournament stages.',
    });
  }

  suggestions.push({
    type: 'PRACTICAL_SUGGESTION',
    title: 'Opponent Tactical Review',
    desc: 'Review past match logs and head-to-head records against upcoming opponents to tailor match-day strategy and counter specific playstyles.',
  });

  return { strengths, weaknesses, suggestions };
}

module.exports = { generateFeedback };

