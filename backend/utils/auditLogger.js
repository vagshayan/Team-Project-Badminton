const AuditLog = require('../models/AuditLog');

const logAdminAction = async ({ action, targetId, targetModel, details, req, session }) => {
  const authenticatedAdminId = req?.admin?._id;
  if (!authenticatedAdminId) {
    throw new Error('Audit log requires an authenticated admin');
  }

  const ipAddress = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : null;

  await AuditLog.create([{
    admin: authenticatedAdminId,
    action,
    targetId,
    targetModel,
    details,
    ipAddress,
    sport: req.admin.sport || null
  }], session ? { session } : undefined);
};

module.exports = { logAdminAction };
