require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const paymentRoutes = require('./routes/payments');
const gamesRoutes = require('./routes/games');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: true, 
  credentials: true
}));
app.use(express.json());


connectDB(process.env.MONGODB_URI);


app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/games', gamesRoutes);
app.use('/api/admin', adminRoutes);
app.get('/', (req, res) => res.send('Casino Platform Backend is running'));

app.listen(PORT, () => {
  console.log(`Eto Bar tor mare chudchi magir pola ${PORT}`);
});
