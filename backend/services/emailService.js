/**
 * emailService.js
 * ---------------
 * Core low-level email sender for the University Indoor Games Management System.
 *
 * Design principles (matching the existing auditLogger.js pattern):
 *  - Fire-and-forget: errors are logged, never re-thrown.
 *  - Controlled by EMAIL_ENABLED env var (default: true).
 *  - When EMAIL_TEST_RECIPIENT is set, all mail is redirected to that address.
 *  - Credentials are NEVER logged.
 *  - Lazy transport creation: validated on first send, not at server startup.
 */

'use strict';

const nodemailer = require('nodemailer');
const dns = require('dns');

// Force IPv4 first for all DNS lookups to avoid ENETUNREACH on IPv6-disabled networks
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

// ── Internal state ────────────────────────────────────────────────────────────
let _transporter = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true if email sending is enabled.
 * Defaults to true unless EMAIL_ENABLED is explicitly 'false'.
 */
function isEmailEnabled() {
  const val = (process.env.EMAIL_ENABLED || 'true').toLowerCase().trim();
  return val !== 'false';
}

/**
 * Validates that all required SMTP env vars are present.
 * Returns null when valid, or an error message string when invalid.
 */
function validateConfig() {
  const required = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASSWORD', 'EMAIL_FROM'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    return `Missing required email environment variables: ${missing.join(', ')}`;
  }
  return null;
}

/**
 * Lazily creates and caches the nodemailer transporter.
 * Returns null (with a console error) if config is invalid.
 */
function getTransporter() {
  if (_transporter) return _transporter;

  const configError = validateConfig();
  if (configError) {
    console.error(`[EmailService] ⚠️  ${configError}`);
    return null;
  }

  _transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT, 10),
    secure: (process.env.EMAIL_SECURE || 'false').toLowerCase() === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    // Force IPv4 DNS resolution — prevents ENETUNREACH on networks without IPv6
    dnsLookup: (hostname, options, callback) => {
      dns.lookup(hostname, { ...options, family: 4 }, callback);
    },
    // Graceful timeout — do not hang the server
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
  });

  return _transporter;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Sends an email.
 *
 * @param {object} options
 * @param {string|string[]} options.to        - Recipient email address(es).
 * @param {string}          options.subject   - Email subject.
 * @param {string}          options.html      - HTML body.
 * @param {string}          [options.text]    - Optional plain-text fallback.
 * @returns {Promise<{ sent: boolean, messageId?: string }>}
 */
async function sendEmail({ to, subject, html, text }) {
  // ── Guard: disabled ──────────────────────────────────────────────────────
  if (!isEmailEnabled()) {
    const safeRecipient = Array.isArray(to) ? to.join(', ') : to;
    console.log(
      `[EmailService] 📵 Email disabled (EMAIL_ENABLED=false). Would have sent to: ${safeRecipient} | Subject: "${subject}"`
    );
    return { sent: false, reason: 'EMAIL_DISABLED' };
  }

  // ── Guard: missing config ────────────────────────────────────────────────
  const transporter = getTransporter();
  if (!transporter) {
    return { sent: false, reason: 'INVALID_CONFIG' };
  }

  // ── Test recipient redirect ──────────────────────────────────────────────
  let actualRecipient = to;
  const testRecipient = (process.env.EMAIL_TEST_RECIPIENT || '').trim();
  if (testRecipient) {
    const original = Array.isArray(to) ? to.join(', ') : to;
    console.log(
      `[EmailService] 🧪 Test mode: redirecting email from "${original}" → "${testRecipient}"`
    );
    actualRecipient = testRecipient;
  }

  // ── Validate recipient ───────────────────────────────────────────────────
  if (!actualRecipient || (Array.isArray(actualRecipient) && actualRecipient.length === 0)) {
    console.error('[EmailService] ❌ No valid recipient address. Skipping send.');
    return { sent: false, reason: 'NO_RECIPIENT' };
  }

  // ── Send ─────────────────────────────────────────────────────────────────
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: actualRecipient,
      subject,
      html,
      text: text || stripHtml(html),
    });
    console.log(`[EmailService] ✅ Email sent | Subject: "${subject}" | MessageId: ${info.messageId}`);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    // Log the error type/message but NEVER the credentials
    console.error(`[EmailService] ❌ Failed to send email | Subject: "${subject}" | Error: ${err.message}`);
    return { sent: false, reason: 'SMTP_ERROR', error: err.message };
  }
}

/**
 * Strips HTML tags to produce a simple plain-text fallback.
 * Used when no explicit `text` option is provided.
 */
function stripHtml(html) {
  return (html || '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Logs email configuration status (call at startup for visibility).
 * Never logs actual credentials.
 */
function logEmailConfigStatus() {
  if (!isEmailEnabled()) {
    console.log('[EmailService] 📵 Email notifications are DISABLED (EMAIL_ENABLED=false)');
    return;
  }
  const configError = validateConfig();
  if (configError) {
    console.warn(`[EmailService] ⚠️  Email config incomplete — notifications will be skipped. ${configError}`);
  } else {
    const host = process.env.EMAIL_HOST;
    const port = process.env.EMAIL_PORT;
    const user = process.env.EMAIL_USER;
    const testMode = process.env.EMAIL_TEST_RECIPIENT ? ` | Test recipient: ${process.env.EMAIL_TEST_RECIPIENT}` : '';
    console.log(`[EmailService] ✅ Email configured | Host: ${host}:${port} | User: ${user}${testMode}`);
  }
}

/**
 * Resets the cached transporter (for testing purposes only).
 */
function _resetTransporter() {
  _transporter = null;
}

module.exports = {
  sendEmail,
  isEmailEnabled,
  validateConfig,
  logEmailConfigStatus,
  _resetTransporter, // exported for tests only
};
