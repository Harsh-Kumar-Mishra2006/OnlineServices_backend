const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddleware');
const {
  // Admin functions
  createAssignment,
  getAllAssignments,
  getAssignmentById,
  cancelAssignment,
  
  // Worker functions
  getMyAssignments,
  acceptAssignment,
  rejectAssignment,
  startWork,
  completeWork,
  
  // User functions
  getUserAssignments
} = require('../controllers/assignmentController');

// ============= ADMIN ROUTES =============
router.post('/admin/create', authenticateToken, createAssignment);
router.get('/admin/all', authenticateToken, getAllAssignments);
router.get('/admin/:id', authenticateToken, getAssignmentById);
router.delete('/admin/:id/cancel', authenticateToken, cancelAssignment);

// ============= WORKER ROUTES =============
router.get('/worker/my-assignments', authenticateToken, getMyAssignments);
router.put('/worker/:id/accept', authenticateToken, acceptAssignment);
router.put('/worker/:id/reject', authenticateToken, rejectAssignment);
router.put('/worker/:id/start', authenticateToken, startWork);
router.put('/worker/:id/complete', authenticateToken, completeWork);

// ============= USER ROUTES =============
router.get('/user/my-assignments', authenticateToken, getUserAssignments);

// ============= SHARED ROUTES =============
router.get('/:id', authenticateToken, getAssignmentById);

module.exports = router;