/**
 * Automated Test Suite for University of Jaffna Sports Tournament Email System
 * Tests all notification scenarios:
 * 1. Email validation
 * 2. Registration Confirmation Email
 * 3. Schedule Update Notifications with highlighted changes
 * 4. Partner Selection Notifications (with action links)
 * 5. Partnership Confirmation (notifying both participants)
 * 6. Partnership Rejection
 * 7. Registration Cancellation
 * 8. Draw Published Notifications
 * 9. Invalid email address handling
 * 10. SMTP delivery failure resilience & error logging
 * 11. Duplicate prevention in batch schedule notifications
 */

const assert = require('assert');
const {
  isValidEmail,
  setMockTransporter,
  sendSafeMail,
  sendRegistrationConfirmationEmail,
  sendScheduleUpdateEmail,
  sendScheduleUpdateBatchEmail,
  sendPartnerSelectionEmail,
  sendPartnershipConfirmedEmail,
  sendPartnershipRejectedEmail,
  sendRegistrationCancellationEmail,
  sendDrawPublishedEmail,
} = require('./utils/emailService');

const {
  renderRegistrationConfirmationEmail,
  renderScheduleUpdateEmail,
  renderPartnerSelectionEmail,
  renderPartnershipStatusEmail,
  renderRegistrationCancellationEmail,
  renderDrawPublishedEmail,
} = require('./utils/emailTemplates');

let sentMails = [];

// Create in-memory mock transporter to intercept and inspect all sent emails
const createMockTransport = () => ({
  sendMail: async (mailOptions) => {
    sentMails.push(mailOptions);
    return {
      messageId: `<mock-${Date.now()}-${Math.random().toString(36).substring(7)}@univ.jfn.ac.lk>`,
      accepted: [mailOptions.to],
    };
  },
});

const runTests = async () => {
  console.log('\n======================================================');
  console.log('🧪 RUNNING EMAIL NOTIFICATION SYSTEM TEST SUITE');
  console.log('======================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  const test = async (name, fn) => {
    totalTests++;
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Reason: ${err.message}`);
    }
  };

  // Reset sent mails and configure mock transport
  sentMails = [];
  setMockTransporter(createMockTransport());

  // ── TEST 1: Email Validation ─────────────────────────────
  await test('Email validation accurately validates email formats', () => {
    assert.strictEqual(isValidEmail('student@univ.jfn.ac.lk'), true);
    assert.strictEqual(isValidEmail('john.doe@gmail.com'), true);
    assert.strictEqual(isValidEmail('invalid-email'), false);
    assert.strictEqual(isValidEmail(''), false);
    assert.strictEqual(isValidEmail(null), false);
    assert.strictEqual(isValidEmail('missing@domain'), false);
    assert.strictEqual(isValidEmail('@nodomain.com'), false);
  });

  // ── TEST 2: Registration Confirmation Email ──────────────
  await test('Registration confirmation email generates correct content & sends', async () => {
    sentMails = [];
    const regData = {
      email: 'arun2021@univ.jfn.ac.lk',
      playerName: 'Arun Kumar',
      rollNumber: '2021/CSC/045',
      nicNo: '200112345678',
      department: 'Faculty of Science',
      sport: 'badminton',
      category: 'singles-men',
      partnerName: '',
      partnerRollNumber: '',
      status: 'pending',
      tournamentDate: new Date('2026-11-15T09:00:00Z'),
      tournamentTime: '09:00 AM',
      venue: 'University Indoor Stadium Court 1',
    };

    const res = await sendRegistrationConfirmationEmail(regData);
    assert.strictEqual(res.success, true);
    assert.strictEqual(sentMails.length, 1);

    const sent = sentMails[0];
    assert.strictEqual(sent.to, 'arun2021@univ.jfn.ac.lk');
    assert.ok(sent.subject.includes('Registration Confirmed'));
    assert.ok(sent.subject.includes('Badminton'));
    assert.ok(sent.html.includes('Arun Kumar'));
    assert.ok(sent.html.includes('2021/CSC/045'));
    assert.ok(sent.html.includes("Men's Singles"));
    assert.ok(sent.html.includes('University Indoor Stadium Court 1'));
    assert.ok(sent.text.includes('Arun Kumar'));
  });

  // ── TEST 3: Doubles Registration Confirmation with Partner ─
  await test('Doubles registration email includes partner details', async () => {
    sentMails = [];
    const regData = {
      email: 'siva2021@univ.jfn.ac.lk',
      playerName: 'Siva Ganeshan',
      rollNumber: '2021/ENG/012',
      nicNo: '200055443322',
      department: 'Faculty of Engineering',
      sport: 'table-tennis',
      category: 'doubles-men',
      partnerName: 'Kavitha Nathan',
      partnerRollNumber: '2021/ENG/088',
      status: 'confirmed',
      tournamentDate: new Date('2026-11-20T10:00:00Z'),
      tournamentTime: '10:00 AM',
      venue: 'Table Tennis Hall',
    };

    const res = await sendRegistrationConfirmationEmail(regData);
    assert.strictEqual(res.success, true);
    assert.strictEqual(sentMails.length, 1);

    const sent = sentMails[0];
    assert.ok(sent.html.includes('Kavitha Nathan (2021/ENG/088)'));
    assert.ok(sent.html.includes('Table Tennis'));
    assert.ok(sent.html.includes("Men's Doubles"));
  });

  // ── TEST 4: Schedule Update Notification with Highlighted Changes ─
  await test('Schedule update email highlights changes and presents new schedule', async () => {
    sentMails = [];
    const updateData = {
      email: 'player@univ.jfn.ac.lk',
      playerName: 'Praveen Raman',
      sport: 'badminton',
      category: 'mixed-doubles',
      changes: [
        { field: 'Event Date', previous: 'Sat, Nov 14, 2026', updated: 'Sat, Nov 21, 2026' },
        { field: 'Start Time', previous: '09:00', updated: '11:30' },
        { field: 'Venue', previous: 'Gym Court 1', updated: 'Main Indoor Arena' },
      ],
      currentSchedule: {
        date: new Date('2026-11-21T11:30:00Z'),
        time: '11:30',
        venue: 'Main Indoor Arena',
      },
    };

    const res = await sendScheduleUpdateEmail(updateData);
    assert.strictEqual(res.success, true);
    assert.strictEqual(sentMails.length, 1);

    const sent = sentMails[0];
    assert.ok(sent.subject.includes('Schedule Update Notice'));
    assert.ok(sent.subject.includes('Badminton'));
    assert.ok(sent.html.includes('Sat, Nov 14, 2026')); // Old date in diff
    assert.ok(sent.html.includes('Sat, Nov 21, 2026')); // New date in diff
    assert.ok(sent.html.includes('Main Indoor Arena')); // New venue
    assert.ok(sent.html.includes('diff-table'));
    assert.ok(sent.text.includes('Was "09:00" -> Now "11:30"'));
  });

  // ── TEST 5: Batch Schedule Update (Deduplication & Error Handling) ─
  await test('Batch schedule update deduplicates recipients and skips invalid emails', async () => {
    sentMails = [];
    const participants = [
      { email: 'player1@univ.jfn.ac.lk', playerName: 'Player One' },
      { email: 'player2@univ.jfn.ac.lk', playerName: 'Player Two' },
      { email: 'player1@univ.jfn.ac.lk', playerName: 'Player One Duplicate' }, // Duplicate
      { email: 'invalid-email-address', playerName: 'Invalid Player' }, // Invalid format
      { email: '', playerName: 'Empty Player' }, // Empty
    ];

    const batchRes = await sendScheduleUpdateBatchEmail({
      participants,
      sport: 'carrom',
      category: 'singles-men',
      changes: [{ field: 'Venue', previous: 'Room A', updated: 'Auditorium' }],
      currentSchedule: { date: new Date('2026-12-01'), time: '14:00', venue: 'Auditorium' },
    });

    assert.strictEqual(batchRes.total, 2); // Exactly 2 valid unique emails
    assert.strictEqual(batchRes.sentCount, 2);
    assert.strictEqual(sentMails.length, 2);
    const sentRecipients = sentMails.map((m) => m.to);
    assert.ok(sentRecipients.includes('player1@univ.jfn.ac.lk'));
    assert.ok(sentRecipients.includes('player2@univ.jfn.ac.lk'));
  });

  // ── TEST 6: Partner Selection Email with Action Links ───────
  await test('Partner selection email includes partner, requester, and action links', async () => {
    sentMails = [];
    const partnerData = {
      partnerEmail: 'kavitha@univ.jfn.ac.lk',
      partnerName: 'Kavitha Nathan',
      partnerRollNumber: '2021/ENG/088',
      requesterName: 'Siva Ganeshan',
      requesterRollNumber: '2021/ENG/012',
      sport: 'badminton',
      category: 'mixed-doubles',
      tournamentDate: new Date('2026-11-20'),
      venue: 'University Indoor Stadium',
      requestId: '672001a1b2c3d4e5f6a7b8c9',
      confirmationToken: 'abc123tokensecret456',
    };

    const res = await sendPartnerSelectionEmail(partnerData);
    assert.strictEqual(res.success, true);
    assert.strictEqual(sentMails.length, 1);

    const sent = sentMails[0];
    assert.strictEqual(sent.to, 'kavitha@univ.jfn.ac.lk');
    assert.ok(sent.subject.includes('Partner Request: Siva Ganeshan selected you'));
    assert.ok(sent.html.includes('Siva Ganeshan (2021/ENG/012)'));
    assert.ok(sent.html.includes('Kavitha Nathan'));
    assert.ok(sent.html.includes('action=accept'));
    assert.ok(sent.html.includes('action=reject'));
    assert.ok(sent.html.includes('abc123tokensecret456'));
  });

  // ── TEST 7: Partnership Confirmed (Both Players Notified) ──
  await test('Partnership confirmation notifies both participants', async () => {
    sentMails = [];
    const confirmationData = {
      requesterEmail: 'siva@univ.jfn.ac.lk',
      requesterName: 'Siva Ganeshan',
      targetEmail: 'kavitha@univ.jfn.ac.lk',
      targetName: 'Kavitha Nathan',
      sport: 'badminton',
      category: 'mixed-doubles',
    };

    const res = await sendPartnershipConfirmedEmail(confirmationData);
    assert.strictEqual(res.success, true);
    assert.strictEqual(sentMails.length, 2); // 2 separate emails!

    const recipients = sentMails.map((m) => m.to);
    assert.ok(recipients.includes('siva@univ.jfn.ac.lk'));
    assert.ok(recipients.includes('kavitha@univ.jfn.ac.lk'));

    for (const mail of sentMails) {
      assert.ok(mail.subject.includes('Partnership Confirmed'));
      assert.ok(mail.html.includes('Siva Ganeshan') && mail.html.includes('Kavitha Nathan'));
    }
  });

  // ── TEST 8: Partnership Rejected ──────────────────────────
  await test('Partnership rejection sends notification to requester', async () => {
    sentMails = [];
    const rejectionData = {
      requesterEmail: 'siva@univ.jfn.ac.lk',
      requesterName: 'Siva Ganeshan',
      targetName: '2021/ENG/088',
      sport: 'badminton',
      category: 'mixed-doubles',
    };

    const res = await sendPartnershipRejectedEmail(rejectionData);
    assert.strictEqual(res.success, true);
    assert.strictEqual(sentMails.length, 1);

    const sent = sentMails[0];
    assert.strictEqual(sent.to, 'siva@univ.jfn.ac.lk');
    assert.ok(sent.subject.includes('Partner Request Declined'));
    assert.ok(sent.html.includes('was not accepted'));
  });

  // ── TEST 9: Registration Cancellation Email ───────────────
  await test('Registration cancellation email sends accurate summary', async () => {
    sentMails = [];
    const res = await sendRegistrationCancellationEmail({
      email: 'student@univ.jfn.ac.lk',
      playerName: 'Niroshan Raj',
      rollNumber: '2020/AG/014',
      sport: 'carrom',
      category: 'singles-men',
      reason: 'Withdrawn by student request',
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(sentMails.length, 1);

    const sent = sentMails[0];
    assert.strictEqual(sent.to, 'student@univ.jfn.ac.lk');
    assert.ok(sent.subject.includes('Registration Cancelled'));
    assert.ok(sent.html.includes('Withdrawn by student request'));
  });

  // ── TEST 10: Official Draw Published Email ────────────────
  await test('Draw published email notifies confirmed participants', async () => {
    sentMails = [];
    const res = await sendDrawPublishedEmail({
      email: 'player@univ.jfn.ac.lk',
      playerName: 'Dinesh Kumar',
      sport: 'badminton',
      category: 'singles-men',
      tournamentDate: new Date('2026-11-28'),
      venue: 'Main Sports Complex',
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(sentMails.length, 1);

    const sent = sentMails[0];
    assert.ok(sent.subject.includes('Official Draw Published'));
    assert.ok(sent.html.includes('Main Sports Complex'));
  });

  // ── TEST 11: Invalid Email Handling ───────────────────────
  await test('Invalid recipient email is handled gracefully without crashing', async () => {
    sentMails = [];
    const res = await sendSafeMail({
      to: 'invalid-email-not-valid',
      subject: 'Test Subject',
      html: '<p>Test</p>',
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, 'Invalid recipient email format');
    assert.strictEqual(sentMails.length, 0); // Nothing sent
  });

  // ── TEST 12: SMTP Delivery Failure Resilience ─────────────
  await test('SMTP network/delivery failure is caught safely and logged without throwing', async () => {
    // Configure failing transporter to simulate SMTP server timeout/network drop
    setMockTransporter({
      sendMail: async () => {
        throw new Error('ECONNREFUSED: Connection refused at smtp.gmail.com:587');
      },
    });

    const res = await sendSafeMail({
      to: 'valid.student@univ.jfn.ac.lk',
      subject: 'Test Subject',
      html: '<p>Test Content</p>',
    });

    assert.strictEqual(res.success, false);
    assert.ok(res.error.includes('ECONNREFUSED'));

    // Restore working mock
    setMockTransporter(createMockTransport());
  });

  // ── TEST 13: Missing SMTP Config Graceful Skip ─────────────
  await test('Missing SMTP config skips gracefully when mock is disabled', async () => {
    // Unset mock and clear SMTP env vars temporarily
    setMockTransporter(null);
    const origHost = process.env.SMTP_HOST;
    delete process.env.SMTP_HOST;

    const res = await sendSafeMail({
      to: 'test@univ.jfn.ac.lk',
      subject: 'Test',
      html: '<p>Test</p>',
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.skipped, true);

    // Restore
    if (origHost) process.env.SMTP_HOST = origHost;
    setMockTransporter(createMockTransport());
  });

  console.log('\n======================================================');
  console.log(`🏁 TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('======================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
};

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
