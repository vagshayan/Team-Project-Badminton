/**
 * emailTemplates.js
 * -----------------
 * HTML email templates for the University Indoor Games Management System.
 *
 * All templates:
 *  - Use inline CSS (required for email client compatibility).
 *  - Include university branding.
 *  - Only reference data that actually exists in the database.
 *  - Work in dark and light email clients.
 */

'use strict';

// ── Brand constants ───────────────────────────────────────────────────────────
const BRAND_PRIMARY   = '#1a237e';   // Deep indigo — university colour
const BRAND_ACCENT    = '#283593';
const BRAND_HIGHLIGHT = '#e8eaf6';
const BRAND_SUCCESS   = '#2e7d32';
const BRAND_DANGER    = '#b71c1c';
const BRAND_WARNING   = '#e65100';
const BRAND_NEUTRAL   = '#37474f';
const BRAND_BG        = '#f5f5f5';
const BRAND_CARD      = '#ffffff';
const BRAND_BORDER    = '#e0e0e0';

// ── Shared layout wrappers ────────────────────────────────────────────────────

function wrapEmail(headerColor, iconEmoji, headerTitle, bodyContent) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${headerTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND_BG};font-family:'Segoe UI',Arial,sans-serif;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND_BG};padding:32px 16px;">
    <tr>
      <td align="center">
        <!-- Container -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

          <!-- Header -->
          <tr>
            <td style="background-color:${headerColor};padding:32px 40px 24px;text-align:center;">
              <div style="font-size:42px;line-height:1;margin-bottom:12px;">${iconEmoji}</div>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;line-height:1.3;">${headerTitle}</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;letter-spacing:1px;text-transform:uppercase;">University Indoor Games Management System</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:${BRAND_CARD};padding:36px 40px 28px;">
              ${bodyContent}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:${BRAND_HIGHLIGHT};padding:20px 40px;text-align:center;border-top:1px solid ${BRAND_BORDER};">
              <p style="margin:0;color:${BRAND_NEUTRAL};font-size:12px;line-height:1.6;">
                This is an automated notification from the <strong>University Indoor Games Management System</strong>.<br/>
                Please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

function infoRow(label, value) {
  if (!value || value === 'N/A' || value === 'undefined') return '';
  return `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid ${BRAND_BORDER};">
        <span style="color:${BRAND_NEUTRAL};font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">${label}</span>
      </td>
      <td style="padding:8px 0 8px 16px;border-bottom:1px solid ${BRAND_BORDER};">
        <span style="color:#212121;font-size:14px;font-weight:500;">${value}</span>
      </td>
    </tr>`;
}

function infoTable(rows) {
  const rowsHtml = rows.join('');
  if (!rowsHtml.trim()) return '';
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="background-color:${BRAND_HIGHLIGHT};border-radius:8px;padding:0 20px;margin:20px 0;">
    <tbody>${rowsHtml}</tbody>
  </table>`;
}

function statusBadge(text, color) {
  return `<span style="display:inline-block;background-color:${color};color:#fff;padding:3px 12px;border-radius:50px;font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">${text}</span>`;
}

function greeting(playerName) {
  return `<p style="margin:0 0 16px;color:#212121;font-size:16px;">Dear <strong>${escapeHtml(playerName)}</strong>,</p>`;
}

function divider() {
  return `<hr style="border:none;border-top:1px solid ${BRAND_BORDER};margin:24px 0;" />`;
}

function paragraph(text, color) {
  return `<p style="margin:0 0 12px;color:${color || '#212121'};font-size:14px;line-height:1.7;">${text}</p>`;
}

// ── Utility ───────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(date) {
  if (!date) return null;
  try {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return String(date);
  }
}

function formatDateTime(date) {
  if (!date) return null;
  try {
    return new Date(date).toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long',
      day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return String(date);
  }
}

function capitalizeSport(sport) {
  if (!sport) return '';
  const map = { badminton: 'Badminton', 'table-tennis': 'Table Tennis', carrom: 'Carrom' };
  return map[sport.toLowerCase()] || sport;
}

function roundLabel(round) {
  const labels = { 1: 'Round 1', 2: 'Quarter-Finals', 3: 'Semi-Finals', 4: 'Final' };
  return labels[round] || `Round ${round}`;
}

// ── Template 1: Registration Confirmation ────────────────────────────────────

/**
 * @param {object} data
 * @param {string} data.playerName
 * @param {string} data.rollNumber
 * @param {string} data.email
 * @param {string} data.sport          - e.g. 'badminton'
 * @param {string} data.tournamentYear
 * @param {string} data.category
 * @param {string} data.venue
 * @param {string} data.tournamentDate
 * @param {string} data.registeredAt   - ISO date string
 */
function registrationConfirmationTemplate(data) {
  const body = `
    ${greeting(data.playerName)}
    ${paragraph('Your registration for the <strong>University Indoor Games</strong> has been received successfully. Our administrators will review and confirm your registration shortly.')}
    ${divider()}
    <h3 style="margin:0 0 4px;color:${BRAND_PRIMARY};font-size:15px;font-weight:700;">Registration Details</h3>
    ${infoTable([
      infoRow('Registration Number', escapeHtml(data.rollNumber)),
      infoRow('Sport',               capitalizeSport(data.sport)),
      infoRow('Category',            escapeHtml(data.category || '')),
      infoRow('Venue',               escapeHtml(data.venue || '')),
      infoRow('Tournament Date',     formatDate(data.tournamentDate)),
      infoRow('Registered On',       formatDateTime(data.registeredAt || new Date())),
      infoRow('Status',              statusBadge('Pending Review', '#f57c00')),
    ])}
    ${divider()}
    ${data.qrToken ? `
    <div style="text-align:center;margin:24px 0;">
      <a href="${(process.env.FRONTEND_URL || 'http://localhost:3000')}/player/qr/${escapeHtml(data.qrToken)}" style="display:inline-block;background-color:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;font-size:13px;letter-spacing:0.5px;">
        📱 VIEW DIGITAL PLAYER PASS
      </a>
    </div>
    ${divider()}
    ` : ''}
    ${paragraph(`If you have any questions, please contact your sport administrator. Please keep your registration number <strong>${escapeHtml(data.rollNumber)}</strong> safe — you will need it to check your status.`, BRAND_NEUTRAL)}
  `;
  return wrapEmail(BRAND_PRIMARY, '🏆', 'Registration Received – University Indoor Games', body);
}

// ── Template 2: Registration Approval ────────────────────────────────────────

/**
 * @param {object} data
 * @param {string} data.playerName
 * @param {string} data.rollNumber
 * @param {string} data.sport
 * @param {string} data.category
 * @param {string} data.venue
 * @param {string} data.tournamentDate
 * @param {string} data.tournamentTime
 * @param {string} [data.qrToken]
 */
function registrationApprovalTemplate(data) {
  const body = `
    ${greeting(data.playerName)}
    ${paragraph('🎉 <strong>Great news!</strong> Your registration for the University Indoor Games has been <strong>approved</strong>. You are now confirmed to participate in the event.')}
    ${divider()}
    <h3 style="margin:0 0 4px;color:${BRAND_SUCCESS};font-size:15px;font-weight:700;">Confirmation Details</h3>
    ${infoTable([
      infoRow('Registration Number', escapeHtml(data.rollNumber)),
      infoRow('Sport',               capitalizeSport(data.sport)),
      infoRow('Category',            escapeHtml(data.category || '')),
      infoRow('Venue',               escapeHtml(data.venue || '')),
      infoRow('Tournament Date',     formatDate(data.tournamentDate)),
      infoRow('Time',                escapeHtml(data.tournamentTime || '')),
      infoRow('Status',              statusBadge('Confirmed', BRAND_SUCCESS)),
    ])}
    ${divider()}
    ${data.qrToken ? `
    <div style="text-align:center;margin:24px 0;">
      <a href="${(process.env.FRONTEND_URL || 'http://localhost:3000')}/player/qr/${escapeHtml(data.qrToken)}" style="display:inline-block;background-color:${BRAND_SUCCESS};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;font-size:13px;letter-spacing:0.5px;">
        📱 VIEW DIGITAL PLAYER PASS & MATCHES
      </a>
    </div>
    ${divider()}
    ` : ''}
    ${paragraph('Please arrive at the venue on time. The match schedule (draw) will be published by the administrator before the tournament begins. Watch for further email notifications when your matches are scheduled.', BRAND_NEUTRAL)}
  `;
  return wrapEmail(BRAND_SUCCESS, '✅', 'Registration Approved – You Can Participate', body);
}

// ── Template 3: Registration Rejection ───────────────────────────────────────

/**
 * @param {object} data
 * @param {string} data.playerName
 * @param {string} data.rollNumber
 * @param {string} data.sport
 * @param {string} data.category
 */
function registrationRejectionTemplate(data) {
  const body = `
    ${greeting(data.playerName)}
    ${paragraph('We regret to inform you that your registration for the University Indoor Games has been <strong>rejected</strong> by the administrator.')}
    ${divider()}
    <h3 style="margin:0 0 4px;color:${BRAND_DANGER};font-size:15px;font-weight:700;">Registration Details</h3>
    ${infoTable([
      infoRow('Registration Number', escapeHtml(data.rollNumber)),
      infoRow('Sport',               capitalizeSport(data.sport)),
      infoRow('Category',            escapeHtml(data.category || '')),
      infoRow('Status',              statusBadge('Rejected', BRAND_DANGER)),
    ])}
    ${divider()}
    ${paragraph('If you believe this is an error or would like further clarification, please contact your sport administrator directly.', BRAND_NEUTRAL)}
  `;
  return wrapEmail(BRAND_DANGER, '❌', 'Registration Update – University Indoor Games', body);
}

// ── Template 4: Match Scheduled ───────────────────────────────────────────────

/**
 * @param {object} data
 * @param {string} data.playerName       - The recipient's name
 * @param {string} data.sport
 * @param {string} data.category
 * @param {string} data.opponentName     - Opponent player name (null for doubles)
 * @param {number} data.round            - Match round number
 * @param {number} data.matchNumber
 * @param {string} data.venue
 * @param {string} data.tournamentDate
 * @param {string} data.tournamentTime
 */
function matchScheduledTemplate(data) {
  const body = `
    ${greeting(data.playerName)}
    ${paragraph(`Your match for the <strong>${capitalizeSport(data.sport)}</strong> tournament has been scheduled. Please review the details below and mark your calendar.`)}
    ${divider()}
    <h3 style="margin:0 0 4px;color:${BRAND_PRIMARY};font-size:15px;font-weight:700;">Match Details</h3>
    ${infoTable([
      infoRow('Sport',        capitalizeSport(data.sport)),
      infoRow('Category',     escapeHtml(data.category || '')),
      infoRow('Round',        roundLabel(data.round)),
      infoRow('Match Number', `#${data.matchNumber}`),
      infoRow('Opponent',     data.opponentName ? escapeHtml(data.opponentName) : null),
      infoRow('Venue',        escapeHtml(data.venue || '')),
      infoRow('Date',         formatDate(data.tournamentDate)),
      infoRow('Time',         escapeHtml(data.tournamentTime || '')),
    ])}
    ${divider()}
    ${paragraph('Please arrive at the venue <strong>at least 15 minutes before</strong> your scheduled match time. Good luck! 🏅', BRAND_NEUTRAL)}
  `;
  return wrapEmail(BRAND_ACCENT, '🗓️', `Match Scheduled – ${capitalizeSport(data.sport)}`, body);
}

// ── Template 5: Tournament Rescheduled ───────────────────────────────────────

/**
 * @param {object} data
 * @param {string} data.playerName
 * @param {string} data.sport
 * @param {string} data.category
 * @param {string} data.previousDate
 * @param {string} data.previousTime
 * @param {string} data.previousVenue
 * @param {string} data.newDate
 * @param {string} data.newTime
 * @param {string} data.newVenue
 */
function tournamentUpdatedTemplate(data) {
  const body = `
    ${greeting(data.playerName)}
    ${paragraph(`<strong>Important:</strong> The <strong>${capitalizeSport(data.sport)}</strong> tournament schedule has been updated. Please note the changes below.`)}
    ${divider()}
    <h3 style="margin:0 0 8px;color:${BRAND_DANGER};font-size:15px;font-weight:700;">Previous Schedule</h3>
    ${infoTable([
      infoRow('Date',  formatDate(data.previousDate)),
      infoRow('Time',  escapeHtml(data.previousTime || '')),
      infoRow('Venue', escapeHtml(data.previousVenue || '')),
    ])}
    <h3 style="margin:16px 0 8px;color:${BRAND_SUCCESS};font-size:15px;font-weight:700;">Updated Schedule</h3>
    ${infoTable([
      infoRow('Date',  formatDate(data.newDate)),
      infoRow('Time',  escapeHtml(data.newTime || '')),
      infoRow('Venue', escapeHtml(data.newVenue || '')),
      infoRow('Category', escapeHtml(data.category || '')),
    ])}
    ${divider()}
    ${paragraph('Please update your calendar and make the necessary arrangements. We apologise for any inconvenience caused.', BRAND_NEUTRAL)}
  `;
  return wrapEmail(BRAND_WARNING, '🔔', 'Tournament Schedule Updated – Action Required', body);
}

// ── Template 6: Match Result ──────────────────────────────────────────────────

/**
 * @param {object} data
 * @param {string} data.playerName
 * @param {string} data.sport
 * @param {string} data.category
 * @param {number} data.round
 * @param {number} data.matchNumber
 * @param {string} data.winnerName
 * @param {string} data.player1Name
 * @param {string} data.player2Name
 * @param {boolean} data.isRecipientWinner
 */
function matchResultTemplate(data) {
  const outcome      = data.isRecipientWinner ? '🏆 You Won!' : '🏅 Match Completed';
  const outcomeColor = data.isRecipientWinner ? BRAND_SUCCESS : BRAND_NEUTRAL;
  const headerColor  = data.isRecipientWinner ? BRAND_SUCCESS : BRAND_NEUTRAL;

  const body = `
    ${greeting(data.playerName)}
    ${paragraph(`The result for your <strong>${capitalizeSport(data.sport)}</strong> match (${roundLabel(data.round)}) has been recorded.`)}
    ${divider()}
    <h3 style="margin:0 0 4px;color:${BRAND_PRIMARY};font-size:15px;font-weight:700;">Match Result</h3>
    ${infoTable([
      infoRow('Sport',      capitalizeSport(data.sport)),
      infoRow('Category',   escapeHtml(data.category || '')),
      infoRow('Round',      roundLabel(data.round)),
      infoRow('Match',      `#${data.matchNumber}`),
      infoRow('Player 1',   escapeHtml(data.player1Name || '')),
      infoRow('Player 2',   escapeHtml(data.player2Name || '')),
      infoRow('Winner',     escapeHtml(data.winnerName || '')),
      infoRow('Result',     statusBadge(outcome, outcomeColor)),
    ])}
    ${divider()}
    ${data.isRecipientWinner
      ? paragraph('Congratulations on your win! Please check with your administrator for details of your next match.', BRAND_SUCCESS)
      : paragraph('Thank you for participating in the University Indoor Games. Better luck next time!', BRAND_NEUTRAL)
    }
  `;
  return wrapEmail(headerColor, data.isRecipientWinner ? '🏆' : '🏅', `Match Result – ${capitalizeSport(data.sport)}`, body);
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  registrationConfirmationTemplate,
  registrationApprovalTemplate,
  registrationRejectionTemplate,
  matchScheduledTemplate,
  tournamentUpdatedTemplate,
  matchResultTemplate,
  // Utility helpers (also exported for testing)
  escapeHtml,
  formatDate,
  formatDateTime,
  capitalizeSport,
  roundLabel,
};
