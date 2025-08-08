
const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

/**
 * @route POST /api/games/play
 * @desc  Process a game result and update user's balance
 * @body  { betAmount, outcome, payoutMultiplier }
 *
 * outcome: 'win' | 'lose' | 'push'  (push means tie / refund)
 * payoutMultiplier: number (e.g., 2 for double payout, 1.5 for 3:2 blackjack, etc.)
 *
 * Notes:
 * - This endpoint expects the frontend to send the *final verified outcome* after client-side simulation.
 * - In production, move critical RNG & outcome resolution to server-side to avoid cheating.
 */
router.post('/play', auth, async (req, res) => {
  try {
    const { betAmount, outcome, payoutMultiplier } = req.body;
    if (!betAmount || betAmount <= 0) return res.status(400).json({ message: 'Invalid bet amount' });
    if (!['win', 'lose', 'push'].includes(outcome)) return res.status(400).json({ message: 'Invalid outcome' });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.balance < betAmount) return res.status(400).json({ message: 'Insufficient balance' });

    let change = 0;
    if (outcome === 'win') {
      const multiplier = typeof payoutMultiplier === 'number' && payoutMultiplier > 0 ? payoutMultiplier : 2;
      change = Math.round(betAmount * (multiplier - 1));
      user.balance += change;
    } else if (outcome === 'lose') {
      user.balance -= betAmount;
      change = -betAmount;
    } else if (outcome === 'push') {
      change = 0;
    }

    await user.save();
    return res.json({ message: 'Result processed', balance: user.balance, change });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
