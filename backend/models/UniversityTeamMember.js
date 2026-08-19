const mongoose = require('mongoose');

const universityTeamMemberSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    registrationNumber: { type: String, required: true, trim: true },
    faculty: { type: String, required: true, trim: true },
    position: { type: String, required: true, trim: true, default: 'Member' },
    sport: {
      type: String,
      required: true,
      default: 'badminton',
      enum: ['badminton', 'table-tennis', 'carrom'],
    },
    teamGender: {
      type: String,
      enum: ['Men', 'Women'],
      default: 'Men',
      required: true,
    },
    photo: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('UniversityTeamMember', universityTeamMemberSchema);

