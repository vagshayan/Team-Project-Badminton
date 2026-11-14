/**
 * Email Templates for University of Jaffna Sports Tournament Management System
 * Provides responsive, university-branded HTML and plain-text email templates.
 */

const CATEGORY_NAMES = {
  'singles-men': "Men's Singles",
  'singles-women': "Women's Singles",
  'doubles-men': "Men's Doubles",
  'doubles-women': "Women's Doubles",
  'mixed-doubles': 'Mixed Doubles',
};

const SPORT_NAMES = {
  badminton: 'Badminton',
  'table-tennis': 'Table Tennis',
  carrom: 'Carrom',
};

const SPORT_COLORS = {
  badminton: { primary: '#1E40AF', accent: '#3B82F6', icon: '🏸' },
  'table-tennis': { primary: '#065F46', accent: '#10B981', icon: '🏓' },
  carrom: { primary: '#92400E', accent: '#F59E0B', icon: '🎯' },
  default: { primary: '#0F172A', accent: '#F59E0B', icon: '🏆' },
};

const getSportTheme = (sport = '') => {
  const key = String(sport).toLowerCase().trim();
  return SPORT_COLORS[key] || SPORT_COLORS.default;
};

const formatCategory = (cat = '') => {
  return CATEGORY_NAMES[cat] || cat.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const formatSport = (sport = '') => {
  return SPORT_NAMES[sport.toLowerCase()] || sport.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'TBD';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Universal email wrapper providing university branding, responsive design,
 * accessibility, and clean typography across all email clients.
 */
const wrapEmailLayout = ({ preheader = '', title = '', bodyHtml = '', sport = '' }) => {
  const theme = getSportTheme(sport);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    body {
      margin: 0 !important;
      padding: 0 !important;
      background-color: #F1F5F9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1E293B;
      line-height: 1.6;
    }
    img {
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    table {
      border-collapse: collapse !important;
    }
    .email-container {
      max-width: 620px;
      margin: 24px auto;
      background-color: #FFFFFF;
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid #E2E8F0;
      box-shadow: 0 4px 18px rgba(15, 23, 42, 0.06);
    }
    .header-banner {
      background: linear-gradient(135deg, #0B2545 0%, #132A4F 60%, ${theme.primary} 100%);
      padding: 32px 28px 24px 28px;
      text-align: center;
      border-bottom: 4px solid #F59E0B;
    }
    .univ-tag {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 2.5px;
      color: #F59E0B;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .header-title {
      font-size: 22px;
      font-weight: 800;
      color: #FFFFFF;
      letter-spacing: -0.5px;
      margin: 0;
    }
    .header-subtitle {
      font-size: 13px;
      color: #CBD5E1;
      margin-top: 4px;
      font-weight: 500;
    }
    .content-body {
      padding: 32px 30px;
    }
    .greeting {
      font-size: 17px;
      font-weight: 700;
      color: #0F172A;
      margin-top: 0;
      margin-bottom: 12px;
    }
    .badge-card {
      background-color: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      padding: 16px 20px;
      margin: 20px 0;
    }
    .detail-table {
      width: 100%;
      margin: 16px 0;
    }
    .detail-table td {
      padding: 8px 10px;
      font-size: 14px;
      vertical-align: top;
    }
    .detail-label {
      color: #64748B;
      font-weight: 600;
      width: 40%;
    }
    .detail-value {
      color: #0F172A;
      font-weight: 700;
      width: 60%;
    }
    .diff-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin: 18px 0;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #E2E8F0;
    }
    .diff-table th {
      background-color: #0F172A;
      color: #FFFFFF;
      padding: 10px 12px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      text-align: left;
    }
    .diff-table td {
      padding: 12px;
      font-size: 13px;
      border-top: 1px solid #E2E8F0;
    }
    .old-value {
      color: #94A3B8;
      text-decoration: line-through;
      font-weight: 500;
    }
    .new-value {
      color: #059669;
      font-weight: 800;
      background-color: #ECFDF5;
      padding: 2px 6px;
      border-radius: 4px;
      display: inline-block;
    }
    .btn {
      display: inline-block;
      font-weight: 700;
      font-size: 14px;
      line-height: 1;
      text-decoration: none;
      padding: 14px 26px;
      border-radius: 8px;
      margin: 6px 4px;
      text-align: center;
    }
    .btn-primary {
      background-color: #059669;
      color: #FFFFFF !important;
      border: 1px solid #047857;
    }
    .btn-danger {
      background-color: #DC2626;
      color: #FFFFFF !important;
      border: 1px solid #B91C1C;
    }
    .btn-secondary {
      background-color: #0F172A;
      color: #FFFFFF !important;
    }
    .notice-box {
      border-left: 4px solid #F59E0B;
      background-color: #FFFBEB;
      padding: 12px 16px;
      margin: 20px 0;
      border-radius: 4px;
      font-size: 13px;
      color: #92400E;
    }
    .footer {
      background-color: #F8FAFC;
      border-top: 1px solid #E2E8F0;
      padding: 22px 28px;
      text-align: center;
      font-size: 12px;
      color: #64748B;
    }
    @media only screen and (max-width: 620px) {
      .email-container {
        margin: 0 !important;
        border-radius: 0 !important;
        border: none !important;
      }
      .content-body {
        padding: 20px 16px !important;
      }
      .detail-table td {
        display: block !important;
        width: 100% !important;
        padding: 4px 0 !important;
      }
      .detail-label {
        color: #94A3B8 !important;
        font-size: 12px !important;
      }
      .detail-value {
        margin-bottom: 8px !important;
      }
    }
  </style>
</head>
<body>
  <div style="display:none;font-size:1px;color:#333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${preheader}
  </div>
  <div class="email-container">
    <div class="header-banner">
      <div class="univ-tag">University of Jaffna • Physical Education</div>
      <h1 class="header-title">${theme.icon} Tournament Management System</h1>
      <div class="header-subtitle">Official Sports Notification Portal</div>
    </div>
    <div class="content-body">
      ${bodyHtml}
    </div>
    <div class="footer">
      <p style="margin: 0 0 6px 0; font-weight: 700; color: #334155;">University of Jaffna — Department of Physical Education</p>
      <p style="margin: 0 0 8px 0;">Thirunelvely, Jaffna, Sri Lanka | Official Tournament Management System</p>
      <p style="margin: 0; font-size: 11px; color: #94A3B8;">This is an automated administrative notification. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>`;
};

/**
 * 1. REGISTRATION CONFIRMATION EMAIL TEMPLATE
 */
const renderRegistrationConfirmationEmail = ({
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
  portalUrl,
}) => {
  const sportName = formatSport(sport);
  const catName = formatCategory(category);
  const isDoubles = Boolean(partnerRollNumber || partnerName);
  const subject = `Registration Confirmed: ${sportName} (${catName}) - UoJ Sports`;
  const preheader = `Your registration for ${sportName} (${catName}) has been successfully submitted and saved.`;

  const statusLabel = status === 'confirmed' ? 'Verified & Confirmed' : status === 'pending' ? 'Pending Verification' : status;
  const statusColor = status === 'confirmed' ? '#059669' : '#D97706';

  const bodyHtml = `
    <h2 class="greeting">Dear ${playerName},</h2>
    <p>Your registration for the upcoming <strong>University of Jaffna ${sportName} Tournament</strong> has been successfully received and recorded in our official database.</p>

    <div class="badge-card">
      <div style="font-size: 12px; font-weight: 800; color: #64748B; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px;">Registration Overview</div>
      <table class="detail-table">
        <tr>
          <td class="detail-label">Participant Name:</td>
          <td class="detail-value">${playerName}</td>
        </tr>
        <tr>
          <td class="detail-label">Registration No:</td>
          <td class="detail-value">${rollNumber}</td>
        </tr>
        <tr>
          <td class="detail-label">Department / Faculty:</td>
          <td class="detail-value">${department || 'N/A'}</td>
        </tr>
        <tr>
          <td class="detail-label">Sport / Tournament:</td>
          <td class="detail-value">${sportName}</td>
        </tr>
        <tr>
          <td class="detail-label">Event Category:</td>
          <td class="detail-value">${catName}</td>
        </tr>
        ${isDoubles ? `
        <tr>
          <td class="detail-label">Assigned Partner:</td>
          <td class="detail-value">${partnerName || 'Pending'} (${partnerRollNumber || 'N/A'})</td>
        </tr>
        ` : ''}
        <tr>
          <td class="detail-label">Registration Status:</td>
          <td class="detail-value" style="color: ${statusColor}; font-weight: 800;">${statusLabel}</td>
        </tr>
      </table>
    </div>

    <div style="background-color: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 10px; padding: 16px 20px; margin: 20px 0;">
      <div style="font-size: 13px; font-weight: 800; color: #1E40AF; margin-bottom: 8px;">📅 Scheduled Event Details</div>
      <table class="detail-table" style="margin: 0;">
        <tr>
          <td class="detail-label" style="color: #1E3A8A;">Event Date:</td>
          <td class="detail-value" style="color: #1E3A8A;">${formatDate(tournamentDate)}</td>
        </tr>
        <tr>
          <td class="detail-label" style="color: #1E3A8A;">Start Time:</td>
          <td class="detail-value" style="color: #1E3A8A;">${tournamentTime || 'To be announced'}</td>
        </tr>
        <tr>
          <td class="detail-label" style="color: #1E3A8A;">Venue:</td>
          <td class="detail-value" style="color: #1E3A8A;">${venue || 'University Gymnasium'}</td>
        </tr>
      </table>
    </div>

    <div class="notice-box">
      <strong>Important Guidelines:</strong> Please report to the venue at least 30 minutes before your scheduled match with your official University Student Identity Card. Proper athletic attire and non-marking indoor sports shoes are required.
    </div>

    ${portalUrl ? `
    <div style="text-align: center; margin: 28px 0 10px 0;">
      <a href="${portalUrl}" class="btn btn-secondary">Open Tournament Portal</a>
    </div>
    ` : ''}
  `;

  const text = `
UNIVERSITY OF JAFFNA - SPORTS TOURNAMENT MANAGEMENT SYSTEM
REGISTRATION CONFIRMATION

Dear ${playerName},

Your registration for the University of Jaffna ${sportName} Tournament has been successfully submitted and saved.

REGISTRATION DETAILS:
- Participant Name: ${playerName}
- Registration Number: ${rollNumber}
- Department: ${department || 'N/A'}
- Sport: ${sportName}
- Category: ${catName}
${isDoubles ? `- Partner: ${partnerName || 'Pending'} (${partnerRollNumber || 'N/A'})\n` : ''}- Status: ${statusLabel}

EVENT SCHEDULE:
- Date: ${formatDate(tournamentDate)}
- Time: ${tournamentTime || 'TBD'}
- Venue: ${venue || 'University Gymnasium'}

Please bring your University Student ID card to the venue.

Regards,
Department of Physical Education
University of Jaffna
`.trim();

  return {
    subject,
    html: wrapEmailLayout({ preheader, title: subject, bodyHtml, sport }),
    text,
  };
};

/**
 * 2. SPORTS SCHEDULE UPDATE NOTIFICATION TEMPLATE
 */
const renderScheduleUpdateEmail = ({
  playerName,
  sport,
  category,
  changes = [],
  currentSchedule = {},
  portalUrl,
}) => {
  const sportName = formatSport(sport);
  const catName = formatCategory(category);
  const subject = `Schedule Update Notice: ${sportName} (${catName}) - UoJ Sports`;
  const preheader = `Important schedule updates have been made for ${sportName} (${catName}). Please review your revised timings and venue.`;

  const changesRows = changes.map((change) => `
    <tr>
      <td style="font-weight: 700; color: #0F172A;">${change.field}</td>
      <td class="old-value">${change.previous || 'Not specified'}</td>
      <td><span class="new-value">${change.updated || 'Not specified'}</span></td>
    </tr>
  `).join('');

  const bodyHtml = `
    <h2 class="greeting">Dear ${playerName || 'Participant'},</h2>
    <p>Please be advised that the Tournament Organizing Committee has officially updated the schedule and event parameters for <strong>${sportName} — ${catName}</strong>.</p>

    <div style="background-color: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 12px 16px; margin: 18px 0; color: #991B1B; font-size: 13px; font-weight: 700;">
      ⚠️ Please review the highlighted modifications below. Only affected participants are notified.
    </div>

    <div style="margin: 20px 0;">
      <div style="font-size: 13px; font-weight: 800; color: #0F172A; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Summary of Schedule Modifications</div>
      <table class="diff-table">
        <thead>
          <tr>
            <th>Event Detail</th>
            <th>Previous Details</th>
            <th>Updated Details</th>
          </tr>
        </thead>
        <tbody>
          ${changesRows.length > 0 ? changesRows : `
            <tr>
              <td colspan="3" style="text-align: center; color: #64748B;">Schedule parameters have been refreshed.</td>
            </tr>
          `}
        </tbody>
      </table>
    </div>

    <div class="badge-card">
      <div style="font-size: 12px; font-weight: 800; color: #64748B; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px;">Complete Current Schedule</div>
      <table class="detail-table">
        <tr>
          <td class="detail-label">Sport / Event:</td>
          <td class="detail-value">${sportName} (${catName})</td>
        </tr>
        <tr>
          <td class="detail-label">Confirmed Date:</td>
          <td class="detail-value" style="color: #059669; font-weight: 800;">${formatDate(currentSchedule.date)}</td>
        </tr>
        <tr>
          <td class="detail-label">Start Time:</td>
          <td class="detail-value" style="color: #059669; font-weight: 800;">${currentSchedule.time || 'TBD'}</td>
        </tr>
        <tr>
          <td class="detail-label">Tournament Venue:</td>
          <td class="detail-value" style="color: #059669; font-weight: 800;">${currentSchedule.venue || 'TBD'}</td>
        </tr>
        ${currentSchedule.registrationDeadline ? `
        <tr>
          <td class="detail-label">Registration Deadline:</td>
          <td class="detail-value">${formatDate(currentSchedule.registrationDeadline)}</td>
        </tr>
        ` : ''}
      </table>
    </div>

    <div class="notice-box">
      <strong>Action Required:</strong> Please adjust your travel and match preparation schedule accordingly. If you have any unavoidable academic scheduling conflicts, notify the sports administration immediately.
    </div>

    ${portalUrl ? `
    <div style="text-align: center; margin: 28px 0 10px 0;">
      <a href="${portalUrl}" class="btn btn-secondary">View Updated Schedule on Portal</a>
    </div>
    ` : ''}
  `;

  const text = `
UNIVERSITY OF JAFFNA - SPORTS TOURNAMENT MANAGEMENT SYSTEM
SPORTS SCHEDULE UPDATE NOTICE

Dear ${playerName || 'Participant'},

The schedule for ${sportName} (${catName}) has been updated.

SUMMARY OF CHANGES:
${changes.map((c) => `- ${c.field}: Was "${c.previous || 'N/A'}" -> Now "${c.updated || 'N/A'}"`).join('\n')}

COMPLETE CURRENT SCHEDULE:
- Sport: ${sportName} (${catName})
- Date: ${formatDate(currentSchedule.date)}
- Time: ${currentSchedule.time || 'TBD'}
- Venue: ${currentSchedule.venue || 'TBD'}

Please adjust your schedule accordingly.

Regards,
Department of Physical Education
University of Jaffna
`.trim();

  return {
    subject,
    html: wrapEmailLayout({ preheader, title: subject, bodyHtml, sport }),
    text,
  };
};

/**
 * 3. PARTNER SELECTION / INVITATION EMAIL TEMPLATE
 */
const renderPartnerSelectionEmail = ({
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
}) => {
  const sportName = formatSport(sport);
  const catName = formatCategory(category);
  const subject = `Partner Request: ${requesterName} selected you for ${sportName} ${catName}`;
  const preheader = `${requesterName} (${requesterRollNumber}) has requested you as their partner for ${sportName} (${catName}).`;

  const bodyHtml = `
    <h2 class="greeting">Dear ${partnerName},</h2>
    <p>A fellow university student has requested to partner with you for the upcoming <strong>${sportName} — ${catName}</strong> tournament.</p>

    <div class="badge-card" style="border-left: 4px solid #3B82F6;">
      <div style="font-size: 12px; font-weight: 800; color: #1E40AF; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px;">Partner Request Details</div>
      <table class="detail-table">
        <tr>
          <td class="detail-label">Requested By:</td>
          <td class="detail-value">${requesterName} (${requesterRollNumber})</td>
        </tr>
        <tr>
          <td class="detail-label">Your Details:</td>
          <td class="detail-value">${partnerName} (${partnerRollNumber})</td>
        </tr>
        <tr>
          <td class="detail-label">Sport:</td>
          <td class="detail-value">${sportName}</td>
        </tr>
        <tr>
          <td class="detail-label">Event Category:</td>
          <td class="detail-value">${catName}</td>
        </tr>
        <tr>
          <td class="detail-label">Tournament Date:</td>
          <td class="detail-value">${formatDate(tournamentDate)}</td>
        </tr>
        <tr>
          <td class="detail-label">Venue:</td>
          <td class="detail-value">${venue || 'University Gymnasium'}</td>
        </tr>
      </table>
    </div>

    <p style="font-size: 15px; margin: 20px 0 10px 0;">Please respond to this partnership invitation below. Once accepted, your doubles team will be officially linked for tournament draw placement.</p>

    <div style="text-align: center; margin: 28px 0;">
      ${acceptUrl ? `<a href="${acceptUrl}" class="btn btn-primary" style="font-size: 15px; padding: 14px 28px; margin-right: 10px;">✓ Accept Partnership</a>` : ''}
      ${rejectUrl ? `<a href="${rejectUrl}" class="btn btn-danger" style="font-size: 15px; padding: 14px 28px;">✕ Decline Request</a>` : ''}
    </div>

    ${portalUrl ? `
    <p style="font-size: 12px; color: #64748B; text-align: center; margin-top: 14px;">
      You can also manage your partner requests directly in the <a href="${portalUrl}" style="color: #2563EB; font-weight: 700;">Tournament Portal</a>.
    </p>
    ` : ''}

    <div class="notice-box">
      <strong>Note:</strong> In doubles events, both players must be registered under compatible categories and verified before the tournament bracket draw is published.
    </div>
  `;

  const text = `
UNIVERSITY OF JAFFNA - SPORTS TOURNAMENT MANAGEMENT SYSTEM
NEW PARTNER REQUEST

Dear ${partnerName},

${requesterName} (${requesterRollNumber}) has selected you as their partner for ${sportName} - ${catName}.

DETAILS:
- Requested By: ${requesterName} (${requesterRollNumber})
- Sport: ${sportName}
- Category: ${catName}
- Date: ${formatDate(tournamentDate)}
- Venue: ${venue || 'University Gymnasium'}

To accept or decline, please visit:
${acceptUrl ? `Accept: ${acceptUrl}\n` : ''}${rejectUrl ? `Decline: ${rejectUrl}\n` : ''}${portalUrl ? `Portal: ${portalUrl}\n` : ''}

Regards,
Department of Physical Education
University of Jaffna
`.trim();

  return {
    subject,
    html: wrapEmailLayout({ preheader, title: subject, bodyHtml, sport }),
    text,
  };
};

/**
 * 4. PARTNERSHIP STATUS UPDATE TEMPLATE (CONFIRMED OR REJECTED)
 */
const renderPartnershipStatusEmail = ({
  recipientName,
  partnerName,
  requesterName,
  sport,
  category,
  status = 'confirmed', // 'confirmed' | 'rejected' | 'approved'
  portalUrl,
}) => {
  const sportName = formatSport(sport);
  const catName = formatCategory(category);
  const isAccepted = status === 'confirmed' || status === 'accepted' || status === 'approved';

  const subject = isAccepted
    ? `Partnership Confirmed: ${sportName} (${catName}) - UoJ Sports`
    : `Partner Request Declined: ${sportName} (${catName}) - UoJ Sports`;

  const preheader = isAccepted
    ? `Your partnership with ${partnerName} for ${sportName} (${catName}) has been officially confirmed!`
    : `The partner request for ${sportName} (${catName}) was not accepted.`;

  const bodyHtml = isAccepted ? `
    <h2 class="greeting">Dear ${recipientName},</h2>
    <div style="background-color: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 10px; padding: 20px; text-align: center; margin: 18px 0;">
      <div style="font-size: 32px; margin-bottom: 6px;">🎉</div>
      <h3 style="margin: 0; color: #065F46; font-size: 20px; font-weight: 800;">Partnership Confirmed!</h3>
      <p style="color: #047857; font-size: 14px; margin: 8px 0 0 0;">
        You and <strong>${partnerName}</strong> are now officially paired for <strong>${sportName} (${catName})</strong>.
      </p>
    </div>

    <div class="badge-card">
      <div style="font-size: 12px; font-weight: 800; color: #64748B; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px;">Team Overview</div>
      <table class="detail-table">
        <tr>
          <td class="detail-label">Team Members:</td>
          <td class="detail-value">${recipientName} &amp; ${partnerName}</td>
        </tr>
        <tr>
          <td class="detail-label">Sport:</td>
          <td class="detail-value">${sportName}</td>
        </tr>
        <tr>
          <td class="detail-label">Category:</td>
          <td class="detail-value">${catName}</td>
        </tr>
        <tr>
          <td class="detail-label">Pair Status:</td>
          <td class="detail-value" style="color: #059669; font-weight: 800;">Paired &amp; Ready for Draw</td>
        </tr>
      </table>
    </div>

    <p style="font-size: 14px; color: #475569;">
      Your team has been entered into the tournament roster. You will receive an official notification once the match fixtures and bracket draw are published.
    </p>

    ${portalUrl ? `
    <div style="text-align: center; margin: 24px 0 10px 0;">
      <a href="${portalUrl}" class="btn btn-secondary">View Tournament Bracket</a>
    </div>
    ` : ''}
  ` : `
    <h2 class="greeting">Dear ${recipientName},</h2>
    <p>This is to notify you that the partner invitation sent to <strong>${partnerName}</strong> for <strong>${sportName} (${catName})</strong> was not accepted.</p>

    <div class="badge-card" style="border-left: 4px solid #EF4444;">
      <div style="font-size: 12px; font-weight: 800; color: #991B1B; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px;">Status Notification</div>
      <p style="margin: 0; font-size: 14px; color: #334155;">
        Your registration remains active under the solo / looking-for-partner pool. You can select another registered player or wait for an incoming partner match.
      </p>
    </div>

    ${portalUrl ? `
    <div style="text-align: center; margin: 24px 0 10px 0;">
      <a href="${portalUrl}" class="btn btn-secondary">Find Another Partner on Portal</a>
    </div>
    ` : ''}
  `;

  const text = isAccepted ? `
UNIVERSITY OF JAFFNA - SPORTS TOURNAMENT MANAGEMENT SYSTEM
PARTNERSHIP CONFIRMED

Dear ${recipientName},

Great news! Your partnership with ${partnerName} for ${sportName} (${catName}) has been confirmed.
Your team is now officially registered for the tournament.

Regards,
Department of Physical Education
University of Jaffna
`.trim() : `
UNIVERSITY OF JAFFNA - SPORTS TOURNAMENT MANAGEMENT SYSTEM
PARTNER REQUEST UPDATE

Dear ${recipientName},

Your partner request to ${partnerName} for ${sportName} (${catName}) was not accepted.
Your registration remains active and you can select another partner via the tournament portal.

Regards,
Department of Physical Education
University of Jaffna
`.trim();

  return {
    subject,
    html: wrapEmailLayout({ preheader, title: subject, bodyHtml, sport }),
    text,
  };
};

/**
 * 5. REGISTRATION CANCELLATION EMAIL TEMPLATE
 */
const renderRegistrationCancellationEmail = ({
  playerName,
  rollNumber,
  sport,
  category,
  reason,
  portalUrl,
}) => {
  const sportName = formatSport(sport);
  const catName = formatCategory(category);
  const subject = `Registration Cancelled: ${sportName} (${catName}) - UoJ Sports`;
  const preheader = `Your registration for ${sportName} (${catName}) has been cancelled.`;

  const bodyHtml = `
    <h2 class="greeting">Dear ${playerName},</h2>
    <p>This email confirms that your registration for the <strong>University of Jaffna ${sportName} Tournament (${catName})</strong> has been cancelled.</p>

    <div class="badge-card" style="border-left: 4px solid #DC2626;">
      <div style="font-size: 12px; font-weight: 800; color: #991B1B; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px;">Cancelled Registration Summary</div>
      <table class="detail-table">
        <tr>
          <td class="detail-label">Participant:</td>
          <td class="detail-value">${playerName} (${rollNumber})</td>
        </tr>
        <tr>
          <td class="detail-label">Sport:</td>
          <td class="detail-value">${sportName}</td>
        </tr>
        <tr>
          <td class="detail-label">Category:</td>
          <td class="detail-value">${catName}</td>
        </tr>
        ${reason ? `
        <tr>
          <td class="detail-label">Reason / Notes:</td>
          <td class="detail-value" style="color: #DC2626;">${reason}</td>
        </tr>
        ` : ''}
        <tr>
          <td class="detail-label">Status:</td>
          <td class="detail-value" style="color: #DC2626; font-weight: 800;">Cancelled</td>
        </tr>
      </table>
    </div>

    <p style="font-size: 14px; color: #475569;">
      If you did not request this cancellation or believe this was done in error, please contact the Department of Physical Education or visit the tournament management desk immediately.
    </p>

    ${portalUrl ? `
    <div style="text-align: center; margin: 24px 0 10px 0;">
      <a href="${portalUrl}" class="btn btn-secondary">Visit Tournament Portal</a>
    </div>
    ` : ''}
  `;

  const text = `
UNIVERSITY OF JAFFNA - SPORTS TOURNAMENT MANAGEMENT SYSTEM
REGISTRATION CANCELLED

Dear ${playerName},

Your registration for ${sportName} (${catName}) has been cancelled.

Participant: ${playerName} (${rollNumber})
Sport: ${sportName}
Category: ${catName}
${reason ? `Reason: ${reason}\n` : ''}
If this was unexpected, please contact the Department of Physical Education.

Regards,
Department of Physical Education
University of Jaffna
`.trim();

  return {
    subject,
    html: wrapEmailLayout({ preheader, title: subject, bodyHtml, sport }),
    text,
  };
};

/**
 * 6. DRAW / BRACKET PUBLISHED NOTIFICATION TEMPLATE
 */
const renderDrawPublishedEmail = ({
  playerName,
  sport,
  category,
  tournamentDate,
  venue,
  portalUrl,
}) => {
  const sportName = formatSport(sport);
  const catName = formatCategory(category);
  const subject = `Official Draw Published: ${sportName} (${catName}) - UoJ Sports`;
  const preheader = `The official tournament bracket and match draw for ${sportName} (${catName}) is now live. Check your match fixtures.`;

  const bodyHtml = `
    <h2 class="greeting">Dear ${playerName},</h2>
    <p>The official tournament bracket and match draw for <strong>${sportName} — ${catName}</strong> has been officially approved and published!</p>

    <div style="background-color: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 10px; padding: 18px; margin: 18px 0;">
      <div style="font-size: 13px; font-weight: 800; color: #1E40AF; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Tournament Details</div>
      <table class="detail-table" style="margin: 0;">
        <tr>
          <td class="detail-label" style="color: #1E3A8A;">Sport &amp; Category:</td>
          <td class="detail-value" style="color: #1E3A8A;">${sportName} (${catName})</td>
        </tr>
        <tr>
          <td class="detail-label" style="color: #1E3A8A;">Event Date:</td>
          <td class="detail-value" style="color: #1E3A8A;">${formatDate(tournamentDate)}</td>
        </tr>
        <tr>
          <td class="detail-label" style="color: #1E3A8A;">Venue:</td>
          <td class="detail-value" style="color: #1E3A8A;">${venue || 'University Gymnasium'}</td>
        </tr>
      </table>
    </div>

    <p style="font-size: 14px; color: #334155;">
      You can now view your opponent, round assignment, and bracket progression path directly on the public tournament portal.
    </p>

    ${portalUrl ? `
    <div style="text-align: center; margin: 28px 0 10px 0;">
      <a href="${portalUrl}" class="btn btn-primary" style="font-size: 15px;">View Match Fixtures &amp; Bracket</a>
    </div>
    ` : ''}

    <div class="notice-box">
      <strong>Player Notice:</strong> Matches will start strictly on time. Failure to report when called will result in a walkover.
    </div>
  `;

  const text = `
UNIVERSITY OF JAFFNA - SPORTS TOURNAMENT MANAGEMENT SYSTEM
TOURNAMENT DRAW PUBLISHED

Dear ${playerName},

The official match bracket for ${sportName} (${catName}) has been published.
Date: ${formatDate(tournamentDate)}
Venue: ${venue || 'University Gymnasium'}

Check your fixtures on the portal:
${portalUrl || 'http://localhost:3000/brackets'}

Regards,
Department of Physical Education
University of Jaffna
`.trim();

  return {
    subject,
    html: wrapEmailLayout({ preheader, title: subject, bodyHtml, sport }),
    text,
  };
};

/**
 * 7. REGISTRATION APPROVED NOTIFICATION TEMPLATE
 */
const renderRegistrationApprovedEmail = ({
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
}) => {
  const sportName = formatSport(sport);
  const catName = formatCategory(category);
  const subject = `✅ Registration Approved: ${sportName} (${catName}) - UoJ Sports`;
  const preheader = `Congratulations! Your registration for ${sportName} (${catName}) has been approved by the admin.`;
  const isDoubles = partnerName && partnerRollNumber;

  const bodyHtml = `
    <h2 class="greeting">Dear ${playerName || 'Participant'},</h2>
    <p>We are pleased to inform you that your registration for <strong>${sportName} — ${catName}</strong> has been <strong style="color: #059669;">officially approved</strong> by the Tournament Administration.</p>

    <div style="background-color: #ECFDF5; border: 2px solid #059669; border-radius: 10px; padding: 16px 20px; margin: 20px 0; text-align: center;">
      <div style="font-size: 36px;">✅</div>
      <div style="font-size: 18px; font-weight: 800; color: #065F46; margin-top: 6px;">Registration Approved</div>
      <div style="font-size: 13px; color: #047857; margin-top: 4px;">You are now officially registered for this tournament.</div>
    </div>

    <div class="badge-card">
      <div style="font-size: 12px; font-weight: 800; color: #64748B; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px;">Your Registration Details</div>
      <table class="detail-table">
        <tr><td class="detail-label">Participant Name:</td><td class="detail-value">${playerName || '—'}</td></tr>
        <tr><td class="detail-label">Roll Number:</td><td class="detail-value">${rollNumber || '—'}</td></tr>
        <tr><td class="detail-label">Sport / Event:</td><td class="detail-value">${sportName} (${catName})</td></tr>
        <tr><td class="detail-label">Status:</td><td class="detail-value"><span style="color:#059669;font-weight:800;">✅ Approved</span></td></tr>
        ${isDoubles ? `<tr><td class="detail-label">Partner Name:</td><td class="detail-value">${partnerName}</td></tr><tr><td class="detail-label">Partner Roll No:</td><td class="detail-value">${partnerRollNumber}</td></tr>` : ''}
        ${tournamentDate ? `<tr><td class="detail-label">Tournament Date:</td><td class="detail-value" style="color:#059669;font-weight:800;">${formatDate(tournamentDate)}</td></tr>` : ''}
        ${tournamentTime ? `<tr><td class="detail-label">Start Time:</td><td class="detail-value">${tournamentTime}</td></tr>` : ''}
        ${venue ? `<tr><td class="detail-label">Venue:</td><td class="detail-value">${venue}</td></tr>` : ''}
      </table>
    </div>

    <div class="notice-box">
      <strong>Next Steps:</strong> Please arrive at the venue at least 15 minutes before the scheduled time with your University Student ID card. Failure to report on time may result in a walkover.
    </div>

    ${portalUrl ? `<div style="text-align: center; margin: 24px 0;"><a href="${portalUrl}" class="btn" style="background: linear-gradient(135deg, #059669, #10B981); color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px;">View Tournament Details →</a></div>` : ''}
  `;

  const text = `
UNIVERSITY OF JAFFNA - SPORTS TOURNAMENT MANAGEMENT SYSTEM
REGISTRATION APPROVED

Dear ${playerName},

Your registration for ${sportName} (${catName}) has been APPROVED.

Registration Details:
- Participant: ${playerName} (${rollNumber || ''})
- Sport/Event: ${sportName} (${catName})
- Status: APPROVED
${isDoubles ? `- Partner: ${partnerName} (${partnerRollNumber})
` : ''}${tournamentDate ? `- Tournament Date: ${formatDate(tournamentDate)}
` : ''}${tournamentTime ? `- Time: ${tournamentTime}
` : ''}${venue ? `- Venue: ${venue}
` : ''}
Please arrive at least 15 minutes early with your University Student ID.

Regards,
Department of Physical Education
University of Jaffna
`.trim();

  return {
    subject,
    html: wrapEmailLayout({ preheader, title: subject, bodyHtml, sport }),
    text,
  };
};

/**
 * 8. REGISTRATION REJECTED NOTIFICATION TEMPLATE
 */
const renderRegistrationRejectedEmail = ({
  playerName,
  rollNumber,
  sport,
  category,
  partnerName,
  partnerRollNumber,
  reason,
  portalUrl,
}) => {
  const sportName = formatSport(sport);
  const catName = formatCategory(category);
  const subject = `❌ Registration Not Approved: ${sportName} (${catName}) - UoJ Sports`;
  const preheader = `Unfortunately, your registration for ${sportName} (${catName}) could not be approved at this time.`;
  const isDoubles = partnerName && partnerRollNumber;

  const bodyHtml = `
    <h2 class="greeting">Dear ${playerName || 'Participant'},</h2>
    <p>We regret to inform you that your registration for <strong>${sportName} — ${catName}</strong> has been <strong style="color: #DC2626;">not approved</strong> by the Tournament Administration.</p>

    <div style="background-color: #FEF2F2; border: 2px solid #DC2626; border-radius: 10px; padding: 16px 20px; margin: 20px 0; text-align: center;">
      <div style="font-size: 36px;">❌</div>
      <div style="font-size: 18px; font-weight: 800; color: #991B1B; margin-top: 6px;">Registration Not Approved</div>
      <div style="font-size: 13px; color: #B91C1C; margin-top: 4px;">Please contact the Sports Administration for more information.</div>
    </div>

    <div class="badge-card">
      <div style="font-size: 12px; font-weight: 800; color: #64748B; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px;">Registration Details</div>
      <table class="detail-table">
        <tr><td class="detail-label">Participant Name:</td><td class="detail-value">${playerName || '—'}</td></tr>
        <tr><td class="detail-label">Roll Number:</td><td class="detail-value">${rollNumber || '—'}</td></tr>
        <tr><td class="detail-label">Sport / Event:</td><td class="detail-value">${sportName} (${catName})</td></tr>
        <tr><td class="detail-label">Status:</td><td class="detail-value"><span style="color:#DC2626;font-weight:800;">❌ Not Approved</span></td></tr>
        ${isDoubles ? `<tr><td class="detail-label">Partner Name:</td><td class="detail-value">${partnerName}</td></tr><tr><td class="detail-label">Partner Roll No:</td><td class="detail-value">${partnerRollNumber}</td></tr>` : ''}
        ${reason ? `<tr><td class="detail-label">Reason:</td><td class="detail-value" style="color:#DC2626;">${reason}</td></tr>` : ''}
      </table>
    </div>

    <div style="background-color: #FFF7ED; border: 1px solid #FED7AA; border-radius: 8px; padding: 14px 18px; margin: 18px 0; font-size: 13px; color: #92400E;">
      <strong>What can you do?</strong> If you believe this was an error, please contact the Sports Administration office or your sport's administrator for clarification. You may also re-register once any outstanding issues are resolved.
    </div>

    ${portalUrl ? `<div style="text-align: center; margin: 24px 0;"><a href="${portalUrl}" class="btn" style="background: linear-gradient(135deg, #64748B, #475569); color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px;">Visit Sports Portal →</a></div>` : ''}
  `;

  const text = `
UNIVERSITY OF JAFFNA - SPORTS TOURNAMENT MANAGEMENT SYSTEM
REGISTRATION NOT APPROVED

Dear ${playerName},

We regret to inform you that your registration for ${sportName} (${catName}) has NOT been approved.

Registration Details:
- Participant: ${playerName} (${rollNumber || ''})
- Sport/Event: ${sportName} (${catName})
- Status: NOT APPROVED
${isDoubles ? `- Partner: ${partnerName} (${partnerRollNumber})
` : ''}${reason ? `- Reason: ${reason}
` : ''}
If you believe this is an error, please contact the Sports Administration office.

Regards,
Department of Physical Education
University of Jaffna
`.trim();

  return {
    subject,
    html: wrapEmailLayout({ preheader, title: subject, bodyHtml, sport }),
    text,
  };
};

module.exports = {
  renderRegistrationConfirmationEmail,
  renderScheduleUpdateEmail,
  renderPartnerSelectionEmail,
  renderPartnershipStatusEmail,
  renderRegistrationCancellationEmail,
  renderDrawPublishedEmail,
  renderRegistrationApprovedEmail,
  renderRegistrationRejectedEmail,
  formatCategory,
  formatSport,
  formatDate,
};
