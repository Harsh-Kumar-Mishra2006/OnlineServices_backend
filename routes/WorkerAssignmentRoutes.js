const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddleware');
const {
  getMyAssignments,
  getAssignmentDetails,
  updateAssignmentStatus,
  getWorkerDashboardStats,
  submitCompletionReport
} = require('../controllers/workerAssignmentController');

// ============= WORKER ASSIGNMENT ROUTES =============

// Get all assignments for the logged-in worker
router.get('/my-assignments', authenticateToken, getMyAssignments);

// Get worker dashboard statistics
router.get('/dashboard/stats', authenticateToken, getWorkerDashboardStats);

// Get assignment details
router.get('/:id', authenticateToken, getAssignmentDetails);

// Update assignment status (in_progress, completed, etc.)
router.put('/:id/status', authenticateToken, updateAssignmentStatus);

// Submit completion report
router.post('/:id/complete', authenticateToken, submitCompletionReport);

module.exports = router;