// controllers/paymentController.js
const Payment = require('../models/Payment');
const Bill = require('../models/Bill');
const Auth = require('../models/authModel');
const cloudinary = require('../config/cloudinary');
const mongoose = require('mongoose');

// ============= USER FUNCTIONS =============

// Initiate payment - Upload screenshot
const initiatePayment = async (req, res) => {
  try {
    const { bill_id, user_notes } = req.body;
    const file = req.file;

    console.log('📝 Initiating payment for bill:', bill_id);
    console.log('📎 File received:', file ? file.originalname : 'No file');

    if (!bill_id) {
      return res.status(400).json({
        success: false,
        error: 'Bill ID is required'
      });
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'Payment screenshot is required'
      });
    }

    // Get user info
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, 'mypassword');
    const user = await Auth.findById(decoded.userId);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Get bill
    const bill = await Bill.findById(bill_id);
    if (!bill) {
      return res.status(404).json({ success: false, error: 'Bill not found' });
    }

    // Check if bill belongs to user
    if (bill.customer_email !== user.email) {
      return res.status(403).json({
        success: false,
        error: 'You can only pay for your own bills'
      });
    }

    // Check if bill already has a payment
    if (bill.is_paid) {
      return res.status(400).json({
        success: false,
        error: 'This bill has already been paid'
      });
    }

    // Check if payment already exists
    const existingPayment = await Payment.findOne({ bill: bill_id });
    if (existingPayment) {
      return res.status(400).json({
        success: false,
        error: 'Payment already submitted for this bill'
      });
    }

    // Upload to Cloudinary
    console.log('📤 Uploading to Cloudinary...');
    const result = await cloudinary.uploader.upload(file.path, {
      folder: 'payments',
      resource_type: 'image',
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp']
    });
    console.log('✅ Cloudinary upload successful:', result.secure_url);

    // Create payment record
    const payment = await Payment.create({
      bill: bill_id,
      user: user._id,
      payment_amount: bill.total_amount,
      payment_screenshot: {
        public_id: result.public_id,
        url: result.secure_url
      },
      user_notes: user_notes || ''
    });

    console.log(`✅ Payment initiated for bill ${bill.bill_number} by user ${user.email}`);

    res.status(201).json({
      success: true,
      message: 'Payment submitted successfully! Please wait for admin verification.',
      data: payment
    });

  } catch (error) {
    console.error('❌ Error initiating payment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get user's payments
const getMyPayments = async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, 'mypassword');

    const { page = 1, limit = 10 } = req.query;

    console.log('🔍 Fetching payments for user:', decoded.userId);

    const payments = await Payment.find({ user: decoded.userId })
      .populate('bill', 'bill_number total_amount service_type')
      .sort({ created_at: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments({ user: decoded.userId });

    // Get summary
    const summary = {
      total_payments: total,
      pending: await Payment.countDocuments({ 
        user: decoded.userId, 
        status: 'pending' 
      }),
      verified: await Payment.countDocuments({ 
        user: decoded.userId, 
        status: 'verified' 
      }),
      rejected: await Payment.countDocuments({ 
        user: decoded.userId, 
        status: 'rejected' 
      })
    };

    console.log(`✅ Found ${payments.length} payments for user`);

    res.json({
      success: true,
      data: payments,
      summary,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      total
    });

  } catch (error) {
    console.error('❌ Error fetching payments:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get payment by ID (User)
const getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;

    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, 'mypassword');

    const payment = await Payment.findOne({ 
      _id: id, 
      user: decoded.userId 
    })
      .populate('bill', 'bill_number total_amount service_type customer_name')
      .populate('verified_by', 'name email');

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    res.json({
      success: true,
      data: payment
    });

  } catch (error) {
    console.error('❌ Error fetching payment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ============= ADMIN FUNCTIONS =============

// Get all payments (Admin)
const getAllPayments = async (req, res) => {
  try {
    const { 
      status, 
      page = 1, 
      limit = 20,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    let query = {};
    if (status) query.status = status;

    let sort = {};
    sort[sort_by] = sort_order === 'desc' ? -1 : 1;

    console.log('🔍 Fetching all payments with filters:', { status, page, limit });

    const payments = await Payment.find(query)
      .populate('user', 'name email phone')
      .populate('bill', 'bill_number total_amount service_type customer_name')
      .populate('verified_by', 'name email')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments(query);

    // Summary statistics
    const summary = {
      total_payments: await Payment.countDocuments(),
      pending: await Payment.countDocuments({ status: 'pending' }),
      verified: await Payment.countDocuments({ status: 'verified' }),
      rejected: await Payment.countDocuments({ status: 'rejected' })
    };

    console.log(`✅ Found ${payments.length} payments`);

    res.json({
      success: true,
      data: payments,
      summary,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      total
    });

  } catch (error) {
    console.error('❌ Error fetching payments:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Verify payment (Admin)
const verifyPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, verification_notes } = req.body;

    if (!status || !['verified', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status must be "verified" or "rejected"'
      });
    }

    // Get admin info
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, 'mypassword');
    const admin = await Auth.findById(decoded.userId);

    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admins can verify payments'
      });
    }

    console.log(`🔍 Verifying payment ${id} as ${status}`);

    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    if (payment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Payment already ${payment.status}`
      });
    }

    // Update payment
    payment.status = status;
    payment.verified_by = admin._id;
    payment.verified_at = new Date();
    payment.verification_notes = verification_notes || '';
    payment.updated_at = new Date();
    await payment.save();

    // If verified, update bill
    if (status === 'verified') {
      const updatedBill = await Bill.findByIdAndUpdate(
        payment.bill,
        {
          is_paid: true,
          payment: payment._id
        },
        { new: true }
      );
      console.log(`✅ Bill ${updatedBill.bill_number} marked as paid`);
    }

    console.log(`✅ Payment ${status} by admin ${admin.email}`);

    res.json({
      success: true,
      message: `Payment ${status} successfully`,
      data: payment
    });

  } catch (error) {
    console.error('❌ Error verifying payment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get payment details (Admin)
const getPaymentDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findById(id)
      .populate('user', 'name email phone')
      .populate('bill', 'bill_number total_amount service_type customer_name customer_email')
      .populate('verified_by', 'name email');

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    res.json({
      success: true,
      data: payment
    });

  } catch (error) {
    console.error('❌ Error fetching payment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Delete payment (Admin)
const deletePayment = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(payment.payment_screenshot.public_id);

    await payment.deleteOne();

    res.json({
      success: true,
      message: 'Payment deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting payment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = {
  // User functions
  initiatePayment,
  getMyPayments,
  getPaymentById,
  
  // Admin functions
  getAllPayments,
  verifyPayment,
  getPaymentDetails,
  deletePayment
};