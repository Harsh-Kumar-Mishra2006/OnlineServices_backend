const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddleware');
const {
  // User functions
  createQuery,
  getMyQueries,
  getQueryById,
  updateQuery,
  cancelQuery,
  submitRating,
  
  // Admin functions
  getAllQueries,
  assignWorker,
  updateQueryStatus,
  getPendingQueriesCount,
  getAvailableWorkersForQuery,

  getAllAssignments,
  getWorkerAssignments,
  reassignWorker,
  getAssignmentStats
} = require('../controllers/userQuerryController');

// ============= USER ROUTES (authenticated users) =============
router.post('/create', authenticateToken, createQuery);
router.get('/my-queries', authenticateToken, getMyQueries);
router.get('/:id', authenticateToken, getQueryById);
router.put('/:id', authenticateToken, updateQuery);
router.delete('/:id', authenticateToken, cancelQuery);
router.post('/:id/rating', authenticateToken, submitRating);

// ============= ADMIN ROUTES =============
router.get('/admin/all', authenticateToken, getAllQueries);
router.post('/admin/:id/assign', authenticateToken, assignWorker);
router.put('/admin/:id/status', authenticateToken, updateQueryStatus);
router.get('/admin/dashboard/counts', authenticateToken, getPendingQueriesCount);
router.get('/admin/:id/available-workers', authenticateToken, getAvailableWorkersForQuery);

// Add these routes
router.get('/admin/assignments/all', authenticateToken, getAllAssignments);
router.get('/admin/assignments/worker/:workerId', authenticateToken, getWorkerAssignments);
router.get('/admin/assignments/stats', authenticateToken, getAssignmentStats);
router.put('/admin/assignments/:id/reassign', authenticateToken, reassignWorker);

module.exports = router;