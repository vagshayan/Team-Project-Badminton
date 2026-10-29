const nodemailer = require('nodemailer');
const {
  renderRegistrationConfirmationEmail,
  renderScheduleUpdateEmail,
  renderPartnerSelectionEmail,
  renderPartnershipStatusEmail,
  renderRegistrationCancellationEmail,
  renderDrawPublishedEmail,
  renderRegistrationApprovedEmail,
  renderRegistrationRejectedEmail,
} = require('./emailTemplates');

let cachedTransporter = null;
let mockTransporter = null;

/**
 * Check if string is a valid email format
 */
const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed);
};

/**
 * For testing and local test scripts: set or clear a mock transport
 */
const setMockTransporter = (transporter) => {
  mockTransporter = transporter;
};

/**
 * Check if SMTP configuration exists in environment
 */
const isSmtpConfigured = () => {
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  return required.every((name) => Boolean(process.env[name] && String(process.env[name]).trim()));
};

/**
 * Standard transporter getter (throws if missing, preserving original behavior)
 */
const getTransporter = () => {
  if (mockTransporter) return mockTransporter;

  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Email service is not configured: missing ${missing.join(', ')}`);
  }

  if (cachedTransporter) return cachedTransporter;

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST.trim(),
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER.trim(),
      pass: process.env.SMTP_PASS.replace(/\s+/g, ''),
    },
    tls: {
      rejectUnauthorized: process.env.SMTP_IGNORE_TLS === 'true' ? false : true,
    },
  });

  return cachedTransporter;
};

const getBackendUrl = () => process.env.BACKEND_URL || 'http://localhost:5000';
const getFrontendUrl = () => process.env.FRONTEND_URL || process.env.CLIENT_ORIGIN || 'http://localhost:3000';

const getFromAddress = () => {
  if (process.env.SMTP_FROM && process.env.SMTP_FROM.trim()) {
    return process.env.SMTP_FROM.trim();
  }
  if (process.env.SMTP_USER && process.env.SMTP_USER.trim()) {
    return `"University of Jaffna Sports" <${process.env.SMTP_USER.trim()}>`;
  }
  return '"University of Jaffna Sports" <no-reply@univ.jfn.ac.lk>';
};

/**
 * Send an email safely with proper validation, logging, and error handling.
 * Never leaks credentials or passwords in error logs.
 */
const sendSafeMail = async ({ to, subject, html, text }) => {
  const cleanTo = String(to || '').trim();
  if (!isValidEmail(cleanTo)) {
    console.warn(`[EmailService] ⚠️ Invalid recipient email format: "${cleanTo}". Email sending skipped.`);
    return { success: false, error: 'Invalid recipient email format' };
  }

  if (mockTransporter) {
    try {
      const info = await mockTransporter.sendMail({
        from: getFromAddress(),
        to: cleanTo,
        subject,
        html,
        text,
      });
      console.log(`[EmailService] [MOCK] ✅ Email sent to ${cleanTo}: "${subject}" (ID: ${info?.messageId || 'mock-id'})`);
      return { success: true, messageId: info?.messageId || 'mock-id' };
    } catch (err) {
      console.error(`[EmailService] [MOCK] ❌ Failed to send email to ${cleanTo}: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  if (!isSmtpConfigured()) {
    console.warn(`[EmailService] ⚠️ SMTP credentials not fully configured in backend/.env. Skipped sending email to: ${cleanTo} ("${subject}")`);
    return { success: false, error: 'SMTP credentials not configured', skipped: true };
  }

  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: getFromAddress(),
      to: cleanTo,
      subject,
      html,
      text,
    });
    console.log(`[EmailService] ✅ Email successfully sent to ${cleanTo}: "${subject}" (Message ID: ${info.messageId})`);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[EmailService] 🔗 View rendered email in browser: ${previewUrl}`);
    }
    return { success: true, messageId: info.messageId, previewUrl };
  } catch (err) {
    console.error(`[EmailService] ❌ Failed to send email to ${cleanTo}: ${err.message}`);
    return { success: false, error: err.message };
  }
};

/* ==========================================================================
   EXISTING ADMIN AUTH EMAIL FUNCTIONS (Retained for 100% backward compatibility)
   ========================================================================== */

const sendVerificationEmail = async (email, token) => {
  const verificationUrl = `${getBackendUrl()}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  const transporter = getTransporter();

  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: email,
    subject: 'Verify your UoJ Sports admin account',
    text: `Verify your account by opening this link: ${verificationUrl}\n\nThis link expires in 15 minutes.`,
    html: `<p>Verify your UoJ Sports admin account by selecting the link below.</p><p><a href="${verificationUrl}">Verify email address</a></p><p>This link expires in 15 minutes.</p>`,
  });
};

const sendPasswordResetOtpEmail = async (email, otp) => {
  await getTransporter().sendMail({
    from: process.env.SMTP_USER,
    to: email,
    subject: 'Your UoJ Sports password reset code',
    text: `Your password reset verification code is ${otp}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
    html: `<p>Your UoJ Sports password reset verification code is:</p><p style="font-size:24px;font-weight:700;letter-spacing:6px">${otp}</p><p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>`,
  });
};

const sendSecurityChangeEmail = async ({ email, username, changeType }) => {
  if (!email) return;
  const changedAt = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  const subject = `${changeType} changed for your UoJ Sports admin account`;
  const text = [
    `${changeType} changed`,
    '',
    `Your ${changeType.toLowerCase()} was changed for admin account ${username || 'your account'} on ${changedAt}.`,
    '',
    'If you did not make this change, contact your system administrator immediately.',
  ].join('\n');

  await getTransporter().sendMail({
    from: process.env.SMTP_USER,
    to: email,
    subject,
    text,
    html: `<p>Your <strong>${changeType.toLowerCase()}</strong> was changed for admin account <strong>${username || 'your account'}</strong> on ${changedAt}.</p><p>If you did not make this change, contact your system administrator immediately.</p>`,
  });
};

/* ==========================================================================
   NEW TOURNAMENT NOTIFICATION FUNCTIONS
   ========================================================================== */

/**
 * 1. Send registration confirmation email to the participant
 */
const sendRegistrationConfirmationEmail = async ({
  email,
  playerName,
  rollNumber,
  nicNo,
  department,
  sport,
  category,
  partnerName,
  partnerRollNumber,
  status = 'pending',
  tournamentDate,
  tournamentTime,
  venue,
}) => {
  if (!email) return { success: false, error: 'No recipient email provided' };

  const portalUrl = `${getFrontendUrl()}/${sport.toLowerCase()}`;
  const template = renderRegistrationConfirmationEmail({
    playerName,
    rollNumber,
    nicNo,
    department,
    sport,
    category,
    partnerName,
    partnerRollNumber,
    status,
    tournamentDate,
    tournamentTime,
    venue,
    portalUrl,
  });

  return await sendSafeMail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
};

/**
 * 2. Send schedule update email to a single participant
 */
const sendScheduleUpdateEmail = async ({
  email,
  playerName,
  sport,
  category,
  changes = [],
  currentSchedule = {},
}) => {
  if (!email) return { success: false, error: 'No recipient email provided' };

  const portalUrl = `${getFrontendUrl()}/${sport.toLowerCase()}`;
  const template = renderScheduleUpdateEmail({
    playerName,
    sport,
    category,
    changes,
    currentSchedule,
    portalUrl,
  });

  return await sendSafeMail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
};

/**
 * Send schedule update notification to a list of registered participants.
 * Automatically deduplicates emails and validates addresses.
 */
const sendScheduleUpdateBatchEmail = async ({
  participants = [],
  sport,
  category,
  changes = [],
  currentSchedule = {},
}) => {
  if (!Array.isArray(participants) || participants.length === 0) {
    return { sentCount: 0, failedCount: 0, total: 0 };
  }

  const seenEmails = new Set();
  const validParticipants = [];

  for (const p of participants) {
    const email = String(p.email || '').trim().toLowerCase();
    if (email && isValidEmail(email) && !seenEmails.has(email)) {
      seenEmails.add(email);
      validParticipants.push({
        email,
        playerName: p.playerName || 'Participant',
      });
    }
  }

  if (validParticipants.length === 0) {
    console.log(`[EmailService] No valid participant emails found for ${sport} schedule update.`);
    return { sentCount: 0, failedCount: 0, total: 0 };
  }

  console.log(`[EmailService] 📢 Sending schedule update notifications to ${validParticipants.length} participants for ${sport} (${category})...`);

  let sentCount = 0;
  let failedCount = 0;

  for (const participant of validParticipants) {
    try {
      const res = await sendScheduleUpdateEmail({
        email: participant.email,
        playerName: participant.playerName,
        sport,
        category,
        changes,
        currentSchedule,
      });

      if (res.success) {
        sentCount++;
      } else {
        failedCount++;
      }
    } catch (err) {
      console.error(`[EmailService] Error dispatching update to ${participant.email}: ${err.message}`);
      failedCount++;
    }
  }

  console.log(`[EmailService] 📢 Schedule update broadcast complete: ${sentCount} sent, ${failedCount} failed.`);
  return { sentCount, failedCount, total: validParticipants.length };
};

/**
 * 3. Send partner request / invitation email
 */
const sendPartnerSelectionEmail = async ({
  partnerEmail,
  partnerName,
  partnerRollNumber,
  requesterName,
  requesterRollNumber,
  sport,
  category,
  tournamentDate,
  venue,
  requestId,
  confirmationToken,
}) => {
  if (!partnerEmail) return { success: false, error: 'No partner email provided' };

  let acceptUrl = '';
  let rejectUrl = '';

  if (requestId && confirmationToken) {
    const backendUrl = getBackendUrl();
    acceptUrl = `${backendUrl}/api/registrations/partner-requests/${requestId}/respond?action=accept&token=${encodeURIComponent(confirmationToken)}`;
    rejectUrl = `${backendUrl}/api/registrations/partner-requests/${requestId}/respond?action=reject&token=${encodeURIComponent(confirmationToken)}`;
  }

  const portalUrl = `${getFrontendUrl()}/${sport.toLowerCase()}`;
  const template = renderPartnerSelectionEmail({
    partnerName,
    partnerRollNumber,
    requesterName,
    requesterRollNumber,
    sport,
    category,
    tournamentDate,
    venue,
    acceptUrl,
    rejectUrl,
    portalUrl,
  });

  return await sendSafeMail({
    to: partnerEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
};

/**
 * 4. Send partnership confirmation email to both participants
 */
const sendPartnershipConfirmedEmail = async ({
  requesterEmail,
  requesterName,
  targetEmail,
  targetName,
  sport,
  category,
}) => {
  const portalUrl = `${getFrontendUrl()}/${sport.toLowerCase()}`;
  const results = [];

  if (requesterEmail) {
    const t1 = renderPartnershipStatusEmail({
      recipientName: requesterName,
      partnerName: targetName,
      requesterName,
      sport,
      category,
      status: 'confirmed',
      portalUrl,
    });
    const res1 = await sendSafeMail({
      to: requesterEmail,
      subject: t1.subject,
      html: t1.html,
      text: t1.text,
    });
    results.push(res1);
  }

  if (targetEmail && targetEmail.toLowerCase() !== (requesterEmail || '').toLowerCase()) {
    const t2 = renderPartnershipStatusEmail({
      recipientName: targetName,
      partnerName: requesterName,
      requesterName,
      sport,
      category,
      status: 'confirmed',
      portalUrl,
    });
    const res2 = await sendSafeMail({
      to: targetEmail,
      subject: t2.subject,
      html: t2.html,
      text: t2.text,
    });
    results.push(res2);
  }

  return { success: results.some((r) => r.success), results };
};

/**
 * Send partner request rejection email to requester
 */
const sendPartnershipRejectedEmail = async ({
  requesterEmail,
  requesterName,
  targetName,
  sport,
  category,
}) => {
  if (!requesterEmail) return { success: false, error: 'No requester email provided' };

  const portalUrl = `${getFrontendUrl()}/${sport.toLowerCase()}`;
  const template = renderPartnershipStatusEmail({
    recipientName: requesterName,
    partnerName: targetName,
    requesterName,
    sport,
    category,
    status: 'rejected',
    portalUrl,
  });

  return await sendSafeMail({
    to: requesterEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
};

/**
 * 5. Send registration cancellation email
 */
const sendRegistrationCancellationEmail = async ({
  email,
  playerName,
  rollNumber,
  sport,
  category,
  reason = '',
}) => {
  if (!email) return { success: false, error: 'No recipient email provided' };

  const portalUrl = `${getFrontendUrl()}/${sport.toLowerCase()}`;
  const template = renderRegistrationCancellationEmail({
    playerName,
    rollNumber,
    sport,
    category,
    reason,
    portalUrl,
  });

  return await sendSafeMail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
};

/**
 * 6. Send official tournament draw published notification
 */
const sendDrawPublishedEmail = async ({
  email,
  playerName,
  sport,
  category,
  tournamentDate,
  venue,
}) => {
  if (!email) return { success: false, error: 'No recipient email provided' };

  const portalUrl = `${getFrontendUrl()}/brackets`;
  const template = renderDrawPublishedEmail({
    playerName,
    sport,
    category,
    tournamentDate,
    venue,
    portalUrl,
  });

  return await sendSafeMail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
};

/**
 * 7. Send registration approved email to the participant
 */
const sendRegistrationApprovedEmail = async ({
  email,
  playerName,
  rollNumber,
  sport,
  category,
  partnerName,
  partnerRollNumber,
  tournamentDate,
  tournamentTime,
  venue,
}) => {
  if (!email) return { success: false, error: 'No recipient email provided' };

  const portalUrl = `${getFrontendUrl()}/${sport.toLowerCase()}`;
  const template = renderRegistrationApprovedEmail({
    playerName,
    rollNumber,
    sport,
    category,
    partnerName,
    partnerRollNumber,
    tournamentDate,
    tournamentTime,
    venue,
    portalUrl,
  });

  return await sendSafeMail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
};

/**
 * 8. Send registration rejected email to the participant
 */
const sendRegistrationRejectedEmail = async ({
  email,
  playerName,
  rollNumber,
  sport,
  category,
  partnerName,
  partnerRollNumber,
  reason = '',
}) => {
  if (!email) return { success: false, error: 'No recipient email provided' };

  const portalUrl = `${getFrontendUrl()}/${sport.toLowerCase()}`;
  const template = renderRegistrationRejectedEmail({
    playerName,
    rollNumber,
    sport,
    category,
    partnerName,
    partnerRollNumber,
    reason,
    portalUrl,
  });

  return await sendSafeMail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
};

module.exports = {
  isValidEmail,
  isSmtpConfigured,
  getTransporter,
  setMockTransporter,
  sendSafeMail,
  // Existing auth emails
  sendVerificationEmail,
  sendPasswordResetOtpEmail,
  sendSecurityChangeEmail,
  // Tournament notification emails
  sendRegistrationConfirmationEmail,
  sendRegistrationApprovedEmail,
  sendRegistrationRejectedEmail,
  sendScheduleUpdateEmail,
  sendScheduleUpdateBatchEmail,
  sendPartnerSelectionEmail,
  sendPartnershipConfirmedEmail,
  sendPartnershipRejectedEmail,
  sendRegistrationCancellationEmail,
  sendDrawPublishedEmail,
};
