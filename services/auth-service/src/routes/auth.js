const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authLoginsTotal, authRegistrationsTotal } = require('../metrics');

const router = express.Router();

// ─── Rate Limiters ───────────────────────────────────────────────────────────

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { message: 'Too many login attempts, please try again after 15 minutes' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { message: 'Too many accounts created from this IP, please try again after an hour' },
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { message: 'Too many refresh attempts, please try again later' },
});

// ─── Helpers ────────────────────────────────────────────────────────────────

const generateAccessToken = (payload) =>
  jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });

const generateRefreshToken = (payload) =>
  jwt.sign({ ...payload, jti: Date.now().toString() }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

const handleValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return false;
  }
  return true;
};

// ─── POST /auth/register ────────────────────────────────────────────────────

router.post(
  '/register',
  registerLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    body('role')
      .optional()
      .isIn(['CUSTOMER', 'AGENT', 'ADMIN'])
      .withMessage('Role must be CUSTOMER, AGENT, or ADMIN'),
  ],
  async (req, res) => {
    if (!handleValidation(req, res)) return;

    const { name, email, password, role } = req.body;

    try {
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(409).json({ message: 'Email already registered' });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const user = await User.create({ name, email, hashedPassword, role });
      authRegistrationsTotal.inc();
      console.log(`[register] New user created — id: ${user._id}, email: ${user.email}, role: ${user.role}`);

      return res.status(201).json({
        message: 'User registered successfully',
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
      });
    } catch (err) {
      console.error('[register]', err.message);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// ─── POST /auth/login ────────────────────────────────────────────────────────

router.post(
  '/login',
  loginLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    if (!handleValidation(req, res)) return;

    const { email, password } = req.body;

    try {
      const user = await User.findOne({ email });
      // Use the same generic message for both "not found" and "wrong password"
      // to prevent user enumeration attacks
      if (!user) {
        authLoginsTotal.inc({ result: 'failure' });
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isMatch = await bcrypt.compare(password, user.hashedPassword);
      if (!isMatch) {
        authLoginsTotal.inc({ result: 'failure' });
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      authLoginsTotal.inc({ result: 'success' });
      console.log(`[login] User authenticated — id: ${user._id}, email: ${user.email}, role: ${user.role}`);
      const payload = { userId: user._id, role: user.role };
      const accessToken = generateAccessToken(payload);
      const refreshToken = generateRefreshToken(payload);

      user.refreshToken = refreshToken;
      await user.save();

      return res.json({
        accessToken,
        refreshToken,
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
      });
    } catch (err) {
      console.error('[login]', err.message);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// ─── POST /auth/refresh ──────────────────────────────────────────────────────

router.post('/refresh', refreshLimiter, async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token is required' });
  }

  try {
    // Step 1: verify the token is structurally valid and not expired
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Step 2: check the token matches what's stored in DB (detects token reuse after rotation)
    const user = await User.findById(decoded.userId);
    if (!user || user.refreshToken !== refreshToken) {
      // Possible token reuse attack — invalidate all sessions for safety
      if (user) {
        user.refreshToken = null;
        await user.save();
      }
      return res.status(401).json({ message: 'Invalid or reused refresh token' });
    }

    // Step 3: issue a completely new token pair (rotation)
    const payload = { userId: user._id, role: user.role };
    const newAccessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    user.refreshToken = newRefreshToken;
    await user.save();

    return res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch {
    return res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
});

// ─── POST /auth/logout ───────────────────────────────────────────────────────

router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token is required' });
  }

  try {
    const user = await User.findOne({ refreshToken });
    if (user) {
      user.refreshToken = null;
      await user.save();
    }
    // Always return 200 — don't reveal whether the token existed
    return res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('[logout]', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
