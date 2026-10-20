c// require('dotenv').config({ path: '../backend/.env' });
// const mongoose = require('mongoose');
// const Admin = require('../backend/models/Admin');

// const username = process.argv[2];

// if (!username) {
//   console.log('Usage: node make_super_admin.js <username>');
//   process.exit(1);
// }

// const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tournament_app';

// mongoose.connect(mongoUri)
//   .then(async () => {
//     console.log('Connected to MongoDB');
//     const admin = await Admin.findOne({ username: username.trim() });
//     if (!admin) {
//       console.error(`Admin with username "${username}" not found.`);
//       process.exit(1);
//     }

//     admin.role = 'super_admin';
//     await admin.save();
//     console.log(`✅ Success! Admin "${admin.username}" (${admin.name}) has been promoted to super_admin.`);
//     process.exit(0);
//   })
//   .catch((err) => {
//     console.error('Error connecting to MongoDB:', err);
//     process.exit(1);
//   });
