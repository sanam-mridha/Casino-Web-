const express = require('express');
const auth = require('../middleware/auth');
const Payment = require('../models/Payment');

const router = express.Router();

/**
 * @route POST /api/payments/request
 * @desc  Create a payment (manual top-up request)
 * @body  { amount, method, reference }
 */
router.post('/request', auth, async (req, res) => {
  try {
    const { amount, method, reference } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid amount' });

    const payment = new Payment({
      user: req.user._id,
      amount,
      method: method || 'Manual',
      reference: reference || ''
    });
    await payment.save();
    res.status(201).json({ message: 'Payment request created', payment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/payments/my
 * @desc  Get current user's payment requests
 */
router.get('/my', auth, async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(payments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
