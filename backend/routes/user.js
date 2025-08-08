const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

/**
 * @route   GET /api/user/me
 * @desc    Get current user (protected)
 */
router.get('/me', auth, async (req, res) => {
  try {
    
    res.json(req.user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PUT /api/user/update
 * @desc    Update profile (username or email)
 * @body    { username?, email? }
 */
router.put('/update', auth, async (req, res) => {
  try {
    const { username, email } = req.body;
    const updates = {};
    if (username) updates.username = username;
    if (email) updates.email = email;

    const updated = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true }).select('-password');
    res.json(updated);
  } catch (err) {
    console.error(err);
    
    if (err.code === 11000) return res.status(400).json({ message: 'Username or email already taken' });
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
