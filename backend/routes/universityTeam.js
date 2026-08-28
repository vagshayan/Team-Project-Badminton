const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const UniversityTeamMember = require('../models/UniversityTeamMember');
const { getModelsForSport } = require('../models/SportModels');
const { protect } = require('../middleware/auth');
const { logAdminAction } = require('../utils/auditLogger');

// Multer storage configuration for team photos
const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `team-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Only JPEG, PNG, and WEBP images are allowed'));
  },
});

// Position priority helper for sorting
const getPositionPriority = (pos) => {
  const p = (pos || '').toLowerCase();
  if (p.includes('captain') && !p.includes('vice')) return 1;
  if (p.includes('vice captain') || p.includes('vice-captain')) return 2;
  if (p.includes('game admin') || p.includes('admin') || p.includes('manager')) return 3;
  if (p.includes('player') || p.includes('member')) return 4;
  return 5;
};

// GET /api/university-team/available-players - Admin Protected: Fetch game-specific player database
router.get('/available-players', protect, async (req, res) => {
  try {
    const sport = req.admin.sport;
    if (!sport) {
      return res.status(400).json({ message: 'Admin sport is missing' });
    }
    const { Player, Registration } = getModelsForSport(sport);

    // Retrieve confirmed players from Player model
    const playersList = await Player.find().lean();

    // Retrieve players from Registration model as backup/additional entries
    const regList = await Registration.find().lean();

    const playerMap = new Map();

    // Add from Player model
    playersList.forEach((p) => {
      const roll = (p.rollNumber || '').trim().toUpperCase();
      if (roll && !playerMap.has(roll)) {
        playerMap.set(roll, {
          fullName: p.name || '',
          registrationNumber: roll,
          faculty: p.department || '',
          nicNo: p.nicNo || '',
          email: p.email || '',
          phone: p.phone || '',
          gender: p.gender || '',
          photo: p.photo || '',
        });
      }
    });

    // Add from Registration model
    regList.forEach((r) => {
      const roll = (r.rollNumber || '').trim().toUpperCase();
      if (roll && !playerMap.has(roll)) {
        playerMap.set(roll, {
          fullName: r.playerName || '',
          registrationNumber: roll,
          faculty: r.department || '',
          nicNo: r.nicNo || '',
          email: r.email || '',
          phone: r.phone || '',
          gender: r.gender || '',
          photo: r.photo || '',
        });
      }
    });

    const availablePlayers = Array.from(playerMap.values()).sort((a, b) =>
      a.fullName.localeCompare(b.fullName)
    );

    res.json(availablePlayers);
  } catch (err) {
    console.error('Error fetching available game players:', err);
    res.status(500).json({ message: 'Failed to fetch game players database' });
  }
});

// GET /api/university-team - Fetch team members (optional ?sport=badminton & ?teamGender=Men filter)
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.sport) {
      filter.sport = req.query.sport;
    }
    if (req.query.teamGender) {
      filter.teamGender = req.query.teamGender;
    }

    const members = await UniversityTeamMember.find(filter).sort({ createdAt: 1 });
    
    // Sort logically: Captain -> Vice Captain -> Game Admin -> Player
    const sorted = [...members].sort((a, b) => {
      const prioA = getPositionPriority(a.position);
      const prioB = getPositionPriority(b.position);
      if (prioA !== prioB) return prioA - prioB;
      return a.fullName.localeCompare(b.fullName);
    });

    res.json(sorted);
  } catch (err) {
    console.error('Error fetching university team members:', err);
    res.status(500).json({ message: 'Failed to load university team members' });
  }
});

// POST /api/university-team - Admin Protected: Add new team member for admin's sport
router.post('/', protect, upload.single('photoFile'), async (req, res) => {
  try {
    const { fullName, registrationNumber, faculty, position, sport, teamGender, photoUrl } = req.body;

    if (!fullName || !registrationNumber || !faculty || !position) {
      return res.status(400).json({ message: 'Full name, registration number, faculty, and position are required.' });
    }

    const memberSport = req.admin?.sport || sport || 'badminton';

    if (req.admin?.sport && sport && sport !== req.admin.sport) {
      return res.status(403).json({ message: `Unauthorized: You can only manage ${req.admin.sport} team members.` });
    }

    const validTeamGender = ['Men', 'Women'].includes(teamGender) ? teamGender : 'Men';
    const trimmedPosition = position.trim();

    // Role count validation: Only 1 Captain, 1 Vice Captain, 1 Game Admin per squad
    const UNIQUE_POSITIONS = ['Captain', 'Vice Captain', 'Game Admin'];
    if (UNIQUE_POSITIONS.includes(trimmedPosition)) {
      const existing = await UniversityTeamMember.findOne({
        sport: memberSport,
        teamGender: validTeamGender,
        position: trimmedPosition,
      });
      if (existing) {
        return res.status(400).json({
          message: `Limit Exceeded: A ${trimmedPosition} already exists for the ${validTeamGender === 'Women' ? 'Girls' : 'Boys'} ${memberSport} team (${existing.fullName}). Only 1 ${trimmedPosition} is allowed per team.`
        });
      }
    }

    let photoPath = photoUrl || '';
    if (req.file) {
      photoPath = `/uploads/${req.file.filename}`;
    }

    const newMember = await UniversityTeamMember.create({
      fullName: fullName.trim(),
      registrationNumber: registrationNumber.trim(),
      faculty: faculty.trim(),
      position: trimmedPosition,
      sport: memberSport,
      teamGender: validTeamGender,
      photo: photoPath,
    });

    await logAdminAction({
      adminId: req.admin._id,
      action: 'ADD_TEAM_MEMBER',
      targetId: newMember._id,
      targetModel: 'UniversityTeamMember',
      details: { fullName: newMember.fullName, position: newMember.position, sport: newMember.sport, teamGender: newMember.teamGender, registrationNumber: newMember.registrationNumber },
      req,
    });

    res.status(201).json(newMember);
  } catch (err) {
    console.error('Error adding university team member:', err);
    res.status(500).json({ message: err.message || 'Failed to add team member' });
  }
});

// PUT /api/university-team/:id - Admin Protected: Update team member
router.put('/:id', protect, upload.single('photoFile'), async (req, res) => {
  try {
    const { fullName, registrationNumber, faculty, position, sport, teamGender, photoUrl, removePhoto } = req.body;

    const member = await UniversityTeamMember.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ message: 'Team member not found' });
    }

    if (req.admin?.sport && member.sport !== req.admin.sport) {
      return res.status(403).json({ message: `Unauthorized: You can only manage ${req.admin.sport} team members.` });
    }

    const targetSport = (sport && (!req.admin?.sport || sport === req.admin.sport)) ? sport : member.sport;
    const targetGender = (teamGender && ['Men', 'Women'].includes(teamGender)) ? teamGender : member.teamGender;
    const targetPosition = position ? position.trim() : member.position;

    // Role count validation: Only 1 Captain, 1 Vice Captain, 1 Game Admin per squad
    const UNIQUE_POSITIONS = ['Captain', 'Vice Captain', 'Game Admin'];
    if (UNIQUE_POSITIONS.includes(targetPosition)) {
      const existing = await UniversityTeamMember.findOne({
        _id: { $ne: member._id },
        sport: targetSport,
        teamGender: targetGender,
        position: targetPosition,
      });
      if (existing) {
        return res.status(400).json({
          message: `Limit Exceeded: A ${targetPosition} already exists for the ${targetGender === 'Women' ? 'Girls' : 'Boys'} ${targetSport} team (${existing.fullName}). Only 1 ${targetPosition} is allowed per team.`
        });
      }
    }

    if (fullName) member.fullName = fullName.trim();
    if (registrationNumber) member.registrationNumber = registrationNumber.trim();
    if (faculty) member.faculty = faculty.trim();
    if (position) member.position = targetPosition;
    member.sport = targetSport;
    member.teamGender = targetGender;

    if (req.file) {
      if (member.photo && member.photo.startsWith('/uploads/')) {
        const oldPath = path.join(__dirname, '..', member.photo);
        if (fs.existsSync(oldPath)) {
          try { fs.unlinkSync(oldPath); } catch (e) { /* ignore */ }
        }
      }
      member.photo = `/uploads/${req.file.filename}`;
    } else if (removePhoto === 'true') {
      if (member.photo && member.photo.startsWith('/uploads/')) {
        const oldPath = path.join(__dirname, '..', member.photo);
        if (fs.existsSync(oldPath)) {
          try { fs.unlinkSync(oldPath); } catch (e) { /* ignore */ }
        }
      }
      member.photo = '';
    } else if (photoUrl !== undefined && photoUrl !== '') {
      member.photo = photoUrl;
    }

    await member.save();

    await logAdminAction({
      adminId: req.admin._id,
      action: 'UPDATE_TEAM_MEMBER',
      targetId: member._id,
      targetModel: 'UniversityTeamMember',
      details: { fullName: member.fullName, position: member.position, sport: member.sport, teamGender: member.teamGender, registrationNumber: member.registrationNumber },
      req,
    });

    res.json(member);
  } catch (err) {
    console.error('Error updating team member:', err);
    res.status(500).json({ message: err.message || 'Failed to update team member' });
  }
});

// DELETE /api/university-team/:id - Admin Protected: Delete team member
router.delete('/:id', protect, async (req, res) => {
  try {
    const member = await UniversityTeamMember.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ message: 'Team member not found' });
    }

    if (req.admin?.sport && member.sport !== req.admin.sport) {
      return res.status(403).json({ message: `Unauthorized: You can only delete ${req.admin.sport} team members.` });
    }

    if (member.photo && member.photo.startsWith('/uploads/')) {
      const oldPath = path.join(__dirname, '..', member.photo);
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch (e) { /* ignore */ }
      }
    }

    await UniversityTeamMember.findByIdAndDelete(req.params.id);

    await logAdminAction({
      adminId: req.admin._id,
      action: 'DELETE_TEAM_MEMBER',
      targetId: member._id,
      targetModel: 'UniversityTeamMember',
      details: { fullName: member.fullName, registrationNumber: member.registrationNumber },
      req,
    });

    res.json({ message: 'Team member deleted successfully' });
  } catch (err) {
    console.error('Error deleting team member:', err);
    res.status(500).json({ message: err.message || 'Failed to delete team member' });
  }
});

module.exports = router;

