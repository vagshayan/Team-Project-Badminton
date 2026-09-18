/**
 * test_email.js
 * Run from the backend folder: node test_email.js
 *
 * 1. Logs in with your admin credentials
 * 2. Uses the token to trigger each email notification type
 * 3. Prints results to the console
 *
 * Edit ADMIN_USERNAME and ADMIN_PASSWORD below before running.
 */

const http = require('http');

const BASE = { host: 'localhost', port: 5000 };

// ── EDIT THESE ────────────────────────────────────────────────────────────────
const ADMIN_USERNAME = 'your_admin_username';
const ADMIN_PASSWORD = 'your_admin_password';
// ─────────────────────────────────────────────────────────────────────────────

function request(options, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const req = http.request(
      {
        ...BASE,
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...(options.headers || {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function run() {
  console.log('\n🔐 Step 1: Logging in as admin...');
  const loginRes = await request(
    { path: '/api/auth/login', method: 'POST' },
    { username: ADMIN_USERNAME, password: ADMIN_PASSWORD }
  );

  if (loginRes.status !== 200 || !loginRes.body.token) {
    console.error('❌ Login failed:', loginRes.body);
    console.error('   → Check ADMIN_USERNAME and ADMIN_PASSWORD in this file.');
    process.exit(1);
  }

  const token = loginRes.body.token;
  console.log('✅ Login successful. Token received.\n');

  const authHeader = { Authorization: `Bearer ${token}` };

  const tests = [
    { name: 'Registration Confirmation', path: '/api/dev/email-test/registration' },
    { name: 'Registration Approval',     path: '/api/dev/email-test/approval'     },
    { name: 'Registration Rejection',    path: '/api/dev/email-test/rejection'    },
    { name: 'Match Scheduled',           path: '/api/dev/email-test/match-scheduled' },
    { name: 'Tournament Updated',        path: '/api/dev/email-test/tournament-updated' },
  ];

  console.log('📧 Step 2: Triggering email tests...\n');

  for (const t of tests) {
    try {
      const res = await request({ path: t.path, method: 'POST', headers: authHeader }, {});
      if (res.status === 200 && res.body.success) {
        console.log(`  ✅ ${t.name}`);
      } else {
        console.log(`  ❌ ${t.name} — Status ${res.status}:`, res.body);
      }
    } catch (err) {
      console.log(`  ❌ ${t.name} — Error: ${err.message}`);
    }
  }

  console.log('\n📋 Step 3: Checking email config status...');
  const statusRes = await request({ path: '/api/dev/email-test/status', method: 'GET', headers: authHeader });
  console.log('   Config status:', JSON.stringify(statusRes.body, null, 2));

  console.log('\n✅ Done! Check your server console for [EmailService] lines and your inbox.\n');
}

run().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
