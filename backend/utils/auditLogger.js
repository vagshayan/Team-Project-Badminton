const AuditLog = require('../models/AuditLog');

const logAdminAction = async ({ action, targetId, targetModel, details, req }) => {
  try {
    const authenticatedAdminId = req?.admin?._id;
    if (!authenticatedAdminId) {
      console.error('🔥 Failed to write audit log: authenticated admin is required');
      return;
    }

    const ipAddress = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : null;

    await AuditLog.create({
      admin: authenticatedAdminId,
      action,
      targetId,
      targetModel,
      details,
      ipAddress,
      sport: req.admin.sport || null
    });
  } catch (err) {
    console.error('🔥 Failed to write audit log:', err.message);
  }
};

module.exports = { logAdminAction };
