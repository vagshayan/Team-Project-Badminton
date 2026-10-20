const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const JWT_SECRET = process.env.JWT_SECRET;

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.status(401).json({ message: 'Not authorized, no token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = await Admin.findOne({ _id: decoded.id, isDeleted: { $ne: true } }).select('id username email emailVerified name sport avatarUrl role');
    if (!req.admin) return res.status(401).json({ message: 'Admin not found' });
    if (req.admin.emailVerified !== true) return res.status(403).json({ message: 'Email verification is required.' });
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token is invalid or expired' });
  }
};

const requireSuperAdmin = (req, res, next) => {
  if (!req.admin) return res.status(401).json({ message: 'Unauthorized' });
  if (req.admin.role !== 'super_admin') {
    return res.status(403).json({ message: 'Forbidden: super-admin access required' });
  }
  next();
};

module.exports = { protect, requireSuperAdmin };