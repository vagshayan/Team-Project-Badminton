const fs = require('fs');
const mongoose = require('mongoose');
const { getModelsForSport } = require('./models/SportModels');

const env = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8').split(/\r?\n/).reduce((acc, line) => {
  const m = line.match(/^(\w+)=(.*)$/);
  if (m) acc[m[1]] = m[2];
  return acc;
}, {}) : {};

const uri = env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI not found in .env');
  process.exit(1);
}

(async () => {
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    const sports = ['badminton', 'table-tennis', 'carrom'];
    let totalUpdated = 0;
    const csvRows = [];

    for (const s of sports) {
      const { Registration, Tournament } = getModelsForSport(s);
      const regs = await Registration.find({ partnerRollNumber: { $exists: true, $ne: '' } }).lean();
      for (const r of regs) {
        const partnerRoll = String(r.partnerRollNumber || '').trim().toUpperCase();
        if (!partnerRoll) continue;
        const tournamentId = r.tournament;
        const partner = await Registration.findOne({ tournament: tournamentId, rollNumber: partnerRoll });
        if (!partner) continue;
        const partnerHas = (partner.partnerRollNumber || '').trim().toUpperCase();
        if (!partnerHas || partnerHas !== (r.rollNumber || '').trim().toUpperCase()) {
          // update partner to point back
          const updated = await Registration.findOneAndUpdate(
            { _id: partner._id },
            { partnerRollNumber: r.rollNumber, partnerName: r.playerName },
            { new: true }
          );
          if (updated) totalUpdated++;
        }
      }

      // build CSV rows: find unique pairings per tournament
      const tournaments = await Tournament.find({}).select('_id name category year');
      for (const t of tournaments) {
        const regsInT = await Registration.find({ tournament: t._id }).lean();
        const map = {};
        regsInT.forEach(x => { map[(x.rollNumber||'').trim().toUpperCase()] = x; });
        const seen = new Set();
        for (const x of regsInT) {
          const roll = (x.rollNumber||'').trim().toUpperCase();
          const prow = (x.partnerRollNumber||'').trim().toUpperCase();
          if (!prow) continue;
          if (seen.has(roll) || seen.has(prow)) continue;
          const p = map[prow];
          if (!p) continue;
          seen.add(roll); seen.add(prow);
          const status = (x.status === 'confirmed' && p.status === 'confirmed') ? 'APPROVED' : 'PENDING';
          csvRows.push({
            sport: s,
            tournament: t._id.toString(),
            year: t.year,
            category: t.category,
            player1: { name: x.playerName, roll: x.rollNumber, nic: x.nicNo || '', dept: x.department || '', phone: x.phone || '', email: x.email || '' },
            player2: { name: p.playerName, roll: p.rollNumber, nic: p.nicNo || '', dept: p.department || '', phone: p.phone || '', email: p.email || '' },
            status
          });
        }
      }
    }

    console.log('Total partner back-links created/updated:', totalUpdated);
    if (csvRows.length === 0) {
      console.log('No pairs found to export.');
    } else {
      const headers = [
        'Player 1 Name','Player 1 Reg No','Player 1 NIC','Player 1 Department','Player 1 Phone','Player 1 Email',
        'Player 2 Name','Player 2 Reg No','Player 2 NIC','Player 2 Department','Player 2 Phone','Player 2 Email',
        'Year','Pair Status'
      ];
      console.log(headers.join(','));
      for (const r of csvRows) {
        const row = [
          r.player1.name, r.player1.roll, r.player1.nic, r.player1.dept, r.player1.phone, r.player1.email,
          r.player2.name, r.player2.roll, r.player2.nic, r.player2.dept, r.player2.phone, r.player2.email,
          r.year, r.status
        ];
        console.log(row.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(','));
      }
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
