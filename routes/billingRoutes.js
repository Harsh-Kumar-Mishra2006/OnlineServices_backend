// routes/billingRoutes.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddleware');
const {
  createBill,
  getAllBills,
  getBillById,
  updateBill,
  deleteBill,
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

module.exports = router;