//ei dhon ta code kora chilo sob thaika choda khawa 🐽🐽😝😝

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Payment = require('../models/Payment');

const router = express.Router();

const protect = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token, authorization denied' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ message: 'User not found' });
    req.user = user;
    next();
  } catch (err) {
    console.error('Protect middleware error:', err);
    return res.status(401).json({ message: 'Token is not valid' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
    return next();
  }
  return res.status(403).json({ message: 'Admin only' });
};

router.get('/users', protect, adminOnly, async (req, res) => {
  try {
    const { q, minBalance, maxBalance, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (q) {
      const re = new RegExp(q, 'i');
      filter.$or = [{ username: re }, { email: re }];
    }
    if (minBalance) filter.balance = { ...(filter.balance || {}), $gte: Number(minBalance) };
    if (maxBalance) filter.balance = { ...(filter.balance || {}), $lte: Number(maxBalance) };

    const skip = (Number(page) - 1) * Number(limit);
    const users = await User.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(Number(limit));
    const total = await User.countDocuments(filter);

    res.json({ total, page: Number(page), limit: Number(limit), users });
  } catch (err) {
    console.error('GET /admin/users', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/user/:id/balance', protect, adminOnly, async (req, res) => {
  try {
    const { amount } = req.body;
    if (typeof amount !== 'number' && isNaN(Number(amount))) {
      return res.status(400).json({ message: 'Invalid amount' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.balance = Number(amount);
    await user.save();
    res.json({ message: 'Balance set', user: { id: user._id, username: user.username, balance: user.balance } });
  } catch (err) {
    console.error('PUT /admin/user/:id/balance', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/user/:id/adjust', protect, adminOnly, async (req, res) => {
  try {
    const { delta } = req.body;
    if (typeof delta !== 'number' && isNaN(Number(delta))) {
      return res.status(400).json({ message: 'Invalid delta' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.balance = Math.max(0, user.balance + Number(delta));
    await user.save();
    res.json({ message: 'Balance adjusted', user: { id: user._id, username: user.username, balance: user.balance } });
  } catch (err) {
    console.error('PATCH /admin/user/:id/adjust', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/user/:id/role', protect, adminOnly, async (req, res) => {
  try {
    const { role } = req.body;
    if (!role) return res.status(400).json({ message: 'Missing role' });
    const allowed = ['user', 'admin', 'banned', 'suspended', 'superadmin'];
    if (!allowed.includes(role)) return res.status(400).json({ message: 'Invalid role' });

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'Role updated', user });
  } catch (err) {
    console.error('PUT /admin/user/:id/role', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/payments/pending', protect, adminOnly, async (req, res) => {
  try {
    const pending = await Payment.find({ status: 'pending' }).populate('user', 'username email balance').sort({ createdAt: -1 });
    res.json(pending);
  } catch (err) {
    console.error('GET /admin/payments/pending', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/payment/:id/approve', protect, adminOnly, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    if (payment.status === 'approved') return res.status(400).json({ message: 'Already approved' });

    payment.status = 'approved';
    await payment.save();

    const user = await User.findById(payment.user);
    if (!user) {
      // Should not happen normally eida mainly user payment er jonne
      return res.status(404).json({ message: 'Associated user not found' });
    }

    user.balance = (user.balance || 0) + Number(payment.amount);
    await user.save();

    res.json({ message: 'Payment approved and balance updated', payment, user: { id: user._id, balance: user.balance } });
  } catch (err) {
    console.error('PUT /admin/payment/:id/approve', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/payment/:id/reject', protect, adminOnly, async (req, res) => {
  try {
    const { reason } = req.body;
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    if (payment.status !== 'pending') return res.status(400).json({ message: 'Only pending payments can be rejected' });

    payment.status = 'rejected';
    payment.reference = payment.reference || '';
    payment.rejectionReason = reason || '';
    await payment.save();

    res.json({ message: 'Payment rejected', payment });
  } catch (err) {
    console.error('PUT /admin/payment/:id/reject', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/stats', protect, adminOnly, async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    const agg = await User.aggregate([{ $group: { _id: null, totalBalance: { $sum: '$balance' } } }]);
    const totalBalance = (agg[0] && agg[0].totalBalance) || 0;
    const pendingPayments = await Payment.countDocuments({ status: 'pending' });
    res.json({ userCount, totalBalance, pendingPayments });
  } catch (err) {
    console.error('GET /admin/stats', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

if (require.main === module) {
  // If the file is run directly: node backend/routes/admin.js [seed] [email] [password]
  (async () => {
    try {
      const [, , cmd, emailArg, passwordArg] = process.argv;
      if (cmd !== 'seed') {
        console.log('This file is a router. To seed an admin user run:');
        console.log('  node backend/routes/admin.js seed [email] [password]');
        process.exit(0);
      }

      require('dotenv').config();
      const uri = process.env.MONGODB_URI;
      if (!uri) {
        console.error('MONGODB_URI is not set in environment. Aborting.');
        process.exit(1);
      }

      await connectDB(uri);

      const adminEmail = emailArg || 'redwanahemed294@gmail.com';
      const adminPassword = passwordArg || 'devastinglordxemon';
      const adminUsername = adminEmail.split('@')[0];

      let admin = await User.findOne({ email: adminEmail });
      if (admin) {
        console.log(`Admin user already exists: ${adminEmail} (id: ${admin._id})`);
        process.exit(0);
      }

      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(adminPassword, salt);

      admin = new User({
        username: adminUsername,
        email: adminEmail,
        password: hashed,
        balance: 0,
        role: 'admin'
      });

      await admin.save();
      console.log(`Admin user created: ${adminEmail} with role 'admin'`);
      console.log('You can now login via /api/auth/login with these credentials.');
      process.exit(0);
    } catch (err) {
      console.error('Seeder error', err);
      process.exit(1);
    }
  })();
}
