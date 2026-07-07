const Bill = require('../models/Bill');
const UserQuery = require('../models/userQuerry');
const Auth = require('../models/authModel');
const Worker = require('../models/addWorker');
const mongoose = require('mongoose');

// ============= ADMIN FUNCTIONS =============

// Create a new bill for a completed query
const createBill = async (req, res) => {
  try {
    const {
      query_id,
      items,
      tax_rate,
      discount,
      discount_type,
      due_date,
      notes,
      terms_conditions
    } = req.body;

    // Validate required fields
    if (!query_id) {
      return res.status(400).json({
        success: false,
        error: 'Query ID is required'
      });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one billing item is required'
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
        error: 'Only admins can create bills'
      });
    }

    // Get the query
    const query = await UserQuery.findById(query_id)
      .populate('user', 'name email phone')
      .populate('assigned_to', 'name service_type phone_number');

    if (!query) {
      return res.status(404).json({
        success: false,
        error: 'Query not found'
      });
    }

    // Check if query is completed
    if (query.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Bills can only be created for completed services'
      });
    }

    // Check if a bill already exists for this query
    const existingBill = await Bill.findOne({ query: query_id });
    if (existingBill) {
      return res.status(400).json({
        success: false,
        error: 'A bill already exists for this query'
      });
    }

    // Calculate totals
    let subtotal = 0;
    const processedItems = items.map(item => {
      const amount = (item.quantity || 1) * (item.rate || 0);
      subtotal += amount;
      return {
        description: item.description,
        quantity: item.quantity || 1,
        rate: item.rate || 0,
        amount: amount
      };
    });

    // Calculate tax
    const taxRate = tax_rate || 0;
    const tax = (subtotal * taxRate) / 100;

    // Calculate discount
    let discountAmount = 0;
    if (discount && discount > 0) {
      if (discount_type === 'percentage') {
        discountAmount = (subtotal * discount) / 100;
      } else {
        discountAmount = discount;
      }
    }

    const totalAmount = subtotal + tax - discountAmount;

    // Generate bill number
    const billNumber = await Bill.generateBillNumber();

    // Create bill
    const bill = await Bill.create({
      query: query_id,
      user: query.user._id,
      worker: query.assigned_to._id,
      bill_number: billNumber,
      service_type: query.service_type_required,
      service_description: query.issue,
      items: processedItems,
      subtotal: subtotal,
      tax: tax,
      tax_rate: taxRate,
      discount: discountAmount,
      discount_type: discount_type || 'fixed',
      total_amount: totalAmount,
      due_date: due_date || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days default
      notes: notes || '',
      terms_conditions: terms_conditions || 'Payment is due within 15 days. Late payments may incur additional charges.',
      created_by: admin._id
    });

    console.log(`✅ Bill created: ${billNumber} for user ${query.user.email}`);

    res.status(201).json({
      success: true,
      message: 'Bill created successfully',
      data: bill
    });

  } catch (error) {
    console.error('Error creating bill:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get all bills (Admin)
const getAllBills = async (req, res) => {
  try {
    const {
      status,
      user_id,
      query_id,
      date_from,
      date_to,
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    let query = { is_deleted: false };

    // Filters
    if (status) query.payment_status = status;
    if (user_id) query.user = user_id;
    if (query_id) query.query = query_id;
    
    if (date_from || date_to) {
      query.created_at = {};
      if (date_from) query.created_at.$gte = new Date(date_from);
      if (date_to) query.created_at.$lte = new Date(date_to);
    }

    // Sorting
    let sort = {};
    sort[sort_by] = sort_order === 'desc' ? -1 : 1;

    const bills = await Bill.find(query)
      .populate('user', 'name email phone')
      .populate('worker', 'name service_type phone_number')
      .populate('query', 'issue service_type_required status')
      .populate('created_by', 'name email')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Bill.countDocuments(query);

    // Summary statistics
    const summary = {
      total_bills: await Bill.countDocuments({ is_deleted: false }),
      pending: await Bill.countDocuments({ payment_status: 'pending', is_deleted: false }),
      paid: await Bill.countDocuments({ payment_status: 'paid', is_deleted: false }),
      overdue: await Bill.countDocuments({ payment_status: 'overdue', is_deleted: false }),
      total_amount: await Bill.aggregate([
        { $match: { is_deleted: false } },
        { $group: { _id: null, total: { $sum: '$total_amount' } } }
      ])
    };

    res.json({
      success: true,
      data: bills,
      summary,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      total
    });

  } catch (error) {
    console.error('Error fetching bills:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get bill by ID (Admin/User)
const getBillById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid bill ID'
      });
    }

    const bill = await Bill.findById(id)
      .populate('user', 'name email phone address')
      .populate('worker', 'name service_type phone_number rating')
      .populate('query', 'issue service_type_required status created_at')
      .populate('created_by', 'name email');

    if (!bill || bill.is_deleted) {
      return res.status(404).json({
        success: false,
        error: 'Bill not found'
      });
    }

    // Check authorization
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, 'mypassword');
    const user = await Auth.findById(decoded.userId);

    if (bill.user._id.toString() !== decoded.userId && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only view your own bills.'
      });
    }

    res.json({
      success: true,
      data: bill
    });

  } catch (error) {
    console.error('Error fetching bill:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Update bill (Admin)
const updateBill = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const bill = await Bill.findById(id);
    if (!bill || bill.is_deleted) {
      return res.status(404).json({
        success: false,
        error: 'Bill not found'
      });
    }

    // Check if bill is already paid
    if (bill.payment_status === 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Cannot update a paid bill'
      });
    }

    // Allowed fields for update
    const allowedUpdates = ['items', 'tax_rate', 'discount', 'discount_type', 'due_date', 'notes', 'terms_conditions'];
    
    // Recalculate totals if items, tax, or discount changes
    let recalculate = false;
    let subtotal = bill.subtotal;
    let tax = bill.tax;
    let discount = bill.discount;
    let totalAmount = bill.total_amount;

    if (updates.items) {
      subtotal = 0;
      updates.items = updates.items.map(item => {
        const amount = (item.quantity || 1) * (item.rate || 0);
        subtotal += amount;
        return {
          description: item.description,
          quantity: item.quantity || 1,
          rate: item.rate || 0,
          amount: amount
        };
      });
      recalculate = true;
    }

    if (updates.tax_rate !== undefined) {
      tax = (subtotal * updates.tax_rate) / 100;
      recalculate = true;
    }

    if (updates.discount !== undefined) {
      const discountType = updates.discount_type || bill.discount_type;
      if (discountType === 'percentage') {
        discount = (subtotal * updates.discount) / 100;
      } else {
        discount = updates.discount;
      }
      recalculate = true;
    }

    if (recalculate) {
      totalAmount = subtotal + tax - discount;
    }

    // Apply updates
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        bill[field] = updates[field];
      }
    });

    if (recalculate) {
      bill.subtotal = subtotal;
      bill.tax = tax;
      bill.discount = discount;
      bill.total_amount = totalAmount;
    }

    bill.updated_at = new Date();
    await bill.save();

    res.json({
      success: true,
      message: 'Bill updated successfully',
      data: bill
    });

  } catch (error) {
    console.error('Error updating bill:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Delete bill (Admin - soft delete)
const deleteBill = async (req, res) => {
  try {
    const { id } = req.params;

    const bill = await Bill.findById(id);
    if (!bill) {
      return res.status(404).json({
        success: false,
        error: 'Bill not found'
      });
    }

    if (bill.payment_status === 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete a paid bill'
      });
    }

    bill.is_deleted = true;
    bill.updated_at = new Date();
    await bill.save();

    res.json({
      success: true,
      message: 'Bill deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting bill:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Mark bill as paid (Admin)
const markBillAsPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_method, payment_transaction_id } = req.body;

    const bill = await Bill.findById(id);
    if (!bill || bill.is_deleted) {
      return res.status(404).json({
        success: false,
        error: 'Bill not found'
      });
    }

    if (bill.payment_status === 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Bill is already paid'
      });
    }

    await bill.markAsPaid(payment_method, payment_transaction_id);

    res.json({
      success: true,
      message: 'Bill marked as paid successfully',
      data: bill
    });

  } catch (error) {
    console.error('Error marking bill as paid:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ============= USER FUNCTIONS =============

// Get user's bills (User)
const getMyBills = async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, 'mypassword');

    const { status, page = 1, limit = 10 } = req.query;

    let query = { user: decoded.userId, is_deleted: false };
    if (status) query.payment_status = status;

    const bills = await Bill.find(query)
      .populate('query', 'issue service_type_required status')
      .populate('worker', 'name service_type')
      .sort({ created_at: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Bill.countDocuments(query);

    // Get summary
    const summary = {
      total_bills: total,
      total_pending: await Bill.countDocuments({ 
        user: decoded.userId, 
        payment_status: 'pending',
        is_deleted: false 
      }),
      total_paid: await Bill.countDocuments({ 
        user: decoded.userId, 
        payment_status: 'paid',
        is_deleted: false 
      }),
      total_overdue: await Bill.countDocuments({ 
        user: decoded.userId, 
        payment_status: 'overdue',
        is_deleted: false 
      })
    };

    res.json({
      success: true,
      data: bills,
      summary,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      total
    });

  } catch (error) {
    console.error('Error fetching user bills:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get bill summary for user dashboard
const getBillSummary = async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, 'mypassword');

    const userId = decoded.userId;

    const totalBills = await Bill.countDocuments({ user: userId, is_deleted: false });
    const pendingBills = await Bill.countDocuments({ user: userId, payment_status: 'pending', is_deleted: false });
    const paidBills = await Bill.countDocuments({ user: userId, payment_status: 'paid', is_deleted: false });
    const overdueBills = await Bill.countDocuments({ user: userId, payment_status: 'overdue', is_deleted: false });

    // Get total amount due
    const result = await Bill.aggregate([
      {
        $match: { 
          user: new mongoose.Types.ObjectId(userId),
          payment_status: { $in: ['pending', 'overdue'] },
          is_deleted: false 
        }
      },
      {
        $group: {
          _id: null,
          total_due: { $sum: '$total_amount' }
        }
      }
    ]);

    const totalDue = result.length > 0 ? result[0].total_due : 0;

    // Get recent bills (last 5)
    const recentBills = await Bill.find({ user: userId, is_deleted: false })
      .populate('query', 'service_type_required')
      .sort({ created_at: -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        total_bills: totalBills,
        pending: pendingBills,
        paid: paidBills,
        overdue: overdueBills,
        total_amount_due: totalDue,
        recent_bills: recentBills
      }
    });

  } catch (error) {
    console.error('Error fetching bill summary:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get bill details for user
const getUserBillById = async (req, res) => {
  try {
    const { id } = req.params;

    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, 'mypassword');

    const bill = await Bill.findOne({ 
      _id: id, 
      user: decoded.userId,
      is_deleted: false 
    })
      .populate('user', 'name email phone address')
      .populate('worker', 'name service_type phone_number rating')
      .populate('query', 'issue service_type_required status created_at')
      .populate('created_by', 'name email');

    if (!bill) {
      return res.status(404).json({
        success: false,
        error: 'Bill not found'
      });
    }

    res.json({
      success: true,
      data: bill
    });

  } catch (error) {
    console.error('Error fetching bill:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = {
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
};