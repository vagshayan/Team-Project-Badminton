const mongoose = require('mongoose');
const Reg = require('./models/Registration');

mongoose.connect('mongodb://127.0.0.1:27017/tournament_db').then(async () => {
  const regs = await Reg.find({ qrToken: { $exists: true, $ne: null } }, 'playerName rollNumber qrToken status').limit(5);
  console.log('Players with QR tokens:', regs.length);
  regs.forEach(r => console.log('  -', r.playerName, '|', r.rollNumber, '| token:', r.qrToken?.substring(0,12) + '...', '| status:', r.status));
  
  if (regs.length === 0) {
    const all = await Reg.find({}, 'playerName qrToken status').limit(5);
    console.log('\nAll registrations (any):', all.length);
    all.forEach(r => console.log('  -', r.playerName, '| token:', r.qrToken || 'NONE', '| status:', r.status));
  }

  if (regs.length > 0) {
    console.log('\n--- Open this URL in your browser to see a Player Pass ---');
    console.log('http://localhost:3000/player/qr/' + regs[0].qrToken);
  }

  await mongoose.disconnect();
}).catch(e => console.error(e.message));
