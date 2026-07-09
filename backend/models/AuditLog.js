const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    action: { 
      type: String, 
      required: true,
      enum: [
        'CREATE_TOURNAMENT',
        'UPDATE_TOURNAMENT',
        'DELETE_TOURNAMENT',
        'GENERATE_DRAW',
        'RESET_DRAW',
        'PUBLISH_DRAW',
        'FORCE_UNLOCK_DRAW',
        'UPDATE_MATCH_SCORE'
      ]
    },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true }, // Tournament ID or Match ID
    targetModel: { type: String, required: true, enum: ['Tournament', 'Match'] },
    details: { type: mongoose.Schema.Types.Mixed }, // Payload, state changes, or descriptive metadata
    ipAddress: { type: String }
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
