require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

const workerRoutes = require('./routes/workerRoutes');
app.use('/api/workers', workerRoutes);

const jobRoutes = require('./routes/jobRoutes');
app.use('/api/jobs', jobRoutes);

const attendanceRoutes = require('./routes/attendanceRoutes');
app.use('/api/attendance', attendanceRoutes);

const salaryRoutes = require('./routes/salaryRoutes');
app.use('/api/salary', salaryRoutes);

const contractRoutes = require('./routes/contractRoutes');
app.use('/api/contracts', contractRoutes);

const chatRoutes = require('./routes/chatRoutes');
app.use('/api/chat', chatRoutes);

// Home route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 KaamKaro Backend is running!'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err.message);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const { initSocket } = require('./utils/socket');
initSocket(server);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 KaamKaro Backend running on port ${PORT}`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`💬 Socket.io ready for real time chat!`);
});

module.exports = app;