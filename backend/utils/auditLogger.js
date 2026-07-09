const AuditLog = require('../models/AuditLog');

const logAdminAction = async ({ adminId, action, targetId, targetModel, details, req }) => {
  try {
    const ipAddress = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : null;
    await AuditLog.create({
      admin: adminId,
      action,
      targetId,
      targetModel,
      details,
      ipAddress
    });
  } catch (err) {
    console.error('🔥 Failed to write audit log:', err.message);
  }
};

module.exports = { logAdminAction };
