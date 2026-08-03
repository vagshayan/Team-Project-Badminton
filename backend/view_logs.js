const mongoose = require('mongoose');
require('dotenv').config();
const AuditLog = require('./models/AuditLog');
const Admin = require('./models/Admin');

async function viewLogs() {
  try {
    console.log('📡 Fetching Audit Logs from MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);

    const logs = await AuditLog.find()
      .populate('admin', 'name username sport')
      .sort({ createdAt: -1 })
      .limit(50); // Get latest 50 logs

    if (logs.length === 0) {
      console.log('ℹ️ No audit logs found in the database yet.');
    } else {
      console.log(`\n📋 LATEST ${logs.length} AUDIT LOG ENTRIES:`);
      console.table(logs.map(l => ({
        Timestamp: l.createdAt.toISOString().replace('T', ' ').slice(0, 19),
        Admin: l.admin ? `${l.admin.name} (${l.admin.sport})` : 'Unknown',
        Action: l.action,
        Target: `${l.targetModel} [${l.targetId.toString().slice(-6)}]`,
        IP: l.ipAddress || 'N/A',
        Details: JSON.stringify(l.details)
      })));
    }
  } catch (err) {
    console.error('❌ Database error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

viewLogs();
