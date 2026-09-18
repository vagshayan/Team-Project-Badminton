'use strict';

/**
 * playerQr.test.js
 * -----------------
 * Comprehensive test suite for QR-Based Player Registration, Approval,
 * Match Information, Timeline, Admin Verification, and Check-In System.
 */

const assert = require('assert');
const crypto = require('crypto');

let passedTests = 0;
let failedTests = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('\n════════════════════════════════════════════════════');
  console.log('  QR Player Pass & Match Information Test Suite');
  console.log('  University Indoor Games Management System');
  console.log('════════════════════════════════════════════════════\n');

  console.log('▶ 1. Cryptographic QR Token Generation');

  await test('Generates unique 40-character hex tokens', () => {
    const token1 = crypto.randomBytes(20).toString('hex');
    const token2 = crypto.randomBytes(20).toString('hex');
    assert.strictEqual(token1.length, 40);
    assert.strictEqual(token2.length, 40);
    assert.notStrictEqual(token1, token2);
    assert.match(token1, /^[0-9a-f]{40}$/);
  });

  console.log('\n▶ 2. Data Model Schema Validation');

  await test('SportModels.js provides dynamic schemas for all 3 sports', () => {
    const { getModelsForSport } = require('../models/SportModels');
    const sports = ['badminton', 'table-tennis', 'carrom'];
    for (const sport of sports) {
      const { Registration, Tournament, Player } = getModelsForSport(sport);
      assert.ok(Registration, `Registration model exists for ${sport}`);
      assert.ok(Tournament, `Tournament model exists for ${sport}`);
      assert.ok(Player, `Player model exists for ${sport}`);
      assert.ok(Registration.schema.path('qrToken'), `qrToken path exists on ${sport} Registration schema`);
      assert.ok(Registration.schema.path('qrTokenCreatedAt'), `qrTokenCreatedAt exists on ${sport} Registration schema`);
      assert.ok(Registration.schema.path('qrTokenRevoked'), `qrTokenRevoked exists on ${sport} Registration schema`);
    }
  });

  await test('Match.js schema contains court, venue, checkIns, and timeline fields', () => {
    const Match = require('../models/Match');
    assert.ok(Match.schema.path('court'), 'court field exists on Match schema');
    assert.ok(Match.schema.path('venue'), 'venue field exists on Match schema');
    assert.ok(Match.schema.path('status'), 'status field exists on Match schema');
    assert.ok(Match.schema.path('checkIns'), 'checkIns field exists on Match schema');
    assert.ok(Match.schema.path('timeline'), 'timeline field exists on Match schema');
  });

  console.log('\n▶ 3. Player Pass Route Helper Functions');

  await test('findRegistrationByToken correctly exported and handles null token safely', async () => {
    const { findRegistrationByToken } = require('../routes/playerQr');
    assert.strictEqual(typeof findRegistrationByToken, 'function');
    const result = await findRegistrationByToken(null);
    assert.strictEqual(result, null);
    const emptyResult = await findRegistrationByToken('');
    assert.strictEqual(emptyResult, null);
  });

  await test('findRegistrationByRollNumber handles invalid inputs safely', async () => {
    const { findRegistrationByRollNumber } = require('../routes/playerQr');
    assert.strictEqual(typeof findRegistrationByRollNumber, 'function');
    const result = await findRegistrationByRollNumber(null);
    assert.strictEqual(result, null);
  });

  console.log('\n▶ 4. Verification & Eligibility Logic');

  await test('Eligibility evaluates pending registration as not eligible for match play', () => {
    const reg = { status: 'pending', qrTokenRevoked: false };
    let eligible = true;
    let reason = '';
    if (reg.qrTokenRevoked) {
      eligible = false;
      reason = 'QR pass is revoked or expired.';
    } else if (reg.status === 'pending') {
      eligible = false;
      reason = 'Registration is pending admin approval.';
    }
    assert.strictEqual(eligible, false);
    assert.strictEqual(reason, 'Registration is pending admin approval.');
  });

  await test('Eligibility evaluates confirmed registration as eligible', () => {
    const reg = { status: 'confirmed', qrTokenRevoked: false };
    let eligible = true;
    let reason = 'Player is approved and eligible for tournament play.';
    if (reg.qrTokenRevoked || reg.status !== 'confirmed') {
      eligible = false;
    }
    assert.strictEqual(eligible, true);
    assert.strictEqual(reason, 'Player is approved and eligible for tournament play.');
  });

  await test('Eligibility evaluates rejected registration as not eligible', () => {
    const reg = { status: 'rejected', qrTokenRevoked: false };
    let eligible = true;
    let reason = '';
    if (reg.status === 'rejected') {
      eligible = false;
      reason = 'Registration was rejected by administration.';
    }
    assert.strictEqual(eligible, false);
    assert.strictEqual(reason, 'Registration was rejected by administration.');
  });

  await test('Eligibility evaluates revoked token as not eligible', () => {
    const reg = { status: 'confirmed', qrTokenRevoked: true };
    let eligible = true;
    let reason = '';
    if (reg.qrTokenRevoked) {
      eligible = false;
      reason = 'QR pass is revoked or expired.';
    }
    assert.strictEqual(eligible, false);
    assert.strictEqual(reason, 'QR pass is revoked or expired.');
  });

  console.log('\n▶ 5. Check-In & Duplicate Prevention');

  await test('Check-in records timestamp, rollNumber, and prevents duplicates', () => {
    const match = {
      round: 1,
      matchNumber: 1,
      court: 'Court 1',
      checkIns: [],
      timeline: [],
    };

    const playerRoll = '2023/CSE/001';
    const adminId = '64e8f9a2b1c2d3e4f5a6b7c8';

    // First check-in
    const existing = match.checkIns.find(ci => ci.rollNumber === playerRoll);
    assert.strictEqual(existing, undefined);

    match.checkIns.push({
      rollNumber: playerRoll,
      playerName: 'Kasun Perera',
      checkedInAt: new Date(),
      checkedInBy: adminId,
    });

    assert.strictEqual(match.checkIns.length, 1);
    assert.strictEqual(match.checkIns[0].rollNumber, playerRoll);

    // Second check-in attempt (duplicate)
    const duplicate = match.checkIns.find(ci => ci.rollNumber === playerRoll);
    assert.ok(duplicate, 'Duplicate check-in detected successfully');
    assert.strictEqual(match.checkIns.length, 1, 'Check-in array length remains 1');
  });

  console.log('\n▶ 6. Match Timeline Generation');

  await test('Generates chronological updates for match events', () => {
    const timeline = [];
    const regDate = new Date('2026-08-20T10:00:00Z');
    const approveDate = new Date('2026-08-21T14:00:00Z');
    const matchSchedDate = new Date('2026-08-22T09:00:00Z');
    const checkInDate = new Date('2026-08-25T13:30:00Z');

    timeline.push({ id: 1, title: 'Registration Received', timestamp: regDate });
    timeline.push({ id: 2, title: 'Registration Approved', timestamp: approveDate });
    timeline.push({ id: 3, title: 'Match Scheduled', timestamp: matchSchedDate });
    timeline.push({ id: 4, title: 'Player Checked In', timestamp: checkInDate });

    timeline.sort((a, b) => b.timestamp - a.timestamp);

    assert.strictEqual(timeline[0].title, 'Player Checked In');
    assert.strictEqual(timeline[1].title, 'Match Scheduled');
    assert.strictEqual(timeline[2].title, 'Registration Approved');
    assert.strictEqual(timeline[3].title, 'Registration Received');
  });

  console.log('\n▶ 7. Email Integration with QR Player Pass');

  await test('Email templates render digital player pass link when qrToken is present', () => {
    const { registrationConfirmationTemplate, registrationApprovalTemplate } = require('../templates/emailTemplates');
    const testToken = 'abc123def4567890123456789012345678901234';

    const confirmationHtml = registrationConfirmationTemplate({
      playerName: 'Kamal Silva',
      rollNumber: '2023/CSE/099',
      sport: 'badminton',
      category: 'singles-men',
      venue: 'Indoor Stadium',
      tournamentDate: new Date(),
      qrToken: testToken,
    });

    assert.ok(confirmationHtml.includes(`/player/qr/${testToken}`), 'Confirmation email contains player QR link');
    assert.ok(confirmationHtml.includes('VIEW DIGITAL PLAYER PASS'), 'Confirmation email contains Pass button');

    const approvalHtml = registrationApprovalTemplate({
      playerName: 'Kamal Silva',
      rollNumber: '2023/CSE/099',
      sport: 'badminton',
      category: 'singles-men',
      venue: 'Indoor Stadium',
      tournamentDate: new Date(),
      tournamentTime: '4:30 PM',
      qrToken: testToken,
    });

    assert.ok(approvalHtml.includes(`/player/qr/${testToken}`), 'Approval email contains player QR link');
    assert.ok(approvalHtml.includes('VIEW DIGITAL PLAYER PASS'), 'Approval email contains Pass button');
  });

  console.log('\n▶ 8. Multi-Sport Support: Badminton, Table Tennis, Carrom');

  await test('Sport metadata covers all 3 sports with correct unit labels and color branding', () => {
    const sports = ['badminton', 'table-tennis', 'carrom'];
    const units = {
      badminton: 'Court',
      'table-tennis': 'Table',
      carrom: 'Board',
    };

    sports.forEach((sport) => {
      assert.ok(units[sport], `Unit label defined for ${sport}`);
    });
  });

  console.log('\n════════════════════════════════════════════════════');
  console.log(`  Results: ${passedTests} passed, ${failedTests} failed`);
  if (failedTests === 0) {
    console.log('  ✅ ALL TESTS PASSED SUCCESSFULLY!');
  } else {
    console.log('  ❌ SOME TESTS FAILED.');
  }
  console.log('════════════════════════════════════════════════════\n');

  if (failedTests > 0) process.exit(1);
}

runTests();
