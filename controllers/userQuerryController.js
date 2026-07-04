const UserQuery = require('../models/userQuerry');
const Worker = require('../models/addWorker');
const Auth = require('../models/authModel');
const mongoose = require('mongoose');

// Create a new query (User)
const createQuery = async (req, res) => {
  try {
    const {
      name, email, phone, address,
      issue, service_type_required, urgency,
      preferred_schedule, budget, attachments
    } = req.body;

    // Get user from token
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

    // Validate required fields
    if (!issue || !service_type_required || !urgency) {
      return res.status(400).json({
        success: false,
        error: 'Issue, service type, and urgency are required'
      });
    }

    // Validate address
    if (!address || !address.street || !address.city || !address.pincode) {
      return res.status(400).json({
        success: false,
        error: 'Complete address with street, city, and pincode is required'
      });
    }

    // Create query
    const query = await UserQuery.create({
      user: user._id,
      name: name || user.name,
      email: email || user.email,
      phone: phone || user.phone,
      address,
      issue,
      service_type_required,
      urgency,
      preferred_schedule: preferred_schedule || {},
      budget: budget || { min: 0, max: null, is_negotiable: true },
      attachments: attachments || [],
      status: 'pending'
    });

    console.log(`✅ New query created: ${query._id} by user ${user.email}`);

    res.status(201).json({
      success: true,
      message: 'Your service request has been submitted successfully',
      data: query
    });

  } catch (error) {
    console.error('Error creating query:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get user's own queries (User)
const getMyQueries = async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, 'mypassword');
    
    const { status, page = 1, limit = 10 } = req.query;
    
    let query = { user: decoded.userId };
    if (status) query.status = status;
    
    const queries = await UserQuery.find(query)
      .populate('assigned_to', 'name service_type phone_number hourly_rate rating')
      .sort({ created_at: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await UserQuery.countDocuments(query);
    
    res.json({
      success: true,
      data: queries,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
    
  } catch (error) {
    console.error('Error fetching user queries:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get single query by ID (User/Admin)
const getQueryById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid query ID' });
    }
    
    const query = await UserQuery.findById(id)
      .populate('user', 'name email phone')
      .populate('assigned_to', 'name service_type phone_number hourly_rate rating experience_years skills address')
      .populate('assigned_by', 'name email');
    
    if (!query) {
      return res.status(404).json({ success: false, error: 'Query not found' });
    }
    
    // Check authorization (user can see own, admin can see all)
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, 'mypassword');
    const user = await Auth.findById(decoded.userId);
    
    if (query.user.toString() !== decoded.userId && user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. You can only view your own queries.' 
      });
    }
    
    res.json({
      success: true,
      data: query
    });
    
  } catch (error) {
    console.error('Error fetching query:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Update query (User - only pending queries)
const updateQuery = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const query = await UserQuery.findById(id);
    
    if (!query) {
      return res.status(404).json({ success: false, error: 'Query not found' });
    }
    
    // Check if user owns this query
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, 'mypassword');
    
    if (query.user.toString() !== decoded.userId) {
      return res.status(403).json({ 
        success: false, 
        error: 'You can only update your own queries' 
      });
    }
    
    // Only allow updates if query is pending
    if (query.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Cannot update query once it has been assigned or is in progress'
      });
    }
    
    // Allowed fields for user update
    const allowedUpdates = ['issue', 'service_type_required', 'urgency', 'address', 'preferred_schedule', 'budget'];
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        query[field] = updates[field];
      }
    });
    
    query.updated_at = new Date();
    await query.save();
    
    res.json({
      success: true,
      message: 'Query updated successfully',
      data: query
    });
    
  } catch (error) {
    console.error('Error updating query:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Cancel query (User)
const cancelQuery = async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = await UserQuery.findById(id);
    
    if (!query) {
      return res.status(404).json({ success: false, error: 'Query not found' });
    }
    
    // Check ownership
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, 'mypassword');
    
    if (query.user.toString() !== decoded.userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }
    
    // Can cancel if not completed
    if (query.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel a completed service request'
      });
    }
    
    query.status = 'cancelled';
    query.updated_at = new Date();
    await query.save();
    
    res.json({
      success: true,
      message: 'Service request cancelled successfully',
      data: query
    });
    
  } catch (error) {
    console.error('Error cancelling query:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ============= ADMIN FUNCTIONS =============

// Get all queries (Admin)
const getAllQueries = async (req, res) => {
  try {
    const {
      status,
      service_type,
      urgency,
      city,
      assigned,
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;
    
    let query = {};
    
    // Filters
    if (status) query.status = status;
    if (service_type) query.service_type_required = service_type;
    if (urgency) query.urgency = urgency;
    if (city) query['address.city'] = city;
    if (assigned === 'true') query.assigned_to = { $ne: null };
    if (assigned === 'false') query.assigned_to = null;
    
    // Sorting
    let sort = {};
    sort[sort_by] = sort_order === 'desc' ? -1 : 1;
    
    const queries = await UserQuery.find(query)
      .populate('user', 'name email phone')
      .populate('assigned_to', 'name service_type phone_number hourly_rate rating')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await UserQuery.countDocuments(query);
    const pending = await UserQuery.countDocuments({ status: 'pending' });
    const assigned_count = await UserQuery.countDocuments({ status: 'assigned' });
    const completed = await UserQuery.countDocuments({ status: 'completed' });
    const urgent = await UserQuery.countDocuments({ urgency: 'urgent', status: { $ne: 'completed' } });
    
    res.json({
      success: true,
      data: queries,
      summary: {
        total,
        pending,
        assigned: assigned_count,
        completed,
        urgent
      },
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
    
  } catch (error) {
    console.error('Error fetching all queries:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// userQuerryController.js - Fixed assignWorker function

// Assign worker to query (Admin)
const assignWorker = async (req, res) => {
  try {
    const { id } = req.params;
    const { worker_id, scheduled_date, admin_notes } = req.body;
    
    console.log(`📝 Assigning worker ${worker_id} to query ${id}`);
    
    if (!worker_id) {
      return res.status(400).json({
        success: false,
        error: 'Worker ID is required'
      });
    }
    
    // Validate worker_id format
    if (!mongoose.Types.ObjectId.isValid(worker_id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid worker ID format'
      });
    }
    
    // Get query with proper population
    const query = await UserQuery.findById(id);
    if (!query) {
      return res.status(404).json({ success: false, error: 'Query not found' });
    }
    
    console.log(`📋 Query status: ${query.status}, Service: ${query.service_type_required}`);
    
    // Check if already assigned - allow reassignment if status is 'assigned' or 'in_progress'
    if (query.status === 'completed' || query.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: `Cannot assign worker. Query is ${query.status}`
      });
    }
    
    // Get worker with proper error handling
    const worker = await Worker.findById(worker_id);
    if (!worker) {
      return res.status(404).json({ 
        success: false, 
        error: 'Worker not found. Please check the worker ID.' 
      });
    }
    
    console.log(`👤 Worker found: ${worker.name}, Service: ${worker.service_type}, Status: ${worker.status}`);
    
    // Verify worker service type matches (case insensitive comparison)
    const workerService = worker.service_type?.toLowerCase().trim();
    const queryService = query.service_type_required?.toLowerCase().trim();
    
    if (workerService !== queryService) {
      console.log(`⚠️ Service mismatch: Worker=${workerService}, Query=${queryService}`);
      return res.status(400).json({
        success: false,
        error: `Worker specializes in "${worker.service_type}", but query requires "${query.service_type_required}"`
      });
    }
    
    // Check worker availability - allow 'active' or 'pending' status
    if (worker.status !== 'active' && worker.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Worker is currently ${worker.status} and not available for assignment`
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
    
    if (!admin) {
      return res.status(404).json({ success: false, error: 'Admin not found' });
    }
    
    // Assign worker - update all relevant fields
    const updateData = {
      assigned_to: worker_id,
      assigned_by: admin._id,
      assigned_at: new Date(),
      status: 'assigned',
      updated_at: new Date()
    };
    
    if (scheduled_date) {
      updateData.scheduled_date = new Date(scheduled_date);
    }
    
    if (admin_notes) {
      updateData.admin_notes = admin_notes;
    }
    
    // Update query
    const updatedQuery = await UserQuery.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('assigned_to', 'name service_type phone_number hourly_rate rating')
     .populate('assigned_by', 'name email');
    
    console.log(`✅ Worker ${worker.name} assigned to query ${id} by admin ${admin.email}`);
    
    res.json({
      success: true,
      message: `Worker ${worker.name} assigned successfully`,
      data: {
        query: updatedQuery,
        worker: {
          id: worker._id,
          name: worker.name,
          service_type: worker.service_type,
          phone: worker.phone_number,
          rating: worker.rating
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error assigning worker:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error while assigning worker'
    });
  }
};

// Update query status (Admin/Worker)
const updateQueryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, worker_notes } = req.body;
    
    const validStatuses = ['pending', 'assigned', 'in_progress', 'completed', 'cancelled', 'rescheduled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }
    
    const query = await UserQuery.findById(id);
    if (!query) {
      return res.status(404).json({ success: false, error: 'Query not found' });
    }
    
    // Check authorization
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, 'mypassword');
    const user = await Auth.findById(decoded.userId);
    
    // Admin can update any, worker can update assigned queries
    if (user.role !== 'admin') {
      if (user.role === 'worker') {
        const worker = await Worker.findOne({ email: user.email });
        if (!worker || query.assigned_to?.toString() !== worker._id.toString()) {
          return res.status(403).json({
            success: false,
            error: 'You can only update queries assigned to you'
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized to update status'
        });
      }
    }
    
    // Update status
    query.status = status;
    if (worker_notes) query.worker_notes = worker_notes;
    
    if (status === 'completed') {
      query.completed_at = new Date();
    }
    
    query.updated_at = new Date();
    await query.save();
    
    res.json({
      success: true,
      message: `Query status updated to ${status}`,
      data: query
    });
    
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Submit rating and feedback (User)
const submitRating = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, feedback } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5'
      });
    }
    
    const query = await UserQuery.findById(id);
    if (!query) {
      return res.status(404).json({ success: false, error: 'Query not found' });
    }
    
    // Check if user owns this query
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, 'mypassword');
    
    if (query.user.toString() !== decoded.userId) {
      return res.status(403).json({
        success: false,
        error: 'You can only rate your own service requests'
      });
    }
    
    // Can only rate completed queries
    if (query.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Can only rate completed service requests'
      });
    }
    
    // Check if already rated
    if (query.rating) {
      return res.status(400).json({
        success: false,
        error: 'You have already rated this service'
      });
    }
    
    query.rating = rating;
    query.feedback = feedback || '';
    query.feedback_given_at = new Date();
    await query.save();
    
    // Update worker's average rating
    if (query.assigned_to) {
      const worker = await Worker.findById(query.assigned_to);
      if (worker) {
        const allRatings = await UserQuery.find({ 
          assigned_to: query.assigned_to, 
          rating: { $ne: null } 
        });
        
        const totalRating = allRatings.reduce((sum, q) => sum + q.rating, 0);
        worker.rating = totalRating / allRatings.length;
        worker.total_reviews = allRatings.length;
        await worker.save();
      }
    }
    
    res.json({
      success: true,
      message: 'Thank you for your feedback!',
      data: {
        rating: query.rating,
        feedback: query.feedback
      }
    });
    
  } catch (error) {
    console.error('Error submitting rating:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get pending queries count (Admin dashboard)
const getPendingQueriesCount = async (req, res) => {
  try {
    const pending = await UserQuery.countDocuments({ status: 'pending' });
    const urgentPending = await UserQuery.countDocuments({ 
      status: 'pending',
      urgency: { $in: ['urgent', 'very_high', 'high'] }
    });
    
    const assignedInProgress = await UserQuery.countDocuments({
      status: { $in: ['assigned', 'in_progress'] }
    });
    
    const completedToday = await UserQuery.countDocuments({
      status: 'completed',
      completed_at: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0))
      }
    });
    
    res.json({
      success: true,
      data: {
        pending,
        urgentPending,
        assignedInProgress,
        completedToday
      }
    });
    
  } catch (error) {
    console.error('Error getting counts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get available workers for a query (Admin)
const getAvailableWorkersForQuery = async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = await UserQuery.findById(id);
    if (!query) {
      return res.status(404).json({ success: false, error: 'Query not found' });
    }
    
    // Find workers with matching service type and active status
    const workers = await Worker.find({
      service_type: query.service_type_required,
      status: 'active'
    }).select('name service_type phone_number hourly_rate rating experience_years address skills');
    
    // Sort by rating and experience
    workers.sort((a, b) => {
      if (a.rating !== b.rating) return b.rating - a.rating;
      return b.experience_years - a.experience_years;
    });
    
    res.json({
      success: true,
      data: {
        query_id: id,
        service_required: query.service_type_required,
        workers_available: workers.length,
        workers
      }
    });
    
  } catch (error) {
    console.error('Error getting available workers:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = {
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
  getAvailableWorkersForQuery
};