/**
 * notificationService.js
 * ----------------------
 * High-level notification functions for the University Indoor Games Management System.
 *
 * Design principles:
 *  - Every exported function is FIRE-AND-FORGET.
 *    They catch all errors internally and never re-throw.
 *    This mirrors the existing utils/auditLogger.js pattern.
 *  - Main application workflow is never disrupted by email failures.
 *  - Each function accepts the data already available in the route handler
 *    to avoid unnecessary extra DB queries.
 */

'use strict';

const { sendEmail } = require('./emailService');
const {
  registrationConfirmationTemplate,
  registrationApprovalTemplate,
  registrationRejectionTemplate,
  matchScheduledTemplate,
  tournamentUpdatedTemplate,
  matchResultTemplate,
} = require('../templates/emailTemplates');

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Extracts the sport name from a tournament document.
 * Sport-specific tournaments carry a `.sport` field; falls back to the
 * sport parameter if available.
 */
function resolveSport(tournament, sport) {
  return (tournament && tournament.sport) || sport || 'Unknown Sport';
}

// ── 1. Registration Confirmation ──────────────────────────────────────────────

/**
 * Sends a registration confirmation email to a newly registered player.
 *
 * @param {object} reg          - Mongoose Registration document
 * @param {object} tournament   - Mongoose Tournament document (populated)
 */
async function sendRegistrationConfirmation(reg, tournament) {
  try {
    if (!reg || !reg.email) {
      console.warn('[NotificationService] sendRegistrationConfirmation: missing reg or email — skipped');
      return;
    }

    const sport = resolveSport(tournament, null);
    const html = registrationConfirmationTemplate({
      playerName:     reg.playerName,
      rollNumber:     reg.rollNumber,
      email:          reg.email,
      sport,
      tournamentYear: tournament ? tournament.year : null,
      category:       tournament ? tournament.category : null,
      venue:          tournament ? tournament.venue : null,
      tournamentDate: tournament ? tournament.date : null,
      registeredAt:   reg.createdAt || new Date(),
      qrToken:        reg.qrToken,
    });

    await sendEmail({
      to:      reg.email,
      subject: 'Registration Received – University Indoor Games',
      html,
    });
  } catch (err) {
    console.error('[NotificationService] sendRegistrationConfirmation failed:', err.message);
  }
}

// ── 2. Registration Approval ──────────────────────────────────────────────────

/**
 * Sends an approval email when an admin confirms a registration.
 *
 * @param {object} reg        - Mongoose Registration document (with tournament populated)
 * @param {object} tournament - Mongoose Tournament document
 */
async function sendRegistrationApproval(reg, tournament) {
  try {
    if (!reg || !reg.email) {
      console.warn('[NotificationService] sendRegistrationApproval: missing reg or email — skipped');
      return;
    }

    const sport = resolveSport(tournament, null);
    const html = registrationApprovalTemplate({
      playerName:     reg.playerName,
      rollNumber:     reg.rollNumber,
      sport,
      category:       tournament ? tournament.category : null,
      venue:          tournament ? tournament.venue : null,
      tournamentDate: tournament ? tournament.date : null,
      tournamentTime: tournament ? tournament.time : null,
      qrToken:        reg.qrToken,
    });

    await sendEmail({
      to:      reg.email,
      subject: 'Registration Approved – You Can Participate',
      html,
    });
  } catch (err) {
    console.error('[NotificationService] sendRegistrationApproval failed:', err.message);
  }
}

// ── 3. Registration Rejection ─────────────────────────────────────────────────

/**
 * Sends a rejection email when an admin rejects a registration.
 *
 * @param {object} reg        - Mongoose Registration document (with tournament populated)
 * @param {object} tournament - Mongoose Tournament document
 */
async function sendRegistrationRejection(reg, tournament) {
  try {
    if (!reg || !reg.email) {
      console.warn('[NotificationService] sendRegistrationRejection: missing reg or email — skipped');
      return;
    }

    const sport = resolveSport(tournament, null);
    const html = registrationRejectionTemplate({
      playerName: reg.playerName,
      rollNumber: reg.rollNumber,
      sport,
      category:   tournament ? tournament.category : null,
    });

    await sendEmail({
      to:      reg.email,
      subject: 'Registration Update – University Indoor Games',
      html,
    });
  } catch (err) {
    console.error('[NotificationService] sendRegistrationRejection failed:', err.message);
  }
}

// ── 4. Match Scheduled (Draw Generated) ──────────────────────────────────────

/**
 * Sends match schedule notifications to all players in the first-round
 * matches after a draw is generated.
 *
 * Called from: POST /api/tournaments/:id/generate-draws
 *
 * @param {object[]} round1Matches  - Array of Match documents from Round 1
 * @param {object}   tournament     - Mongoose Tournament document
 * @param {string}   sport          - Sport string e.g. 'badminton'
 * @param {object}   Registration   - The sport-specific Registration model
 */
async function sendMatchScheduledNotification(round1Matches, tournament, sport, Registration) {
  try {
    if (!round1Matches || round1Matches.length === 0) return;
    if (!tournament) return;

    // For each match in Round 1, notify both participating players
    for (const match of round1Matches) {
      // Skip bye matches (one player is null)
      if (!match.player1 && !match.player2) continue;

      let p1 = null;
      let p2 = null;

      try {
        if (match.player1) {
          p1 = await Registration.findById(match.player1).lean();
        }
        if (match.player2) {
          p2 = await Registration.findById(match.player2).lean();
        }
      } catch (lookupErr) {
        console.error('[NotificationService] sendMatchScheduledNotification: player lookup failed:', lookupErr.message);
        continue;
      }

      // Only notify real players (not byes)
      const players = [p1, p2].filter(Boolean);
      for (const player of players) {
        if (!player.email) continue;

        const opponent = players.find((p) => p._id.toString() !== player._id.toString());
        const html = matchScheduledTemplate({
          playerName:     player.playerName,
          sport,
          category:       tournament.category,
          opponentName:   opponent ? opponent.playerName : null,
          round:          match.round,
          matchNumber:    match.matchNumber,
          venue:          tournament.venue,
          tournamentDate: tournament.date,
          tournamentTime: tournament.time,
        });

        await sendEmail({
          to:      player.email,
          subject: `Match Scheduled – ${sport.charAt(0).toUpperCase() + sport.slice(1).replace('-', ' ')}`,
          html,
        });
      }
    }
  } catch (err) {
    console.error('[NotificationService] sendMatchScheduledNotification failed:', err.message);
  }
}

// ── 5. Tournament Updated (Reschedule) ────────────────────────────────────────

/**
 * Sends rescheduling notifications to all confirmed players when a
 * tournament's date, time, or venue changes.
 *
 * Called from: PUT /api/tournaments/:id
 *
 * @param {object} tournament   - Updated tournament document (already saved)
 * @param {object} beforeValues - Previous field values: { date, time, venue }
 * @param {string} sport        - Sport string
 * @param {object} Registration - Sport-specific Registration model
 */
async function sendTournamentUpdatedNotification(tournament, beforeValues, sport, Registration) {
  try {
    if (!tournament) return;

    // Fetch all confirmed players for this tournament
    let confirmedRegs;
    try {
      confirmedRegs = await Registration.find({
        tournament: tournament._id,
        status: 'confirmed',
      }).lean();
    } catch (lookupErr) {
      console.error('[NotificationService] sendTournamentUpdatedNotification: registration lookup failed:', lookupErr.message);
      return;
    }

    if (!confirmedRegs || confirmedRegs.length === 0) return;

    for (const reg of confirmedRegs) {
      if (!reg.email) continue;

      const html = tournamentUpdatedTemplate({
        playerName:    reg.playerName,
        sport,
        category:      tournament.category,
        previousDate:  beforeValues.date,
        previousTime:  beforeValues.time,
        previousVenue: beforeValues.venue,
        newDate:       tournament.date,
        newTime:       tournament.time,
        newVenue:      tournament.venue,
      });

      await sendEmail({
        to:      reg.email,
        subject: 'Tournament Schedule Updated – Action Required',
        html,
      });
    }
  } catch (err) {
    console.error('[NotificationService] sendTournamentUpdatedNotification failed:', err.message);
  }
}

// ── 6. Match Result ───────────────────────────────────────────────────────────

/**
 * Sends match result notifications to both players after a match result is recorded.
 *
 * Called from: PUT /api/tournaments/matches/:matchId/score
 *
 * @param {object} match        - The completed Match document
 * @param {string} sport        - Sport string
 */
async function sendMatchResultNotification(match, sport) {
  try {
    if (!match || !match.winner) return;

    // Determine the sport from the tournament if not explicitly passed
    const { getModelsForSport } = require('../models/SportModels');
    const sports = sport ? [sport] : ['badminton', 'table-tennis', 'carrom'];

    let Registration = null;
    let tournament = null;

    // Find the right Registration model and tournament
    for (const s of sports) {
      try {
        const { Registration: Reg, Tournament: Tour } = getModelsForSport(s);
        const t = await Tour.findById(match.tournament).lean();
        if (t) {
          Registration = Reg;
          tournament = t;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!Registration || !tournament) {
      console.warn('[NotificationService] sendMatchResultNotification: could not resolve tournament — skipped');
      return;
    }

    // Fetch both players
    const [p1, p2] = await Promise.all([
      match.player1 ? Registration.findById(match.player1).lean() : Promise.resolve(null),
      match.player2 ? Registration.findById(match.player2).lean() : Promise.resolve(null),
    ]);

    const winnerIdStr = String(match.winner);

    for (const player of [p1, p2]) {
      if (!player || !player.email) continue;

      const isWinner = String(player._id) === winnerIdStr;
      const winner   = [p1, p2].find((p) => p && String(p._id) === winnerIdStr);

      const html = matchResultTemplate({
        playerName:        player.playerName,
        sport:             sport || tournament.sport || '',
        category:          tournament.category,
        round:             match.round,
        matchNumber:       match.matchNumber,
        winnerName:        winner ? winner.playerName : 'TBD',
        player1Name:       p1 ? p1.playerName : 'BYE',
        player2Name:       p2 ? p2.playerName : 'BYE',
        isRecipientWinner: isWinner,
      });

      await sendEmail({
        to:      player.email,
        subject: `Match Result Available – ${sport || ''}`,
        html,
      });
    }
  } catch (err) {
    console.error('[NotificationService] sendMatchResultNotification failed:', err.message);
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  sendRegistrationConfirmation,
  sendRegistrationApproval,
  sendRegistrationRejection,
  sendMatchScheduledNotification,
  sendTournamentUpdatedNotification,
  sendMatchResultNotification,
};
