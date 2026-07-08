// controllers/billingController.js
const Bill = require('../models/Bill');
const Auth = require('../models/authModel');
const mongoose = require('mongoose');

// ============= ADMIN FUNCTIONS =============

// Create a new bill (Manual Entry)
const createBill = async (req, res) => {
  try {
    const {
      customer_name,
      customer_email,
      customer_phone,
      customer_address,
      service_type,
      service_description,
      worker_name,
      worker_phone,
      items,
      discount,
      notes
    } = req.body;

    // Validate required fields
    if (!customer_name || !customer_email || !customer_phone) {
      return res.status(400).json({
        success: false,
        error: 'Customer name, email, and phone are required'
      });
    }

    if (!service_type || !service_description) {
      return res.status(400).json({
        success: false,
        error: 'Service type and description are required'
      });
    }

    if (!worker_name || !worker_phone) {
      return res.status(400).json({
        success: false,
        error: 'Worker name and phone are required'
      });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one billing item is required'
      });
    }

    // Validate items
    const invalidItems = items.some(item => !item.description || !item.rate || item.rate <= 0);
    if (invalidItems) {
      return res.status(400).json({
        success: false,
        error: 'All items must have description and valid rate'
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

    const discountAmount = discount || 0;
    const totalAmount = subtotal - discountAmount;

    // Generate bill number
    const billNumber = await Bill.generateBillNumber();

    // Create bill
    const bill = await Bill.create({
      bill_number: billNumber,
      customer_name,
      customer_email,
      customer_phone,
      customer_address: customer_address || {},
      service_type,
      service_description,
      worker_name,
      worker_phone,
      items: processedItems,
      subtotal: subtotal,
      discount: discountAmount,
      total_amount: totalAmount,
      notes: notes || '',
      created_by: admin._id
    });

    console.log(`✅ Bill created: ${billNumber} by admin ${admin.email}`);

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
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    let query = { is_deleted: false };

    // Sorting
    let sort = {};
    sort[sort_by] = sort_order === 'desc' ? -1 : 1;

    const bills = await Bill.find(query)
      .populate('created_by', 'name email')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Bill.countDocuments(query);

    // Summary statistics
    const summary = {
      total_bills: await Bill.countDocuments({ is_deleted: false }),
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

// Get bill by ID
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
      .populate('created_by', 'name email');

    if (!bill || bill.is_deleted) {
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

    // Allowed fields for update
    const allowedUpdates = [
      'customer_name', 'customer_email', 'customer_phone', 'customer_address',
      'service_type', 'service_description',
      'worker_name', 'worker_phone',
      'items', 'discount', 'notes'
    ];

    let recalculate = false;
    let subtotal = bill.subtotal;

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

    // Apply updates
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        bill[field] = updates[field];
      }
    });

    if (recalculate) {
      bill.subtotal = subtotal;
      bill.total_amount = subtotal - (bill.discount || 0);
    }

    if (updates.discount !== undefined) {
      bill.total_amount = bill.subtotal - (updates.discount || 0);
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

// ============= USER FUNCTIONS =============

// Get user's bills (by email)
const getMyBills = async (req, res) => {
  try {
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

    const { page = 1, limit = 10 } = req.query;

    let query = { 
      customer_email: user.email,
      is_deleted: false 
    };

    const bills = await Bill.find(query)
      .sort({ created_at: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Bill.countDocuments(query);

    // Get summary
    const summary = {
      total_bills: total,
      total_amount: await Bill.aggregate([
        { 
          $match: { 
            customer_email: user.email,
            is_deleted: false 
          } 
        },
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
    
    const user = await Auth.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const totalBills = await Bill.countDocuments({ 
      customer_email: user.email, 
      is_deleted: false 
    });

    // Get total amount
    const result = await Bill.aggregate([
      {
        $match: { 
          customer_email: user.email,
          is_deleted: false 
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$total_amount' }
        }
      }
    ]);

    const totalAmount = result.length > 0 ? result[0].total : 0;

    // Get recent bills (last 5)
    const recentBills = await Bill.find({ 
      customer_email: user.email, 
      is_deleted: false 
    })
      .sort({ created_at: -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        total_bills: totalBills,
        total_amount: totalAmount,
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
    
    const user = await Auth.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const bill = await Bill.findOne({ 
      _id: id, 
      customer_email: user.email,
      is_deleted: false 
    });

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
  
  // User functions
  getMyBills,
  getBillSummary,
  getUserBillById
};