const AuditLog = require('../models/AuditLog');
const Admin = require('../models/Admin');

const logAdminAction = async ({ adminId, action, targetId, targetModel, details, req }) => {
  try {
    const ipAddress = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : null;
    let sport = req?.admin?.sport;

    // If request doesn't include admin sport, try to fetch from adminId
    if (!sport && adminId) {
      try {
        const adminDoc = await Admin.findById(adminId).select('sport');
        sport = adminDoc?.sport;
      } catch (e) {
        // swallow and continue; we'll write null if unavailable
      }
    }

    await AuditLog.create({
      admin: adminId,
      action,
      targetId,
      targetModel,
      details,
      ipAddress,
      sport: sport || null
    });
  } catch (err) {
    console.error('🔥 Failed to write audit log:', err.message);
  }
};

module.exports = { logAdminAction };
