const mongoose = require('mongoose');

const DailyTasksSchema = new mongoose.Schema({
  lastReset: { type: Date, default: new Date(0) },
  playsToday: { type: Number, default: 0 },
  freePlaysPerDay: { type: Number, default: 2 }
});

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  balance: { type: Number, default: 1000 },
  dailyTasks: { type: DailyTasksSchema, default: () => ({}) },
  role: {
    type: String,
    enum: ['user', 'admin', 'banned', 'suspended'],
    default: 'user'
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
