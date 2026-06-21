const express = require('express');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoute');
const assignmentRoutes = require('./routes/assignmentRoutes');
const userQuerryRoutes = require('./routes/userQuerryRoutes');

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
    // Allow requests with no origin (like mobile apps, curl, etc)
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

// Apply CORS middleware - this automatically handles OPTIONS requests
app.use(cors(corsOptions));

// Remove this line - it's causing the error:
// app.options('*', cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add this after app.use(express.urlencoded...)
app.get('/api/debug', (req, res) => {
  res.json({
    message: 'Backend is running!',
    registeredRoutes: [
      '/api/auth',
      '/api/assignments',
      '/api/queries'
    ]
  });
});

// Also add a test endpoint for assignments
app.get('/api/assignments/test', (req, res) => {
  res.json({ message: 'Assignments route is working!' });
});
// Your routes
app.use('/api/auth', authRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/queries', userQuerryRoutes);
app.use('/api/assignments', assignmentRoutes);

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`CORS enabled for: ${allowedOrigins.join(', ')}`);
});