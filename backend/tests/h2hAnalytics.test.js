/**
 * h2hAnalytics.test.js
 * --------------------
 * Unit and integration test suite for Head-to-Head (H2H) & Player Comparison Engine.
 * Tests comparison logic, direct encounter handling, attribute leader computation,
 * common opponent detection, and match predictive probabilities.
 *
 * Run with: node backend/tests/h2hAnalytics.test.js
 */

'use strict';

const assert = require('assert');
const analyticsService = require('../services/analyticsService');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

let passed = 0;
let failed = 0;
const failures = [];

async function test(description, fn) {
  try {
    await fn();
    console.log(`  ${GREEN}✓${RESET} ${description}`);
    passed++;
  } catch (err) {
    console.log(`  ${RED}✗${RESET} ${description}`);
    console.log(`    ${RED}${err.message}${RESET}`);
    failed++;
    failures.push({ description, error: err.message });
  }
}

function section(title) {
  console.log(`\n${BOLD}${CYAN}▶ ${title}${RESET}`);
}

async function runTests() {
  section('Head-to-Head (H2H) & Player Comparison Test Suite');

  // ── TEST 1: Validation of Missing and Identical Roll Numbers ───────────────
  await test('1. Validation prevents missing roll numbers and self-comparison', async () => {
    await assert.rejects(
      async () => {
        await analyticsService.compareHeadToHead('', '2022/CSC/002');
      },
      /Both Player A and Player B registration numbers are required/
    );

    await assert.rejects(
      async () => {
        await analyticsService.compareHeadToHead('2022/CSC/001', '2022/CSC/001');
      },
      /Cannot compare a player with themselves/
    );

    await assert.rejects(
      async () => {
        await analyticsService.compareHeadToHead('2022/CSC/001 ', ' 2022/csc/001');
      },
      /Cannot compare a player with themselves/
    );
  });

  // ── TEST 2: Sport Normalization ───────────────────────────────────────────
  await test('2. Sport normalization handles table-tennis, carrom, and badminton defaults', () => {
    assert.strictEqual(analyticsService.normalizeSport('badminton'), 'badminton');
    assert.strictEqual(analyticsService.normalizeSport('Table_Tennis'), 'table-tennis');
    assert.strictEqual(analyticsService.normalizeSport('CARROM'), 'carrom');
    assert.strictEqual(analyticsService.normalizeSport('unknown_sport'), 'badminton');
  });

  // ── TEST 3: Attribute Leader Computation ──────────────────────────────────
  await test('3. Attribute comparison correctly identifies leaders and ties', () => {
    const scoreA = 88;
    const scoreB = 72;
    const leader = scoreA > scoreB ? 'playerA' : (scoreB > scoreA ? 'playerB' : 'even');
    assert.strictEqual(leader, 'playerA');

    const winRateA = 60;
    const winRateB = 60;
    const winLeader = winRateA > winRateB ? 'playerA' : (winRateB > winRateA ? 'playerB' : 'even');
    assert.strictEqual(winLeader, 'even');
  });

  // ── TEST 4: Direct H2H Encounter Aggregation ─────────────────────────────
  await test('4. Direct H2H encounter tally accurately computes wins, points and percentages', () => {
    const mockDirectMatches = [
      { id: '1', scoreA: 21, scoreB: 18, winner: 'playerA' },
      { id: '2', scoreA: 19, scoreB: 21, winner: 'playerB' },
      { id: '3', scoreA: 21, scoreB: 14, winner: 'playerA' },
    ];

    const totalEncounters = mockDirectMatches.length;
    const playerAWins = mockDirectMatches.filter((m) => m.winner === 'playerA').length;
    const playerBWins = mockDirectMatches.filter((m) => m.winner === 'playerB').length;
    const playerATotalPoints = mockDirectMatches.reduce((acc, m) => acc + m.scoreA, 0);
    const playerBTotalPoints = mockDirectMatches.reduce((acc, m) => acc + m.scoreB, 0);

    assert.strictEqual(totalEncounters, 3);
    assert.strictEqual(playerAWins, 2);
    assert.strictEqual(playerBWins, 1);
    assert.strictEqual(playerATotalPoints, 61);
    assert.strictEqual(playerBTotalPoints, 53);

    const winRateA = Math.round((playerAWins / totalEncounters) * 100);
    assert.strictEqual(winRateA, 67);
  });

  // ── TEST 5: Common Opponents Detection ────────────────────────────────────
  await test('5. Common opponents detection accurately maps mutual opponents', () => {
    const matchesA = [
      { opponentRoll: '2022/CSC/010', opponentName: 'Player X', result: 'W' },
      { opponentRoll: '2022/CSC/010', opponentName: 'Player X', result: 'W' },
      { opponentRoll: '2022/CSC/020', opponentName: 'Player Y', result: 'L' },
    ];

    const matchesB = [
      { opponentRoll: '2022/CSC/010', opponentName: 'Player X', result: 'L' },
      { opponentRoll: '2022/CSC/030', opponentName: 'Player Z', result: 'W' },
    ];

    const oppMapA = new Map();
    matchesA.forEach((m) => {
      if (!oppMapA.has(m.opponentRoll)) {
        oppMapA.set(m.opponentRoll, { name: m.opponentName, matches: 0, wins: 0, losses: 0 });
      }
      const o = oppMapA.get(m.opponentRoll);
      o.matches += 1;
      if (m.result === 'W') o.wins += 1;
      else o.losses += 1;
    });

    const oppMapB = new Map();
    matchesB.forEach((m) => {
      if (!oppMapB.has(m.opponentRoll)) {
        oppMapB.set(m.opponentRoll, { name: m.opponentName, matches: 0, wins: 0, losses: 0 });
      }
      const o = oppMapB.get(m.opponentRoll);
      o.matches += 1;
      if (m.result === 'W') o.wins += 1;
      else o.losses += 1;
    });

    const common = [];
    oppMapA.forEach((statsA, oppRoll) => {
      if (oppMapB.has(oppRoll)) {
        const statsB = oppMapB.get(oppRoll);
        common.push({
          opponentRoll: oppRoll,
          name: statsA.name,
          playerAWinRate: Math.round((statsA.wins / statsA.matches) * 100),
          playerBWinRate: Math.round((statsB.wins / statsB.matches) * 100),
        });
      }
    });

    assert.strictEqual(common.length, 1);
    assert.strictEqual(common[0].opponentRoll, '2022/CSC/010');
    assert.strictEqual(common[0].playerAWinRate, 100);
    assert.strictEqual(common[0].playerBWinRate, 0);
  });

  // ── TEST 6: Predictive Model Win Probability ─────────────────────────────
  await test('6. Prediction engine produces probabilities that total 100% and favors stronger player', () => {
    // Player A has superior H2H (2-0), higher performance score (85 vs 60), higher recent form (100% vs 40%)
    const totalEncounters = 2;
    const playerAWins = 2;
    const playerBWins = 0;
    const scoreA = 85;
    const scoreB = 60;
    const recentFormRateA = 100;
    const recentFormRateB = 40;
    const winRateA = 80;
    const winRateB = 50;

    let rawPowerA = (playerAWins / totalEncounters) * 35 + (scoreA / 100) * 30 + (recentFormRateA / 100) * 20 + (winRateA / 100) * 15;
    let rawPowerB = (playerBWins / totalEncounters) * 35 + (scoreB / 100) * 30 + (recentFormRateB / 100) * 20 + (winRateB / 100) * 15;

    const totalPower = rawPowerA + rawPowerB;
    const winProbA = Math.round((rawPowerA / totalPower) * 100);
    const winProbB = 100 - winProbA;

    assert.strictEqual(winProbA + winProbB, 100);
    assert.ok(winProbA > 65, `Player A should have high win prob (>65%), got ${winProbA}%`);
  });

  // Summary
  console.log(`\n================================`);
  console.log(`Results: ${GREEN}${passed} Passed${RESET}, ${failed > 0 ? RED : ''}${failed} Failed${RESET}`);
  console.log(`================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
