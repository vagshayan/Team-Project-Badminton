const nodemailer = require('nodemailer');

const getTransporter = () => {
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Email service is not configured: missing ${missing.join(', ')}`);
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS.replace(/\s+/g, ''),
    },
  });
};

const getBackendUrl = () => process.env.BACKEND_URL || 'http://localhost:5000';

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

module.exports = { sendVerificationEmail, sendPasswordResetOtpEmail, sendSecurityChangeEmail };
