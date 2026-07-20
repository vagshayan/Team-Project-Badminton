const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    action: { 
      type: String, 
      required: true,
    },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    targetModel: { type: String, required: true },
    details: { type: mongoose.Schema.Types.Mixed }, // Payload, state changes, or descriptive metadata
    ipAddress: { type: String },
    sport: { type: String, enum: ['badminton', 'table-tennis', 'carrom'] }
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
