const crypto = require('crypto');
const { getModelsForSport } = require('../models/SportModels');
const Match = require('../models/Match');
const PlayerPass = require('../models/PlayerPass');

const SPORTS = ['badminton', 'table-tennis', 'carrom'];
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const tokenKey = () => crypto.scryptSync(process.env.JWT_SECRET, 'player-pass-token', 32);
const encryptToken = (token) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', tokenKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
};
const decryptToken = (value) => {
  const [ivHex, tagHex, encryptedHex] = String(value || '').split(':');
  if (!ivHex || !tagHex || !encryptedHex) throw new Error('Invalid stored pass token');
  const decipher = crypto.createDecipheriv('aes-256-gcm', tokenKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]).toString('utf8');
};

async function ensurePlayerPass(sport, registrationId) {
  let playerPass = await PlayerPass.findOne({ sport, registration: registrationId });
  if (playerPass) return { playerPass, token: null };

  const token = crypto.randomBytes(32).toString('base64url');
  const registration = await getModelsForSport(sport).Registration.findById(registrationId);
  if (!registration) throw new Error('Registration not found');

  try {
    playerPass = await PlayerPass.create({
      sport,
      registration: registration._id,
      playerId: `PASS-${crypto.randomBytes(12).toString('hex').toUpperCase()}`,
      tokenHash: hashToken(token),
      tokenCipher: encryptToken(token),
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    playerPass = await PlayerPass.findOne({ sport, registration: registrationId });
  }
  return { playerPass, token: playerPass?.tokenHash === hashToken(token) ? token : null };
}

async function buildPass(sport, registrationId) {
  if (!SPORTS.includes(sport)) return null;
  const { Tournament, Registration } = getModelsForSport(sport);
  const registration = await Registration.findById(registrationId).lean();
  if (!registration) return null;
  const tournament = await Tournament.findById(registration.tournament).lean();
  if (!tournament) return null;

  const matches = await Match.find({
    tournament: registration.tournament,
    $or: [{ player1: registration._id }, { player2: registration._id }],
  }).sort({ round: -1, matchDate: 1, matchNumber: 1 }).lean();
  const match = matches.find((item) => !item.isCompleted) || matches[0] || null;
  const opponentId = match && String(match.player1) === String(registration._id) ? match.player2 : match?.player1;
  const opponent = opponentId ? await Registration.findById(opponentId).select('playerName').lean() : null;

  const playerPass = await PlayerPass.findOne({ sport, registration: registration._id }).lean();
  const valid = Boolean(playerPass && !playerPass.isRevoked && !['cancelled', 'rejected'].includes(registration.status));

  return {
    passId: playerPass?._id,
    playerId: playerPass?.playerId || registration.rollNumber,
    registrationId: registration._id,
    player: {
      name: registration.playerName,
      email: registration.email,
      phone: registration.phone,
      category: registration.gender || tournament.category,
      registrationDate: registration.createdAt,
      registrationStatus: registration.status,
    },
    sport,
    tournament: {
      id: tournament._id,
      name: `${tournament.year} ${sport.replace('-', ' ')} ${tournament.category}`,
      year: tournament.year,
      category: tournament.category,
      venue: tournament.venue,
    },
    match: match ? {
      id: match._id,
      opponent: opponent?.playerName || 'TBD',
      round: match.round,
      date: match.matchDate,
      time: match.scheduledTime || '',
      court: match.court || '',
      venue: match.venue || tournament.venue,
      status: match.isCompleted ? 'Completed' : 'Scheduled',
    } : { status: 'Match Schedule Pending' },
    passStatus: valid ? 'valid' : (playerPass?.isRevoked || ['cancelled', 'rejected'].includes(registration.status) ? 'cancelled' : 'invalid'),
    updatedAt: new Date(),
  };
}

async function findPassByToken(token) {
  if (typeof token !== 'string' || token.length > 128) return null;
  const playerPass = await PlayerPass.findOne({ tokenHash: hashToken(token) }).lean();
  if (!playerPass) return null;
  return { playerPass, details: await buildPass(playerPass.sport, playerPass.registration) };
}

module.exports = { SPORTS, hashToken, encryptToken, decryptToken, ensurePlayerPass, buildPass, findPassByToken };