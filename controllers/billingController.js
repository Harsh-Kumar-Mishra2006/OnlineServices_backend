// controllers/billingController.js
const Bill = require('../models/Bill');
const Auth = require('../models/authModel');
const mongoose = require('mongoose');
const cloudinary = require('../config/cloudinary');
const multer = require('multer');
const path = require('path');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Helper function to upload QR code image to Cloudinary
const uploadQRCodeImage = async (file) => {
  try {
    if (!file) return null;
    
    // Convert buffer to base64
    const b64 = Buffer.from(file.buffer).toString('base64');
    const dataURI = `data:${file.mimetype};base64,${b64}`;
    
    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: 'billing/qr_codes',
      public_id: `qr_${Date.now()}`,
      resource_type: 'image'
    });
    
    return result.secure_url;
  } catch (error) {
    console.error('Error uploading QR code:', error);
    throw new Error('Failed to upload QR code image');
  }
};

// ============= ADMIN FUNCTIONS =============

// Create a new bill with QR code image upload
const createBill = async (req, res) => {
  try {
    // Access the uploaded file
    const qrCodeFile = req.file;
    
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

    // Parse items if it's a string (from form-data)
    let parsedItems = items;
    if (typeof items === 'string') {
      try {
        parsedItems = JSON.parse(items);
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: 'Invalid items format'
        });
      }
    }

    // Parse customer_address if it's a string
    let parsedAddress = customer_address;
    if (typeof customer_address === 'string') {
      try {
        parsedAddress = JSON.parse(customer_address);
      } catch (e) {
        parsedAddress = {};
      }
    }

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

    if (!parsedItems || parsedItems.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one billing item is required'
      });
    }

    // Validate items
    const invalidItems = parsedItems.some(item => !item.description || !item.rate || item.rate <= 0);
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
    const processedItems = parsedItems.map(item => {
      const amount = (item.quantity || 1) * (item.rate || 0);
      subtotal += amount;
      return {
        description: item.description,
        quantity: item.quantity || 1,
        rate: item.rate || 0,
        amount: amount
      };
    });

    const discountAmount = parseFloat(discount) || 0;
    const totalAmount = subtotal - discountAmount;

    // Generate bill number
    const billNumber = await Bill.generateBillNumber();

    // Upload QR code image if provided
    let qrCodeUrl = null;
    if (qrCodeFile) {
      qrCodeUrl = await uploadQRCodeImage(qrCodeFile);
    }

    // Create bill
    const bill = await Bill.create({
      bill_number: billNumber,
      customer_name,
      customer_email,
      customer_phone,
      customer_address: parsedAddress || {},
      service_type,
      service_description,
      worker_name,
      worker_phone,
      items: processedItems,
      subtotal: subtotal,
      discount: discountAmount,
      total_amount: totalAmount,
      qr_code: qrCodeUrl,
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

// Update bill with QR code image upload
const updateBill = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const qrCodeFile = req.file;

    const bill = await Bill.findById(id);
    if (!bill || bill.is_deleted) {
      return res.status(404).json({
        success: false,
        error: 'Bill not found'
      });
    }

    // Parse items if it's a string
    let parsedItems = updates.items;
    if (typeof updates.items === 'string') {
      try {
        parsedItems = JSON.parse(updates.items);
      } catch (e) {
        parsedItems = null;
      }
    }

    // Parse customer_address if it's a string
    let parsedAddress = updates.customer_address;
    if (typeof updates.customer_address === 'string') {
      try {
        parsedAddress = JSON.parse(updates.customer_address);
      } catch (e) {
        parsedAddress = null;
      }
    }

    // Allowed fields for update
    const allowedUpdates = [
      'customer_name', 'customer_email', 'customer_phone',
      'service_type', 'service_description',
      'worker_name', 'worker_phone',
      'discount', 'notes'
    ];

    let recalculate = false;
    let subtotal = bill.subtotal;

    // Handle items update
    if (parsedItems && parsedItems.length > 0) {
      subtotal = 0;
      const processedItems = parsedItems.map(item => {
        const amount = (item.quantity || 1) * (item.rate || 0);
        subtotal += amount;
        return {
          description: item.description,
          quantity: item.quantity || 1,
          rate: item.rate || 0,
          amount: amount
        };
      });
      bill.items = processedItems;
      recalculate = true;
    }

    // Handle QR code image update
    if (qrCodeFile) {
      // Delete old QR code from Cloudinary if it exists
      if (bill.qr_code) {
        try {
          const publicId = bill.qr_code.split('/').pop().split('.')[0];
          await cloudinary.uploader.destroy(`billing/qr_codes/${publicId}`);
        } catch (error) {
          console.error('Error deleting old QR code:', error);
        }
      }
      
      // Upload new QR code image
      const qrCodeUrl = await uploadQRCodeImage(qrCodeFile);
      bill.qr_code = qrCodeUrl;
    }

    // Handle address update
    if (parsedAddress) {
      bill.customer_address = parsedAddress;
    }

    // Apply other updates
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
      bill.total_amount = bill.subtotal - (parseFloat(updates.discount) || 0);
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

    // Delete QR code from Cloudinary if it exists
    if (bill.qr_code) {
      try {
        const publicId = bill.qr_code.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`billing/qr_codes/${publicId}`);
      } catch (error) {
        console.error('Error deleting QR code:', error);
      }
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

// Export the multer upload middleware
const uploadQR = upload.single('qr_code');

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
  getUserBillById,
  
  // Middleware
  uploadQR
};