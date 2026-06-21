const express = require('express');
const { 
  login, 
  signup, 
  logout, 
  getProfile, 
  debugToken,
  checkWorkerAuthorization,
  createWorkerByAdmin,
  getAllWorkers,
  getWorkerById,
  updateWorkerProfile,
  getAllWorkersForAdmin,
  updateWorkerStatus,
  deleteWorker
} = require('../controllers/authController');
const authenticateToken = require('../middlewares/authMiddleware');
const router = express.Router();

// PUBLIC ROUTES (no authentication required)
router.post('/login', login);
router.post('/signup', signup);
router.post('/logout', logout);
router.get('/workers', getAllWorkers); // Users can browse workers
router.get('/workers/:id', getWorkerById); // Get specific worker details

// PROTECTED ROUTES (authentication required)
router.get('/profile', authenticateToken, getProfile);
router.get('/debug-token', authenticateToken, debugToken);
router.get('/check-worker', authenticateToken, checkWorkerAuthorization);

// ADMIN ONLY ROUTES
router.post('/admin/create-worker', authenticateToken, createWorkerByAdmin);
router.get('/admin/workers', authenticateToken, getAllWorkersForAdmin);
router.put('/admin/workers/:id/status', authenticateToken, updateWorkerStatus);
router.delete('/admin/workers/:id', authenticateToken, deleteWorker);

// WORKER ONLY ROUTES
router.put('/worker/profile', authenticateToken, updateWorkerProfile);

module.exports = router;