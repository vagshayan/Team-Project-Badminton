const rateLimit = require('express-rate-limit');

/**
 * Login rate limiter
 * 5 attempts per 15 minutes per IP
 * Prevents brute-force password attacks
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts. Please try again after 15 minutes.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  keyGenerator: (req, res) => {
    // Rate limit per IP address + username combination
    return `${req.ip}-${(req.body?.username || 'unknown').toLowerCase()}`;
  },
  skip: (req, res) => {
    // Don't rate limit if req.body doesn't have username
    return !req.body?.username;
  },
  handler: (req, res) => {
    res.status(429).json({
      message: 'Too many login attempts. Please try again after 15 minutes.',
    });
  },
});

/**
 * Forgot-password rate limiter
 * 5 attempts per 30 minutes per IP
 * Prevents username enumeration and brute force
 */
const forgotPasswordLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 5, // 5 attempts
  message: 'Too many password reset attempts. Please try again after 30 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    // Rate limit per IP + username
    return `${req.ip}-${(req.body?.username || 'unknown').toLowerCase()}`;
  },
  skip: (req, res) => {
    return !req.body?.username;
  },
  handler: (req, res) => {
    res.status(429).json({
      message: 'Too many password reset attempts. Please try again after 30 minutes.',
    });
  },
});

/**
 * Reset-password rate limiter
 * 3 attempts per 30 minutes per IP
 * Prevents brute-force security answer guessing
 * Stricter than forgot-password since it involves sensitive action
 */
const resetPasswordLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 3, // 3 attempts (strict - security answer guessing)
  message: 'Too many reset attempts. Please try again after 30 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    // Rate limit per IP + username + attempt to reset specific account
    return `${req.ip}-${(req.body?.username || 'unknown').toLowerCase()}`;
  },
  skip: (req, res) => {
    return !req.body?.username;
  },
  handler: (req, res) => {
    res.status(429).json({
      message: 'Too many reset attempts. Please try again after 30 minutes.',
    });
  },
});

const publicRegistrationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many registration attempts. Please try again after 1 minute.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      message: 'Too many registration attempts. Please try again after 1 minute.',
    });
  },
});

const publicPartnerLookupLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many partner lookup attempts. Please try again after 1 minute.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      message: 'Too many partner lookup attempts. Please try again after 1 minute.',
    });
  },
});

module.exports = {
  loginLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  publicRegistrationLimiter,
  publicPartnerLookupLimiter,
};
