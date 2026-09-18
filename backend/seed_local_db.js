/**
 * seed_local_db.js
 * 
 * Seeds local MongoDB database with rich sample data:
 * - Admin accounts
 * - Tournaments
 * - Player Registrations (12+ sample players with QR tokens)
 * - Tournament Matches (with rounds, scores, check-ins)
 * - University Team Members (10+ members)
 */

'use strict';

const mongoose = require('mongoose');
const crypto = require('crypto');
const Admin = require('./models/Admin');
const Tournament = require('./models/Tournament');
const Registration = require('./models/Registration');
const Match = require('./models/Match');
const UniversityTeamMember = require('./models/UniversityTeamMember');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tournament_db';

async function seed() {
  console.log(`\n🌱 Connecting to local MongoDB at ${MONGODB_URI}...`);
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB.');

  console.log('🧹 Cleaning old test data...');
  await Promise.all([
    Admin.deleteMany({}),
    Tournament.deleteMany({}),
    Registration.deleteMany({}),
    Match.deleteMany({}),
    UniversityTeamMember.deleteMany({}),
  ]);

  // 1. Create Admins for each sport
  console.log('👤 Creating Admins...');
  const adminBadminton = new Admin({
    username: 'admin_badminton',
    password: 'Password@123',
    sport: 'badminton',
    name: 'Badminton Coordinator',
    securityQuestion: 'What is your favorite sport?',
    securityAnswer: 'Badminton',
  });
  await adminBadminton.save();
  console.log('   ✅ Badminton Admin created (username: admin_badminton, password: Password@123)');

  const adminTableTennis = new Admin({
    username: 'admin_tabletennis',
    password: 'Password@123',
    sport: 'table-tennis',
    name: 'Table Tennis Coordinator',
    securityQuestion: 'What is your favorite sport?',
    securityAnswer: 'Table Tennis',
  });
  await adminTableTennis.save();
  console.log('   ✅ Table Tennis Admin created (username: admin_tabletennis, password: Password@123)');

  const adminCarrom = new Admin({
    username: 'admin_carrom',
    password: 'Password@123',
    sport: 'carrom',
    name: 'Carrom Coordinator',
    securityQuestion: 'What is your favorite sport?',
    securityAnswer: 'Carrom',
  });
  await adminCarrom.save();
  console.log('   ✅ Carrom Admin created (username: admin_carrom, password: Password@123)');

  // 2. Create Tournaments
  console.log('🏆 Creating Tournaments...');
  const currentYear = new Date().getFullYear();

  // Badminton Tournaments
  const tournamentSingles = await Tournament.create({
    sport: 'badminton',
    year: currentYear,
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    time: '09:00 AM',
    venue: 'University Indoor Stadium - Court 1',
    registrationDeadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    category: 'singles-men',
    createdBy: adminBadminton._id,
    isLocked: false,
    isActive: true,
  });

  const tournamentWomen = await Tournament.create({
    sport: 'badminton',
    year: currentYear,
    date: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
    time: '10:30 AM',
    venue: 'University Indoor Stadium - Court 2',
    registrationDeadline: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
    category: 'singles-women',
    createdBy: adminBadminton._id,
    isLocked: false,
    isActive: true,
  });

  const tournamentDoubles = await Tournament.create({
    sport: 'badminton',
    year: currentYear,
    date: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
    time: '02:00 PM',
    venue: 'University Indoor Stadium - Court 1 & 2',
    registrationDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    category: 'doubles-men',
    createdBy: adminBadminton._id,
    isLocked: false,
    isActive: true,
  });

  // Table Tennis Tournament
  await Tournament.create({
    sport: 'table-tennis',
    year: currentYear,
    date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    time: '09:30 AM',
    venue: 'Table Tennis Arena - Table 1 & 2',
    registrationDeadline: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
    category: 'singles-men',
    createdBy: adminTableTennis._id,
    isLocked: false,
    isActive: true,
  });

  // Carrom Tournament
  await Tournament.create({
    sport: 'carrom',
    year: currentYear,
    date: new Date(Date.now() + 11 * 24 * 60 * 60 * 1000),
    time: '10:00 AM',
    venue: 'Carrom Recreation Hall - Board 1-4',
    registrationDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    category: 'singles-men',
    createdBy: adminCarrom._id,
    isLocked: false,
    isActive: true,
  });

  console.log(`   ✅ 5 Tournaments created.`);

  // 3. Create Registrations (12 Players)
  console.log('📝 Creating Registrations...');
  const samplePlayers = [
    { name: 'Kavindu Perera', roll: 'EG/2021/4101', nic: '200115600123', email: 'kavindu.p@eng.ac.lk', phone: '0712345671', dept: 'Electrical Engineering', year: '3rd Year' },
    { name: 'Nisal Fernando', roll: 'EG/2021/4102', nic: '200115600124', email: 'nisal.f@eng.ac.lk', phone: '0712345672', dept: 'Civil Engineering', year: '3rd Year' },
    { name: 'Chamod Jayasinghe', roll: 'EG/2022/4201', nic: '200215600125', email: 'chamod.j@eng.ac.lk', phone: '0772345673', dept: 'Computer Engineering', year: '2nd Year' },
    { name: 'Thilina Senanayake', roll: 'EG/2020/3901', nic: '200015600126', email: 'thilina.s@eng.ac.lk', phone: '0782345674', dept: 'Mechanical Engineering', year: '4th Year' },
    { name: 'Dinuka Bandara', roll: 'EG/2022/4205', nic: '200215600127', email: 'dinuka.b@eng.ac.lk', phone: '0702345675', dept: 'Computer Engineering', year: '2nd Year' },
    { name: 'Sachintha Rathnayake', roll: 'EG/2023/4501', nic: '200315600128', email: 'sachintha.r@eng.ac.lk', phone: '0762345676', dept: 'Electrical Engineering', year: '1st Year' },
    { name: 'Ravindu Wickramasinghe', roll: 'EG/2021/4110', nic: '200115600129', email: 'ravindu.w@eng.ac.lk', phone: '0752345677', dept: 'Mechanical Engineering', year: '3rd Year' },
    { name: 'Isuru Dissanayake', roll: 'EG/2020/3920', nic: '200015600130', email: 'isuru.d@eng.ac.lk', phone: '0722345678', dept: 'Civil Engineering', year: '4th Year' },
    { name: 'Anuki Wijesinghe', roll: 'EG/2022/4301', nic: '200265600131', email: 'anuki.w@eng.ac.lk', phone: '0718765431', dept: 'Computer Engineering', year: '2nd Year', tourId: tournamentWomen._id },
    { name: 'Hiruni Mendis', roll: 'EG/2021/4150', nic: '200165600132', email: 'hiruni.m@eng.ac.lk', phone: '0778765432', dept: 'Electrical Engineering', year: '3rd Year', tourId: tournamentWomen._id },
    { name: 'Dilani Samarajeewa', roll: 'EG/2020/3980', nic: '200065600133', email: 'dilani.s@eng.ac.lk', phone: '0788765433', dept: 'Civil Engineering', year: '4th Year', tourId: tournamentWomen._id },
    { name: 'Rashmi Kulatunga', roll: 'EG/2023/4520', nic: '200365600134', email: 'rashmi.k@eng.ac.lk', phone: '0768765434', dept: 'Mechanical Engineering', year: '1st Year', tourId: tournamentWomen._id },
  ];

  const createdRegistrations = [];
  for (const p of samplePlayers) {
    const reg = await Registration.create({
      tournament: p.tourId || tournamentSingles._id,
      playerName: p.name,
      rollNumber: p.roll,
      nicNo: p.nic,
      address: 'University Hostels, Campus Road',
      email: p.email,
      phone: p.phone,
      department: p.dept,
      year: p.year,
      status: 'confirmed',
      qrToken: crypto.randomBytes(20).toString('hex'),
      qrTokenCreatedAt: new Date(),
      qrTokenRevoked: false,
    });
    createdRegistrations.push(reg);
  }
  console.log(`   ✅ ${createdRegistrations.length} Registrations created.`);

  // 4. Create Sample Matches
  console.log('🏸 Creating Matches...');
  await Match.create({
    tournament: tournamentSingles._id,
    round: 1,
    matchNumber: 1,
    player1: createdRegistrations[0]._id,
    player2: createdRegistrations[1]._id,
    winner: createdRegistrations[0]._id,
    score1: 21,
    score2: 18,
    isCompleted: true,
    status: 'completed',
    court: 'Court 1',
    venue: 'Indoor Stadium',
    scheduledDate: new Date(),
    scheduledTime: '09:30 AM',
    timeline: [
      { message: 'Match started on Court 1', timestamp: new Date(Date.now() - 3600000), type: 'start' },
      { message: 'Match ended. Winner: Kavindu Perera', timestamp: new Date(Date.now() - 1800000), type: 'end' },
    ],
  });

  await Match.create({
    tournament: tournamentSingles._id,
    round: 1,
    matchNumber: 2,
    player1: createdRegistrations[2]._id,
    player2: createdRegistrations[3]._id,
    winner: null,
    score1: 15,
    score2: 17,
    isCompleted: false,
    status: 'in-progress',
    court: 'Court 2',
    venue: 'Indoor Stadium',
    scheduledDate: new Date(),
    scheduledTime: '10:15 AM',
    timeline: [
      { message: 'Match in progress', timestamp: new Date(), type: 'update' },
    ],
  });

  await Match.create({
    tournament: tournamentSingles._id,
    round: 1,
    matchNumber: 3,
    player1: createdRegistrations[4]._id,
    player2: createdRegistrations[5]._id,
    status: 'scheduled',
    court: 'Court 1',
    venue: 'Indoor Stadium',
    scheduledDate: new Date(Date.now() + 86400000),
    scheduledTime: '11:00 AM',
  });

  await Match.create({
    tournament: tournamentWomen._id,
    round: 1,
    matchNumber: 1,
    player1: createdRegistrations[8]._id,
    player2: createdRegistrations[9]._id,
    status: 'scheduled',
    court: 'Court 2',
    venue: 'Indoor Stadium',
    scheduledDate: new Date(Date.now() + 86400000),
    scheduledTime: '01:00 PM',
  });

  console.log(`   ✅ 4 Matches created.`);

  // 5. Create University Team Members (10 Members)
  console.log('👥 Creating University Team Members...');
  const teamMembers = [
    { fullName: 'Sahan Gunawardena', registrationNumber: 'EG/2020/3890', faculty: 'Faculty of Engineering', position: 'Captain', sport: 'badminton', teamGender: 'Men' },
    { fullName: 'Vihanga Jayakody', registrationNumber: 'EG/2021/4055', faculty: 'Faculty of Engineering', position: 'Vice Captain', sport: 'badminton', teamGender: 'Men' },
    { fullName: 'Janith Alwis', registrationNumber: 'MS/2021/2102', faculty: 'Faculty of Management', position: 'Senior Member', sport: 'badminton', teamGender: 'Men' },
    { fullName: 'Charith Wickrama', registrationNumber: 'SC/2022/1050', faculty: 'Faculty of Science', position: 'Player', sport: 'badminton', teamGender: 'Men' },
    { fullName: 'Kavisha Pathirana', registrationNumber: 'EG/2023/4590', faculty: 'Faculty of Engineering', position: 'Junior Player', sport: 'badminton', teamGender: 'Men' },
    { fullName: 'Dinithi Samarasinghe', registrationNumber: 'MS/2020/1980', faculty: 'Faculty of Management', position: 'Captain', sport: 'badminton', teamGender: 'Women' },
    { fullName: 'Shenali Ranasinghe', registrationNumber: 'SC/2021/1120', faculty: 'Faculty of Science', position: 'Vice Captain', sport: 'badminton', teamGender: 'Women' },
    { fullName: 'Oshadi De Silva', registrationNumber: 'EG/2022/4310', faculty: 'Faculty of Engineering', position: 'Member', sport: 'badminton', teamGender: 'Women' },
    { fullName: 'Nimna Wijerathne', registrationNumber: 'AR/2022/5020', faculty: 'Faculty of Arts', position: 'Member', sport: 'badminton', teamGender: 'Women' },
    { fullName: 'Sanduni Fernando', registrationNumber: 'SC/2023/1205', faculty: 'Faculty of Science', position: 'Junior Member', sport: 'badminton', teamGender: 'Women' },
  ];

  await UniversityTeamMember.insertMany(teamMembers);
  console.log(`   ✅ 10 University Team Members created.`);

  console.log('\n======================================================');
  console.log('🎉 Local MongoDB Seeding Completed Successfully!');
  console.log('======================================================');
  console.log(`Database URI: ${MONGODB_URI}`);
  console.log('Admin Credentials:');
  console.log('  🏸 Badminton:    admin_badminton    / Password@123');
  console.log('  🏓 Table Tennis: admin_tabletennis  / Password@123');
  console.log('  🎯 Carrom:       admin_carrom       / Password@123');
  console.log(`Sample Player Registrations: ${createdRegistrations.length}`);
  console.log(`Sample Matches: 4`);
  console.log(`University Team Members: ${teamMembers.length}`);
  console.log('======================================================\n');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
