/**
 * Route-level Integration Test for Tournament Email System
 * Verifies that:
 * 1. GET /api/registrations/partner-requests/:id/respond validates ObjectId (404 on malformed ID)
 * 2. GET /api/registrations/partner-requests/:id/respond rejects invalid security tokens (403)
 * 3. GET /api/registrations/partner-requests/:id/respond handles action=accept (paired status & confirmation emails)
 * 4. GET /api/registrations/partner-requests/:id/respond handles action=reject (rejected status & rejection email)
 * 5. GET /api/registrations/partner-requests/:id/respond handles already processed requests
 */

const express = require('express');
const http = require('http');
const assert = require('assert');
const { setMockTransporter } = require('./utils/emailService');
const sportModelsModule = require('./models/SportModels');

const runRouteIntegrationTests = async () => {
  console.log('\n======================================================');
  console.log('🧪 RUNNING ROUTE INTEGRATION TEST SUITE');
  console.log('======================================================\n');

  let sentMails = [];
  setMockTransporter({
    sendMail: async (opts) => {
      sentMails.push(opts);
      return { messageId: '<mock-route-test@univ.jfn.ac.lk>' };
    },
  });

  // Mock sample records
  const sampleRequester = {
    _id: '672001a1b2c3d4e5f6a7b801',
    playerName: 'Siva Ganeshan',
    rollNumber: '2021/ENG/012',
    email: 'siva@univ.jfn.ac.lk',
    gender: 'Male',
    partnerStatus: 'looking',
    pairStatus: 'incomplete',
    save: async function () { return this; },
  };

  const sampleTarget = {
    _id: '672001a1b2c3d4e5f6a7b802',
    playerName: 'Kavitha Nathan',
    rollNumber: '2021/ENG/088',
    email: 'kavitha@univ.jfn.ac.lk',
    gender: 'Female',
    partnerStatus: 'looking',
    pairStatus: 'incomplete',
    save: async function () { return this; },
  };

  const sampleTournament = {
    _id: '672001a1b2c3d4e5f6a7b803',
    sport: 'badminton',
    category: 'mixed-doubles',
    date: new Date('2026-11-20'),
    time: '10:00',
    venue: 'Indoor Court',
  };

  let mockRequestDoc = {
    _id: '672001a1b2c3d4e5f6a7b899',
    tournament: sampleTournament._id,
    requesterRegistration: sampleRequester._id,
    requesterRollNumber: sampleRequester.rollNumber,
    targetRegistration: sampleTarget._id,
    targetRollNumber: sampleTarget.rollNumber,
    confirmationToken: 'valid-secret-token-123',
    status: 'pending',
    save: async function () { return this; },
  };

  // Mock getModelsForSport
  const originalGetModels = sportModelsModule.getModelsForSport;
  sportModelsModule.getModelsForSport = (sport) => ({
    PartnerRequest: {
      findById: async (id) => (String(id) === String(mockRequestDoc._id) ? mockRequestDoc : null),
      updateMany: async () => ({ modifiedCount: 1 }),
    },
    Registration: {
      findById: async (id) => {
        if (String(id) === String(sampleRequester._id)) return sampleRequester;
        if (String(id) === String(sampleTarget._id)) return sampleTarget;
        return null;
      },
    },
    Tournament: {
      findById: async (id) => sampleTournament,
    },
    Pair: {
      create: async (data) => ({ _id: '672001a1b2c3d4e5f6a7b877', ...data }),
    },
  });

  const app = express();
  app.use(express.json());
  const registrationRoutes = require('./routes/registrations');
  app.use('/api/registrations', registrationRoutes);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;
  let total = 0;

  const test = async (name, fn) => {
    total++;
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Reason: ${err.message}`);
    }
  };

  // Test 1: Invalid ObjectId is rejected immediately with 404
  await test('GET /respond with malformed ID returns 404 page', async () => {
    const res = await fetch(`${baseUrl}/api/registrations/partner-requests/not-an-object-id/respond?action=accept&token=xyz`);
    assert.strictEqual(res.status, 404);
    const text = await res.text();
    assert.ok(text.includes('Request Not Found'));
  });

  // Test 2: Nonexistent valid ObjectId returns 404
  await test('GET /respond with nonexistent ID returns 404 page', async () => {
    const res = await fetch(`${baseUrl}/api/registrations/partner-requests/111111111111111111111111/respond?action=accept&token=xyz`);
    assert.strictEqual(res.status, 404);
    const text = await res.text();
    assert.ok(text.includes('Request Not Found'));
  });

  // Test 3: Invalid confirmation token returns 403
  await test('GET /respond with invalid security token returns 403 page', async () => {
    const res = await fetch(`${baseUrl}/api/registrations/partner-requests/${mockRequestDoc._id}/respond?action=accept&token=wrong-token`);
    assert.strictEqual(res.status, 403);
    const text = await res.text();
    assert.ok(text.includes('Invalid Confirmation Link'));
  });

  // Test 4: Action accept confirms partnership and notifies both players
  await test('GET /respond with action=accept confirms pair and notifies both players', async () => {
    sentMails = [];
    mockRequestDoc.status = 'pending';
    sampleRequester.pairStatus = 'incomplete';
    sampleTarget.pairStatus = 'incomplete';

    const res = await fetch(`${baseUrl}/api/registrations/partner-requests/${mockRequestDoc._id}/respond?action=accept&token=valid-secret-token-123`);
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('Partnership Confirmed'));
    assert.strictEqual(mockRequestDoc.status, 'accepted');
    assert.strictEqual(sampleRequester.pairStatus, 'complete');
    assert.strictEqual(sampleTarget.pairStatus, 'complete');

    // Verify both players were notified by email
    assert.strictEqual(sentMails.length, 2);
    const recipients = sentMails.map((m) => m.to);
    assert.ok(recipients.includes('siva@univ.jfn.ac.lk'));
    assert.ok(recipients.includes('kavitha@univ.jfn.ac.lk'));
  });

  // Test 5: Re-visiting already accepted request returns already processed message
  await test('GET /respond on already accepted request shows already processed page', async () => {
    mockRequestDoc.status = 'accepted';
    const res = await fetch(`${baseUrl}/api/registrations/partner-requests/${mockRequestDoc._id}/respond?action=accept&token=valid-secret-token-123`);
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('Request Already ACCEPTED'));
  });

  // Test 6: Action reject declines request and notifies requester
  await test('GET /respond with action=reject declines request and notifies requester', async () => {
    sentMails = [];
    mockRequestDoc.status = 'pending';

    const res = await fetch(`${baseUrl}/api/registrations/partner-requests/${mockRequestDoc._id}/respond?action=reject&token=valid-secret-token-123`);
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('Partner Request Declined'));
    assert.strictEqual(mockRequestDoc.status, 'rejected');

    // Verify requester was notified of rejection
    assert.strictEqual(sentMails.length, 1);
    assert.strictEqual(sentMails[0].to, 'siva@univ.jfn.ac.lk');
    assert.ok(sentMails[0].subject.includes('Partner Request Declined'));
  });

  // Restore
  sportModelsModule.getModelsForSport = originalGetModels;
  server.close();

  console.log('\n======================================================');
  console.log(`🏁 ROUTE INTEGRATION RESULTS: ${passed}/${total} TESTS PASSED`);
  console.log('======================================================\n');

  if (passed !== total) process.exit(1);
};

runRouteIntegrationTests().catch((err) => {
  console.error('Fatal route test error:', err);
  process.exit(1);
});
