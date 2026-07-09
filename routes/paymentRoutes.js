const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddleware');
const multer = require('multer');
const {
  initiatePayment,
  getMyPayments,
  getPaymentById,
  getAllPayments,
  verifyPayment,
  getPaymentDetails,
  deletePayment
} = require('../controllers/paymentController');

// Multer configuration for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, `payment-${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// ============= USER ROUTES =============
router.post('/initiate', authenticateToken, upload.single('screenshot'), initiatePayment);
router.get('/my-payments', authenticateToken, getMyPayments);
router.get('/my-payments/:id', authenticateToken, getPaymentById);

// ============= ADMIN ROUTES =============
router.get('/admin/all', authenticateToken, getAllPayments);
router.get('/admin/:id', authenticateToken, getPaymentDetails);
router.put('/admin/:id/verify', authenticateToken, verifyPayment);
router.delete('/admin/:id', authenticateToken, deletePayment);

module.exports = router;