const express = require('express');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoute');
const userQuerryRoutes = require('./routes/userQuerryRoutes');
const workerAssignmentRoutes = require('./routes/WorkerAssignmentRoutes');
const billingRoutes = require('./routes/billingRoutes');


const app = express();
connectDB();
const path = require('path');

// Define allowed origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://onlineservices-rl5s.onrender.com'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Blocked origin:', origin);
      callback(null, false);
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length', 'X-Response-Time'],
  maxAge: 86400,
};

// Apply CORS middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug endpoint
app.get('/api/debug', (req, res) => {
  res.json({
    message: 'Backend is running!',
    registeredRoutes: {
      auth: '/api/auth',
      queries: '/api/queries',
      workerAssignments: '/api/worker/assignments'
    },
    note: 'All routes require authentication except /api/debug'
  });
});

// ============= REGISTER ROUTES =============

app.use('/api/auth', authRoutes);
app.use('/api/queries', userQuerryRoutes);
app.use('/api/worker/assignments', workerAssignmentRoutes);
app.use('/api/bills', billingRoutes);


// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 404 handler for undefined routes
app.use((req, res) => {
  console.log(`❌ Route not found: ${req.method} ${req.url}`);
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.url}`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
  console.log(`📋 CORS enabled for: ${allowedOrigins.join(', ')}`);
  console.log(`📋 Registered Routes:`);
  console.log(`   🔐 /api/auth - Authentication`);
  console.log(`   🔐 /api/queries - User Queries & Admin Management`);
  console.log(`   🔐 /api/worker/assignments - Worker Assignments`);
});