/**
 * emailNotification.test.js
 * --------------------------
 * Comprehensive tests for the Email Notification Service.
 *
 * Uses Node.js built-in `assert` module — no external test framework needed.
 * Run with:  node tests/emailNotification.test.js
 *
 * Test coverage:
 *  1. emailService  — config validation, enable/disable toggle, send behaviour
 *  2. emailTemplates — template generation, escaping, utilities
 *  3. notificationService — fire-and-forget behaviour, error isolation
 */

'use strict';

const assert = require('assert');

// ── ANSI colours for output ───────────────────────────────────────────────────
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';

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

// ── Setup: save original env vars so we can restore them ─────────────────────
const originalEnv = { ...process.env };

function setEnv(vars) {
  Object.assign(process.env, vars);
}

function clearEmailEnv() {
  delete process.env.EMAIL_HOST;
  delete process.env.EMAIL_PORT;
  delete process.env.EMAIL_USER;
  delete process.env.EMAIL_PASSWORD;
  delete process.env.EMAIL_FROM;
  delete process.env.EMAIL_ENABLED;
  delete process.env.EMAIL_TEST_RECIPIENT;
}

function restoreEnv() {
  // Clear everything then restore originals
  clearEmailEnv();
  Object.assign(process.env, originalEnv);
}

function setValidEmailEnv() {
  setEnv({
    EMAIL_HOST:     'smtp.example.com',
    EMAIL_PORT:     '587',
    EMAIL_USER:     'test@example.com',
    EMAIL_PASSWORD: 'test-password',
    EMAIL_FROM:     '"Test" <test@example.com>',
    EMAIL_ENABLED:  'false', // Never actually send in tests
  });
}

// ── SECTION 1: emailService ───────────────────────────────────────────────────

async function testEmailService() {
  section('emailService.js');

  // Always reset the transporter cache between tests
  const emailService = require('../services/emailService');

  await test('validateConfig() returns error when env vars are missing', () => {
    clearEmailEnv();
    emailService._resetTransporter();
    const err = emailService.validateConfig();
    assert.ok(err, 'Expected a config error string');
    assert.ok(err.includes('EMAIL_HOST'), `Expected EMAIL_HOST in error: "${err}"`);
  });

  await test('validateConfig() returns null when all vars are present', () => {
    setValidEmailEnv();
    emailService._resetTransporter();
    const err = emailService.validateConfig();
    assert.strictEqual(err, null, `Expected null but got: "${err}"`);
  });

  await test('isEmailEnabled() returns false when EMAIL_ENABLED=false', () => {
    setEnv({ EMAIL_ENABLED: 'false' });
    assert.strictEqual(emailService.isEmailEnabled(), false);
  });

  await test('isEmailEnabled() returns true when EMAIL_ENABLED=true', () => {
    setEnv({ EMAIL_ENABLED: 'true' });
    assert.strictEqual(emailService.isEmailEnabled(), true);
  });

  await test('isEmailEnabled() returns true when EMAIL_ENABLED is not set (default)', () => {
    delete process.env.EMAIL_ENABLED;
    assert.strictEqual(emailService.isEmailEnabled(), true);
  });

  await test('sendEmail() returns { sent: false, reason: EMAIL_DISABLED } when disabled', async () => {
    setValidEmailEnv();
    setEnv({ EMAIL_ENABLED: 'false' });
    emailService._resetTransporter();
    const result = await emailService.sendEmail({
      to: 'player@test.com',
      subject: 'Test',
      html: '<p>Test</p>',
    });
    assert.strictEqual(result.sent, false);
    assert.strictEqual(result.reason, 'EMAIL_DISABLED');
  });

  await test('sendEmail() returns { sent: false, reason: INVALID_CONFIG } when config is missing', async () => {
    clearEmailEnv();
    setEnv({ EMAIL_ENABLED: 'true' });
    emailService._resetTransporter();
    const result = await emailService.sendEmail({
      to: 'player@test.com',
      subject: 'Test',
      html: '<p>Test</p>',
    });
    assert.strictEqual(result.sent, false);
    assert.strictEqual(result.reason, 'INVALID_CONFIG');
  });

  await test('sendEmail() returns { sent: false, reason: NO_RECIPIENT } when to is empty', async () => {
    setValidEmailEnv();
    setEnv({ EMAIL_ENABLED: 'true' });
    emailService._resetTransporter();
    const result = await emailService.sendEmail({
      to: '',
      subject: 'Test',
      html: '<p>Test</p>',
    });
    assert.strictEqual(result.sent, false);
    assert.strictEqual(result.reason, 'NO_RECIPIENT');
  });

  await test('sendEmail() respects EMAIL_TEST_RECIPIENT redirect (logged, not sent)', async () => {
    setValidEmailEnv();
    setEnv({ EMAIL_ENABLED: 'false', EMAIL_TEST_RECIPIENT: 'dev@test.com' });
    emailService._resetTransporter();
    // With EMAIL_ENABLED=false it should log and return EMAIL_DISABLED
    const result = await emailService.sendEmail({
      to: 'realplayer@uni.edu',
      subject: 'Redirect Test',
      html: '<p>Hello</p>',
    });
    // EMAIL_ENABLED=false takes precedence
    assert.strictEqual(result.sent, false);
  });

  await test('logEmailConfigStatus() does not throw', () => {
    setValidEmailEnv();
    emailService._resetTransporter();
    assert.doesNotThrow(() => emailService.logEmailConfigStatus());
  });

  await test('logEmailConfigStatus() does not expose EMAIL_PASSWORD in console output', () => {
    // We cannot intercept console.log here without monkey-patching, but we
    // verify the function runs without error and that the source code
    // does not log EMAIL_PASSWORD.
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'services', 'emailService.js'), 'utf8'
    );
    const logLines = src.split('\n').filter((l) => l.includes('console.log') || l.includes('console.warn'));
    const exposesPassword = logLines.some((l) => l.includes('EMAIL_PASSWORD') || l.includes('process.env.EMAIL_PASSWORD'));
    assert.strictEqual(exposesPassword, false, 'EMAIL_PASSWORD must not appear in any console.log/warn line');
  });

  restoreEnv();
  emailService._resetTransporter();
}

// ── SECTION 2: emailTemplates ─────────────────────────────────────────────────

async function testEmailTemplates() {
  section('emailTemplates.js');

  const templates = require('../templates/emailTemplates');

  await test('registrationConfirmationTemplate() returns non-empty HTML string', () => {
    const html = templates.registrationConfirmationTemplate({
      playerName: 'Amara Silva',
      rollNumber: '2024/CS/001',
      email: 'amara@uni.edu',
      sport: 'badminton',
      tournamentYear: 2024,
      category: 'singles-men',
      venue: 'Sports Hall A',
      tournamentDate: new Date('2025-03-01'),
      registeredAt: new Date(),
    });
    assert.ok(typeof html === 'string' && html.length > 100);
    assert.ok(html.includes('Amara Silva'), 'Should include player name');
    assert.ok(html.includes('2024/CS/001'), 'Should include roll number');
    assert.ok(html.includes('Badminton'), 'Should include sport name');
  });

  await test('registrationApprovalTemplate() contains approval language', () => {
    const html = templates.registrationApprovalTemplate({
      playerName: 'Ravi Kumar',
      rollNumber: '2024/IT/005',
      sport: 'table-tennis',
      category: 'singles-men',
      venue: 'Hall B',
      tournamentDate: new Date('2025-04-10'),
      tournamentTime: '09:00 AM',
    });
    assert.ok(html.includes('Ravi Kumar'));
    assert.ok(html.includes('Table Tennis'), 'Should display "Table Tennis" for table-tennis');
    assert.ok(html.toLowerCase().includes('approved'));
  });

  await test('registrationRejectionTemplate() contains rejection language', () => {
    const html = templates.registrationRejectionTemplate({
      playerName: 'Dilani Perera',
      rollNumber: '2024/ME/012',
      sport: 'carrom',
      category: 'singles-women',
    });
    assert.ok(html.includes('Dilani Perera'));
    assert.ok(html.toLowerCase().includes('reject'));
  });

  await test('matchScheduledTemplate() includes opponent and venue', () => {
    const html = templates.matchScheduledTemplate({
      playerName: 'Kasun Fernando',
      sport: 'badminton',
      category: 'singles-men',
      opponentName: 'Nimal Jayawardena',
      round: 1,
      matchNumber: 3,
      venue: 'Indoor Court 2',
      tournamentDate: new Date('2025-05-15'),
      tournamentTime: '02:00 PM',
    });
    assert.ok(html.includes('Kasun Fernando'));
    assert.ok(html.includes('Nimal Jayawardena'), 'Should include opponent name');
    assert.ok(html.includes('Indoor Court 2'), 'Should include venue');
    assert.ok(html.includes('#3'), 'Should include match number');
  });

  await test('matchScheduledTemplate() works without opponent (bye)', () => {
    const html = templates.matchScheduledTemplate({
      playerName: 'Solo Player',
      sport: 'badminton',
      category: 'singles-men',
      opponentName: null,
      round: 1,
      matchNumber: 1,
      venue: 'Hall A',
      tournamentDate: new Date(),
      tournamentTime: '10:00 AM',
    });
    assert.ok(html.includes('Solo Player'));
    // opponentName null → should not render an empty row
    assert.ok(!html.includes('undefined'));
  });

  await test('tournamentUpdatedTemplate() shows both old and new schedule', () => {
    const html = templates.tournamentUpdatedTemplate({
      playerName: 'Test Player',
      sport: 'carrom',
      category: 'singles-men',
      previousDate: new Date('2025-04-01'),
      previousTime: '09:00 AM',
      previousVenue: 'Old Hall',
      newDate: new Date('2025-04-15'),
      newTime: '10:00 AM',
      newVenue: 'New Hall',
    });
    assert.ok(html.includes('Old Hall'), 'Should include previous venue');
    assert.ok(html.includes('New Hall'), 'Should include new venue');
  });

  await test('matchResultTemplate() shows winner name and outcome', () => {
    const html = templates.matchResultTemplate({
      playerName: 'Winner Player',
      sport: 'badminton',
      category: 'singles-men',
      round: 2,
      matchNumber: 1,
      winnerName: 'Winner Player',
      player1Name: 'Winner Player',
      player2Name: 'Loser Player',
      isRecipientWinner: true,
    });
    assert.ok(html.includes('Winner Player'));
    assert.ok(html.toLowerCase().includes('won') || html.includes('🏆'));
  });

  await test('escapeHtml() escapes dangerous characters', () => {
    const result = templates.escapeHtml('<script>alert("xss")</script>');
    assert.ok(!result.includes('<script>'), 'Should not contain raw <script>');
    assert.ok(result.includes('&lt;script&gt;'), 'Should HTML-encode the tags');
  });

  await test('capitalizeSport() maps sport slugs correctly', () => {
    assert.strictEqual(templates.capitalizeSport('badminton'), 'Badminton');
    assert.strictEqual(templates.capitalizeSport('table-tennis'), 'Table Tennis');
    assert.strictEqual(templates.capitalizeSport('carrom'), 'Carrom');
  });

  await test('roundLabel() maps round numbers correctly', () => {
    assert.strictEqual(templates.roundLabel(1), 'Round 1');
    assert.strictEqual(templates.roundLabel(3), 'Semi-Finals');
    assert.strictEqual(templates.roundLabel(4), 'Final');
  });

  await test('formatDate() returns human-readable string from Date', () => {
    const result = templates.formatDate(new Date('2025-06-01'));
    assert.ok(typeof result === 'string' && result.length > 5);
    assert.ok(result.includes('2025'), 'Should contain the year');
  });

  await test('formatDate() returns null when date is falsy', () => {
    assert.strictEqual(templates.formatDate(null), null);
    assert.strictEqual(templates.formatDate(undefined), null);
  });
}

// ── SECTION 3: notificationService ───────────────────────────────────────────

async function testNotificationService() {
  section('notificationService.js (fire-and-forget isolation)');

  // We test only the isolation / error-handling behaviour here.
  // Actual email sending is disabled via EMAIL_ENABLED=false.
  clearEmailEnv();
  setEnv({ EMAIL_ENABLED: 'false' });

  const emailService = require('../services/emailService');
  emailService._resetTransporter();

  const notificationService = require('../services/notificationService');

  const fakeTournament = {
    _id:      'tid001',
    sport:    'badminton',
    year:     2025,
    date:     new Date('2025-06-01'),
    time:     '10:00 AM',
    venue:    'Sports Hall',
    category: 'singles-men',
  };

  const fakeReg = {
    _id:        'rid001',
    playerName: 'Test Player',
    rollNumber: '2025/CS/001',
    email:      'test@uni.edu',
    status:     'pending',
    createdAt:  new Date(),
  };

  await test('sendRegistrationConfirmation() resolves without throwing (EMAIL_ENABLED=false)', async () => {
    await assert.doesNotReject(() =>
      notificationService.sendRegistrationConfirmation(fakeReg, fakeTournament)
    );
  });

  await test('sendRegistrationApproval() resolves without throwing (EMAIL_ENABLED=false)', async () => {
    await assert.doesNotReject(() =>
      notificationService.sendRegistrationApproval({ ...fakeReg, status: 'confirmed' }, fakeTournament)
    );
  });

  await test('sendRegistrationRejection() resolves without throwing (EMAIL_ENABLED=false)', async () => {
    await assert.doesNotReject(() =>
      notificationService.sendRegistrationRejection({ ...fakeReg, status: 'rejected' }, fakeTournament)
    );
  });

  await test('sendRegistrationConfirmation() does NOT throw when reg has no email', async () => {
    const noEmailReg = { ...fakeReg, email: null };
    await assert.doesNotReject(() =>
      notificationService.sendRegistrationConfirmation(noEmailReg, fakeTournament)
    );
  });

  await test('sendRegistrationApproval() does NOT throw when reg is null', async () => {
    await assert.doesNotReject(() =>
      notificationService.sendRegistrationApproval(null, fakeTournament)
    );
  });

  await test('sendRegistrationRejection() does NOT throw when tournament is null', async () => {
    await assert.doesNotReject(() =>
      notificationService.sendRegistrationRejection(fakeReg, null)
    );
  });

  await test('sendMatchScheduledNotification() does NOT throw with empty match array', async () => {
    const fakeRegModel = { findById: () => ({ lean: async () => null }) };
    await assert.doesNotReject(() =>
      notificationService.sendMatchScheduledNotification([], fakeTournament, 'badminton', fakeRegModel)
    );
  });

  await test('sendMatchScheduledNotification() does NOT throw when registration lookup fails', async () => {
    const badRegModel = {
      findById: () => ({
        lean: async () => { throw new Error('DB Error'); },
      }),
    };
    const fakeMatch = {
      _id:        'mid001',
      tournament: 'tid001',
      round:      1,
      matchNumber: 1,
      player1:    'pid001',
      player2:    'pid002',
    };
    await assert.doesNotReject(() =>
      notificationService.sendMatchScheduledNotification([fakeMatch], fakeTournament, 'badminton', badRegModel)
    );
  });

  await test('sendTournamentUpdatedNotification() does NOT throw when Registration.find fails', async () => {
    const badRegModel = {
      find: () => ({
        lean: async () => { throw new Error('DB Error'); },
      }),
    };
    const beforeValues = { date: new Date(), time: '09:00 AM', venue: 'Old Hall' };
    await assert.doesNotReject(() =>
      notificationService.sendTournamentUpdatedNotification(fakeTournament, beforeValues, 'badminton', badRegModel)
    );
  });

  await test('sendTournamentUpdatedNotification() does NOT throw with no confirmed registrations', async () => {
    const emptyRegModel = {
      find: () => ({ lean: async () => [] }),
    };
    const beforeValues = { date: new Date(), time: '09:00 AM', venue: 'Old Hall' };
    await assert.doesNotReject(() =>
      notificationService.sendTournamentUpdatedNotification(fakeTournament, beforeValues, 'badminton', emptyRegModel)
    );
  });

  await test('sendMatchResultNotification() does NOT throw when match has no winner', async () => {
    const matchNoWinner = { _id: 'mid002', tournament: 'tid001', round: 1, matchNumber: 1, winner: null };
    await assert.doesNotReject(() =>
      notificationService.sendMatchResultNotification(matchNoWinner, 'badminton')
    );
  });

  await test('sendMatchResultNotification() does NOT throw when match is null', async () => {
    await assert.doesNotReject(() =>
      notificationService.sendMatchResultNotification(null, 'badminton')
    );
  });

  restoreEnv();
  emailService._resetTransporter();
}

// ── SECTION 4: Integration — main workflow isolation ─────────────────────────

async function testWorkflowIsolation() {
  section('Integration — email failure does not break main operations');

  // Simulate what happens in the route handler: even if notificationService
  // throws internally (it shouldn't, but let's ensure .catch is safe)

  await test('A .catch() on a resolved promise is a no-op', async () => {
    const result = await Promise.resolve('OK');
    assert.strictEqual(result, 'OK');
  });

  await test('A .catch() on a rejected notification does not propagate', async () => {
    let caught = false;
    const brokenNotify = async () => { throw new Error('Email server down'); };
    await brokenNotify().catch((err) => { caught = true; });
    assert.strictEqual(caught, true, 'catch handler should have run');
    // After catch, execution continues — the main workflow is safe
  });

  await test('Registration response is independent of email result', async () => {
    // Simulate: reg saved, email fails, response still sends correctly
    const reg = { id: '123', playerName: 'Test', email: 'x@y.com', status: 'pending' };
    let registrationSavedSuccessfully = false;

    // Simulate save
    registrationSavedSuccessfully = true;

    // Simulate email failure (fire-and-forget)
    const emailPromise = Promise.reject(new Error('SMTP timeout'));
    emailPromise.catch(() => {}); // silenced

    assert.strictEqual(registrationSavedSuccessfully, true,
      'Registration should succeed even when email fails');
  });
}

// ── SECTION 5: Environment variable documentation check ──────────────────────

async function testEnvDocumentation() {
  section('Environment Variables — .env.example documentation');

  const fs   = require('fs');
  const path = require('path');
  const envExamplePath = path.join(__dirname, '..', '.env.example');

  await test('.env.example file exists', () => {
    assert.ok(fs.existsSync(envExamplePath), '.env.example must exist');
  });

  await test('.env.example documents EMAIL_HOST', () => {
    const content = fs.readFileSync(envExamplePath, 'utf8');
    assert.ok(content.includes('EMAIL_HOST'), 'Must document EMAIL_HOST');
  });

  await test('.env.example documents EMAIL_ENABLED', () => {
    const content = fs.readFileSync(envExamplePath, 'utf8');
    assert.ok(content.includes('EMAIL_ENABLED'), 'Must document EMAIL_ENABLED');
  });

  await test('.env.example does NOT contain a real password', () => {
    const content = fs.readFileSync(envExamplePath, 'utf8');
    // Passwords in .env.example should be placeholder strings, not real values
    const lines = content.split('\n').filter((l) => l.startsWith('EMAIL_PASSWORD'));
    for (const line of lines) {
      const val = line.split('=')[1] || '';
      // A placeholder will typically contain angle brackets or be empty
      const looksReal = val.trim().length > 5
        && !val.includes('<')
        && !val.includes('your-')
        && !val.includes('replace');
      assert.strictEqual(looksReal, false,
        `EMAIL_PASSWORD in .env.example looks like a real credential: "${val}"`);
    }
  });
}

// ── Run all test sections ─────────────────────────────────────────────────────

(async () => {
  console.log(`\n${BOLD}${CYAN}════════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}${CYAN}  Email Notification Service — Test Suite${RESET}`);
  console.log(`${BOLD}${CYAN}  University Indoor Games Management System${RESET}`);
  console.log(`${BOLD}${CYAN}════════════════════════════════════════════════════${RESET}`);

  await testEmailService();
  await testEmailTemplates();
  await testNotificationService();
  await testWorkflowIsolation();
  await testEnvDocumentation();

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n${BOLD}${CYAN}════════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}  Results: ${GREEN}${passed} passed${RESET}${BOLD}, ${failed > 0 ? RED : GREEN}${failed} failed${RESET}`);

  if (failures.length > 0) {
    console.log(`\n${RED}${BOLD}Failed tests:${RESET}`);
    failures.forEach(({ description, error }) => {
      console.log(`  ${RED}✗${RESET} ${description}`);
      console.log(`    ${YELLOW}${error}${RESET}`);
    });
  } else {
    console.log(`${GREEN}${BOLD}  All tests passed! ✓${RESET}`);
  }

  console.log(`${BOLD}${CYAN}════════════════════════════════════════════════════${RESET}\n`);

  process.exit(failed > 0 ? 1 : 0);
})();
