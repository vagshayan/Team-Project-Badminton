/**
 * emailTest.js  (DEVELOPMENT-ONLY route)
 * ----------------------------------------
 * Provides test endpoints to manually trigger each email notification type.
 *
 * IMPORTANT:
 *  - This router is mounted ONLY when NODE_ENV !== 'production' (enforced in server.js).
 *  - All endpoints require a valid admin JWT token (uses existing `protect` middleware).
 *  - Do NOT expose this in production.
 *  - These endpoints use synthetic data so they never touch real player records.
 */

'use strict';

const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const notificationService = require('../services/notificationService');
const { getModelsForSport } = require('../models/SportModels');

// ── Shared synthetic test data ────────────────────────────────────────────────

function makeFakeReg(overrides = {}) {
  return {
    _id:             '000000000000000000000001',
    playerName:      'Test Player',
    rollNumber:      '2024/CS/001',
    nicNo:           '200012345678',
    email:           process.env.EMAIL_TEST_RECIPIENT || process.env.EMAIL_USER || 'test@example.com',
    phone:           '0712345678',
    department:      'Computer Science',
    status:          'pending',
    partnerName:     '',
    partnerRollNumber: '',
    createdAt:       new Date(),
    ...overrides,
  };
}

function makeFakeTournament(overrides = {}) {
  return {
    _id:      '000000000000000000000002',
    sport:    'badminton',
    year:     new Date().getFullYear(),
    date:     new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
    time:     '10:00 AM',
    venue:    'University Sports Hall, Ground Floor',
    category: 'singles-men',
    isLocked: false,
    ...overrides,
  };
}

function makeFakeMatch(overrides = {}) {
  return {
    _id:               '000000000000000000000003',
    tournament:        '000000000000000000000002',
    round:             1,
    matchNumber:       1,
    player1:           '000000000000000000000001',
    player2:           '000000000000000000000004',
    winner:            '000000000000000000000001',
    isCompleted:       true,
    ...overrides,
  };
}

// ── Helper: safe send wrapper ─────────────────────────────────────────────────

async function runTest(res, label, asyncFn) {
  try {
    await asyncFn();
    return res.json({ success: true, message: `[EmailTest] ${label} — sent (or logged if EMAIL_ENABLED=false)` });
  } catch (err) {
    console.error(`[EmailTest] ${label} error:`, err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ── POST /api/dev/email-test/registration ────────────────────────────────────
router.post('/registration', protect, async (req, res) => {
  const reg        = makeFakeReg(req.body.reg || {});
  const tournament = makeFakeTournament(req.body.tournament || {});
  await runTest(res, 'Registration Confirmation', () =>
    notificationService.sendRegistrationConfirmation(reg, tournament)
  );
});

// ── POST /api/dev/email-test/approval ────────────────────────────────────────
router.post('/approval', protect, async (req, res) => {
  const reg        = makeFakeReg({ status: 'confirmed', ...(req.body.reg || {}) });
  const tournament = makeFakeTournament(req.body.tournament || {});
  await runTest(res, 'Registration Approval', () =>
    notificationService.sendRegistrationApproval(reg, tournament)
  );
});

// ── POST /api/dev/email-test/rejection ───────────────────────────────────────
router.post('/rejection', protect, async (req, res) => {
  const reg        = makeFakeReg({ status: 'rejected', ...(req.body.reg || {}) });
  const tournament = makeFakeTournament(req.body.tournament || {});
  await runTest(res, 'Registration Rejection', () =>
    notificationService.sendRegistrationRejection(reg, tournament)
  );
});

// ── POST /api/dev/email-test/match-scheduled ─────────────────────────────────
router.post('/match-scheduled', protect, async (req, res) => {
  const sport      = (req.body.sport || req.admin.sport || 'badminton');
  const tournament = makeFakeTournament({ sport, ...(req.body.tournament || {}) });

  // Build two fake registrations and one fake match
  const fakeReg1 = makeFakeReg({ playerName: 'Test Player One', rollNumber: '2024/CS/001' });
  const fakeReg2 = makeFakeReg({
    _id: '000000000000000000000004',
    playerName: 'Test Player Two',
    rollNumber: '2024/CS/002',
  });

  // Build a synthetic Registration model that returns our fake docs
  const fakeRegistrationModel = {
    findById: (id) => ({
      lean: async () => {
        if (String(id) === String(fakeReg1._id)) return fakeReg1;
        if (String(id) === String(fakeReg2._id)) return fakeReg2;
        return null;
      },
    }),
  };

  const fakeMatch = {
    _id:        '000000000000000000000003',
    tournament: tournament._id,
    round:      1,
    matchNumber: 1,
    player1:    fakeReg1._id,
    player2:    fakeReg2._id,
    isCompleted: false,
  };

  await runTest(res, 'Match Scheduled', () =>
    notificationService.sendMatchScheduledNotification(
      [fakeMatch], tournament, sport, fakeRegistrationModel
    )
  );
});

// ── POST /api/dev/email-test/tournament-updated ──────────────────────────────
router.post('/tournament-updated', protect, async (req, res) => {
  const sport      = (req.body.sport || req.admin.sport || 'badminton');
  const tournament = makeFakeTournament({ sport, ...(req.body.tournament || {}) });

  const beforeValues = {
    date:  new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
    time:  '09:00 AM',
    venue: 'Old Venue, Block A',
  };

  const fakeReg = makeFakeReg({ status: 'confirmed' });

  // Synthetic Registration model
  const fakeRegistrationModel = {
    find: () => ({
      lean: async () => [fakeReg],
    }),
  };

  await runTest(res, 'Tournament Updated', () =>
    notificationService.sendTournamentUpdatedNotification(
      tournament, beforeValues, sport, fakeRegistrationModel
    )
  );
});

// ── POST /api/dev/email-test/match-result ────────────────────────────────────
router.post('/match-result', protect, async (req, res) => {
  const sport = (req.body.sport || req.admin.sport || 'badminton');

  // We pass the sport directly — notificationService will look up the tournament
  // using getModelsForSport internally. For dev testing we override by calling
  // the template directly via the notification service but with a real tournament
  // if available, otherwise a safe fallback log.

  const fakeMatch = makeFakeMatch({ ...(req.body.match || {}) });
  await runTest(res, 'Match Result', () =>
    notificationService.sendMatchResultNotification(fakeMatch, sport)
  );
});

// ── GET /api/dev/email-test/status ───────────────────────────────────────────
// Simple health check — shows current email config state (no credentials exposed)
router.get('/status', protect, (req, res) => {
  const { validateConfig, isEmailEnabled } = require('../services/emailService');
  const configError  = validateConfig();
  const emailEnabled = isEmailEnabled();
  const testRecipient = process.env.EMAIL_TEST_RECIPIENT || null;

  res.json({
    emailEnabled,
    configured: !configError,
    configError: configError || null,
    testRecipientSet: !!testRecipient,
    host: process.env.EMAIL_HOST || null,
    port: process.env.EMAIL_PORT || null,
    user: process.env.EMAIL_USER || null,
    // PASSWORD intentionally omitted
  });
});

module.exports = router;
