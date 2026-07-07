const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddleware');
const {
  // Admin functions
  createBill,
  getAllBills,
  getBillById,
  updateBill,
  deleteBill,
  markBillAsPaid,
  
  // User functions
  getMyBills,
  getBillSummary,
  getUserBillById
} = require('../controllers/billingController');

// ============= USER ROUTES =============
router.get('/my-bills', authenticateToken, getMyBills);
router.get('/my-bills/summary', authenticateToken, getBillSummary);
router.get('/my-bills/:id', authenticateToken, getUserBillById);

// ============= ADMIN ROUTES =============
router.post('/admin/create', authenticateToken, createBill);
router.get('/admin/all', authenticateToken, getAllBills);
router.get('/admin/:id', authenticateToken, getBillById);
router.put('/admin/:id', authenticateToken, updateBill);
router.delete('/admin/:id', authenticateToken, deleteBill);
router.put('/admin/:id/pay', authenticateToken, markBillAsPaid);

module.exports = router;