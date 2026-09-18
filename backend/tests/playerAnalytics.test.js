/**
 * playerAnalytics.test.js
 * ------------------------
 * Unit tests for Player Performance Analytics & Smart Suggestion Engine.
 * Tests pure calculation logic and rule engines with zero external framework dependencies.
 *
 * Run with: node tests/playerAnalytics.test.js
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
  section('Player Performance Analytics & Smart Suggestions Test Suite');

  // ── TEST 1: Player with no completed matches ──────────────────────────────
  await test('1. Player with no completed matches calculates score = 0 and classification "Needs Improvement"', () => {
    const stats = {
      totalMatches: 0,
      wins: 0,
      losses: 0,
      winPercentage: 0,
      currentWinningStreak: 0,
      currentLosingStreak: 0,
    };
    const score = analyticsService.calculatePerformanceScore(stats, []);
    assert.strictEqual(score.totalScore, 0);
    assert.strictEqual(score.classification, 'Needs Improvement');

    const suggestions = analyticsService.generateSuggestions(stats, [], null);
    assert.ok(suggestions.some((s) => s.id === 'new-player'), 'Should trigger new-player suggestion');
  });

  // ── TEST 2: Player with fewer than 3 matches ──────────────────────────────
  await test('2. Player with fewer than 3 matches triggers New Player suggestion', () => {
    const stats = {
      totalMatches: 2,
      wins: 1,
      losses: 1,
      winPercentage: 50,
      currentWinningStreak: 1,
      currentLosingStreak: 0,
    };
    const matches = [
      { result: 'L', date: new Date() },
      { result: 'W', date: new Date() },
    ];
    const suggestions = analyticsService.generateSuggestions(stats, matches, new Date());
    assert.ok(suggestions.some((s) => s.id === 'new-player'), 'Must contain new-player suggestion');
    const newPlayerSug = suggestions.find((s) => s.id === 'new-player');
    assert.ok(newPlayerSug.message.includes('More match data is needed'));
  });

  // ── TEST 3: Player with mostly wins (High Performance >= 75%) ─────────────
  await test('3. Player with high win rate (>= 75%) triggers High Performance suggestion and Excellent/Outstanding score', () => {
    const stats = {
      totalMatches: 10,
      wins: 9,
      losses: 1,
      winPercentage: 90,
      currentWinningStreak: 5,
      currentLosingStreak: 0,
    };
    const matches = Array(9).fill({ result: 'W', date: new Date() }).concat([{ result: 'W', date: new Date() }]);
    const score = analyticsService.calculatePerformanceScore(stats, matches);
    assert.ok(score.totalScore >= 85, `Expected high score >= 85, got ${score.totalScore}`);
    assert.ok(['Excellent', 'Outstanding'].includes(score.classification));

    const suggestions = analyticsService.generateSuggestions(stats, matches, new Date());
    assert.ok(suggestions.some((s) => s.id === 'high-performance'), 'Must trigger high-performance suggestion');
  });

  // ── TEST 4: Player with mostly losses (Low Performance < 40%) ─────────────
  await test('4. Player with low win rate (< 40%) triggers Low Performance suggestion', () => {
    const stats = {
      totalMatches: 8,
      wins: 2,
      losses: 6,
      winPercentage: 25,
      currentWinningStreak: 0,
      currentLosingStreak: 1,
    };
    const matches = [
      { result: 'L', date: new Date() },
      { result: 'L', date: new Date() },
      { result: 'W', date: new Date() },
      { result: 'L', date: new Date() },
    ];
    const score = analyticsService.calculatePerformanceScore(stats, matches);
    assert.ok(score.totalScore <= 50, `Expected low score <= 50, got ${score.totalScore}`);

    const suggestions = analyticsService.generateSuggestions(stats, matches, new Date());
    assert.ok(suggestions.some((s) => s.id === 'low-performance'), 'Must trigger low-performance suggestion');
    assert.ok(!suggestions.some((s) => s.id === 'new-player'), 'Must NOT trigger new-player for 8 matches');
  });

  // ── TEST 5: Player with a 3+ losing streak ────────────────────────────────
  await test('5. Player with 3+ losing streak triggers Losing Streak warning', () => {
    const stats = {
      totalMatches: 6,
      wins: 3,
      losses: 3,
      winPercentage: 50,
      currentWinningStreak: 0,
      currentLosingStreak: 3,
    };
    const matches = [
      { result: 'W', date: new Date() },
      { result: 'W', date: new Date() },
      { result: 'W', date: new Date() },
      { result: 'L', date: new Date() },
      { result: 'L', date: new Date() },
      { result: 'L', date: new Date() },
    ];
    const suggestions = analyticsService.generateSuggestions(stats, matches, new Date());
    assert.ok(suggestions.some((s) => s.id === 'losing-streak'), 'Must trigger losing-streak warning');
    const s = suggestions.find((s) => s.id === 'losing-streak');
    assert.strictEqual(s.type, 'danger');
  });

  // ── TEST 6: Player with improving recent performance ─────────────────────
  await test('6. Player with improving recent form triggers Positive Trajectory suggestion', () => {
    const stats = {
      totalMatches: 6,
      wins: 3,
      losses: 3,
      winPercentage: 50,
      currentWinningStreak: 2,
      currentLosingStreak: 0,
    };
    // Earlier 3 matches: L, L, L (0% wins)
    // Recent 3 matches: W, W, W (100% wins)
    const matches = [
      { result: 'L', date: new Date(Date.now() - 600000) },
      { result: 'L', date: new Date(Date.now() - 500000) },
      { result: 'L', date: new Date(Date.now() - 400000) },
      { result: 'W', date: new Date(Date.now() - 300000) },
      { result: 'W', date: new Date(Date.now() - 200000) },
      { result: 'W', date: new Date(Date.now() - 100000) },
    ];
    const suggestions = analyticsService.generateSuggestions(stats, matches, new Date());
    assert.ok(suggestions.some((s) => s.id === 'improving-performance'), 'Must trigger improving-performance suggestion');
  });

  // ── TEST 7: Player with no recent matches (> 30 days) ─────────────────────
  await test('7. Player inactive for > 30 days triggers Inactive Player reminder', () => {
    const stats = {
      totalMatches: 5,
      wins: 3,
      losses: 2,
      winPercentage: 60,
      currentWinningStreak: 1,
      currentLosingStreak: 0,
    };
    const fortyDaysAgo = new Date(Date.now() - (40 * 24 * 60 * 60 * 1000));
    const suggestions = analyticsService.generateSuggestions(stats, [], fortyDaysAgo);
    assert.ok(suggestions.some((s) => s.id === 'inactive-player'), 'Must trigger inactive-player reminder');
  });

  // ── TEST 8: Chart data generator formats responsive series ────────────────
  await test('8. buildChartData() outputs correct bar, donut, trend, and comparison structures', () => {
    const stats = {
      totalMatches: 4,
      wins: 3,
      losses: 1,
      winPercentage: 75,
      performanceScore: { totalScore: 82 },
    };
    const matches = [
      { result: 'W', date: new Date(), scoreText: '21-15', opponentName: 'Player B' },
      { result: 'L', date: new Date(), scoreText: '18-21', opponentName: 'Player C' },
      { result: 'W', date: new Date(), scoreText: '21-19', opponentName: 'Player D' },
      { result: 'W', date: new Date(), scoreText: '21-14', opponentName: 'Player E' },
    ];
    const benchmarks = {
      averageWinRate: 50,
      averageMatches: 5,
      averageScore: 60,
      topWinRate: 95,
      topMatches: 12,
      topScore: 94,
      topPlayer: { name: 'Champion', rollNumber: '2020/CSC/001' },
    };

    const charts = analyticsService.buildChartData(stats, matches, benchmarks);
    assert.strictEqual(charts.winLossBar.length, 2);
    assert.strictEqual(charts.winLossBar[0].value, 3);
    assert.strictEqual(charts.winLossBar[1].value, 1);

    assert.strictEqual(charts.winPercentageDonut[0].percentage, 75);
    assert.strictEqual(charts.winPercentageDonut[1].percentage, 25);

    assert.strictEqual(charts.recentTrend.length, 4);
    assert.strictEqual(charts.recentTrend[3].rollingWinRate, 75);

    assert.strictEqual(charts.comparison.metrics.length, 3);
    assert.strictEqual(charts.comparison.topPlayer.name, 'Champion');
  });

  // ── TEST 9: Normalization for multi-sport support ─────────────────────────
  await test('9. normalizeSport() safely validates badminton, table-tennis, and carrom', () => {
    assert.strictEqual(analyticsService.normalizeSport('badminton'), 'badminton');
    assert.strictEqual(analyticsService.normalizeSport('table-tennis'), 'table-tennis');
    assert.strictEqual(analyticsService.normalizeSport('table_tennis'), 'table-tennis');
    assert.strictEqual(analyticsService.normalizeSport('CARROM'), 'carrom');
    assert.strictEqual(analyticsService.normalizeSport('unknown_sport'), 'badminton');
  });

  // Summary
  console.log('\n───────────────────────────────────────────────');
  if (failed === 0) {
    console.log(`${BOLD}${GREEN}✅ ALL ${passed} TESTS PASSED!${RESET}\n`);
  } else {
    console.log(`${BOLD}${RED}❌ ${failed} OF ${passed + failed} TESTS FAILED${RESET}\n`);
    failures.forEach((f) => console.log(`  - ${f.description}: ${f.error}`));
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
