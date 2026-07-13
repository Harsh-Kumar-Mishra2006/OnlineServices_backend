const UserQuery = require('../models/userQuerry');
const Worker = require('../models/addWorker');
const Auth = require('../models/authModel');
const mongoose = require('mongoose');

// ============= WORKER ASSIGNMENT CONTROLLER =============

// Helper function to find worker by user ID
const findWorkerByUserId = async (userId) => {
  // First try to find by created_by (if worker was created by admin)
  let worker = await Worker.findOne({ created_by: userId });
  
  if (worker) return worker;
  
  // If not found, get user details to find by phone
  const user = await Auth.findById(userId);
  if (!user) return null;
  
  // Find worker by phone number
  worker = await Worker.findOne({ phone_number: user.phone });
  return worker;
};

// Get all assignments for a worker
const getMyAssignments = async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, 'mypassword');
    
    console.log('🔍 Decoded token userId:', decoded.userId);
    
    // Find worker using the helper function
    const worker = await findWorkerByUserId(decoded.userId);
    
    if (!worker) {
      console.log('❌ Worker not found for user:', decoded.userId);
      return res.status(404).json({ 
        success: false, 
        error: 'Worker profile not found. Please contact admin.' 
      });
    }

    console.log('✅ Worker found:', worker.name, 'Phone:', worker.phone_number);

    const { 
      status, 
      page = 1, 
      limit = 10,
      sort_by = 'assigned_at',
      sort_order = 'desc'
    } = req.query;

    let query = { assigned_to: worker._id };
    if (status) query.status = status;

    // Build sort object
    let sort = {};
    sort[sort_by] = sort_order === 'desc' ? -1 : 1;

    const assignments = await UserQuery.find(query)
      .populate('user', 'name email phone address')
      .populate('assigned_by', 'name email')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await UserQuery.countDocuments(query);

    // Get statistics
    const stats = {
      total: total,
      pending: await UserQuery.countDocuments({ assigned_to: worker._id, status: 'assigned' }),
      in_progress: await UserQuery.countDocuments({ assigned_to: worker._id, status: 'in_progress' }),
      completed: await UserQuery.countDocuments({ assigned_to: worker._id, status: 'completed' }),
      cancelled: await UserQuery.countDocuments({ assigned_to: worker._id, status: 'cancelled' }),
    };

    // Get ratings summary
    const ratings = await UserQuery.find({ 
      assigned_to: worker._id, 
      rating: { $ne: null } 
    });
    
    const avgRating = ratings.length > 0 
      ? ratings.reduce((sum, q) => sum + q.rating, 0) / ratings.length 
      : 0;

    res.json({
      success: true,
      data: {
        worker: {
          id: worker._id,
          name: worker.name,
          service_type: worker.service_type,
          rating: worker.rating,
          total_reviews: worker.total_reviews,
          status: worker.status,
          hourly_rate: worker.hourly_rate
        },
        assignments,
        stats,
        ratings_summary: {
          average_rating: avgRating,
          total_ratings: ratings.length
        },
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('❌ Error fetching worker assignments:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get single assignment details for worker
const getAssignmentDetails = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid assignment ID' });
    }

    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, 'mypassword');
    
    // Find worker using the helper function
    const worker = await findWorkerByUserId(decoded.userId);
    
    if (!worker) {
      return res.status(404).json({ 
        success: false, 
        error: 'Worker profile not found. Please contact admin.' 
      });
    }

    const assignment = await UserQuery.findById(id)
      .populate('user', 'name email phone address')
      .populate('assigned_by', 'name email')
      .populate('assigned_to', 'name service_type phone_number hourly_rate');

    if (!assignment) {
      return res.status(404).json({ success: false, error: 'Assignment not found' });
    }

    // Verify this assignment belongs to the worker
    if (!assignment.assigned_to || assignment.assigned_to._id.toString() !== worker._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        error: 'You are not authorized to view this assignment' 
      });
    }

    res.json({
      success: true,
      data: assignment
    });

  } catch (error) {
    console.error('❌ Error fetching assignment details:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Update assignment status (Worker)
const updateAssignmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, worker_notes, completion_notes } = req.body;

    const validStatuses = ['assigned', 'in_progress', 'completed', 'cancelled', 'rescheduled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Valid statuses: ' + validStatuses.join(', ')
      });
    }

    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, 'mypassword');
    
    // Find worker using the helper function
    const worker = await findWorkerByUserId(decoded.userId);
    
    if (!worker) {
      return res.status(404).json({ 
        success: false, 
        error: 'Worker profile not found. Please contact admin.' 
      });
    }

    const assignment = await UserQuery.findById(id);
    if (!assignment) {
      return res.status(404).json({ success: false, error: 'Assignment not found' });
    }

    // Verify this assignment belongs to the worker
    if (assignment.assigned_to.toString() !== worker._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        error: 'You are not authorized to update this assignment' 
      });
    }

    // Update status
    assignment.status = status;
    if (worker_notes) assignment.worker_notes = worker_notes;
    if (completion_notes) assignment.completion_notes = completion_notes;

    // Set timestamps based on status
    if (status === 'in_progress' && !assignment.started_at) {
      assignment.started_at = new Date();
    }

    if (status === 'completed') {
      assignment.completed_at = new Date();
      // Update worker status back to active
      worker.status = 'active';
      await worker.save();
    }

    if (status === 'cancelled') {
      // Update worker status back to active
      worker.status = 'active';
      await worker.save();
    }

    if (status === 'assigned' || status === 'in_progress') {
      // Update worker status to busy
      worker.status = 'busy';
      await worker.save();
    }

    assignment.updated_at = new Date();
    await assignment.save();

    console.log(`✅ Assignment ${id} status updated to ${status} by worker ${worker.name}`);

    res.json({
      success: true,
      message: `Assignment status updated to ${status}`,
      data: assignment
    });

  } catch (error) {
    console.error('❌ Error updating assignment status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get assignment statistics for worker dashboard
const getWorkerDashboardStats = async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, 'mypassword');
    
    // Find worker using the helper function
    const worker = await findWorkerByUserId(decoded.userId);
    
    if (!worker) {
      return res.status(404).json({ 
        success: false, 
        error: 'Worker profile not found. Please contact admin.' 
      });
    }

    // Get all assignments
    const totalAssignments = await UserQuery.countDocuments({ assigned_to: worker._id });
    const pending = await UserQuery.countDocuments({ assigned_to: worker._id, status: 'assigned' });
    const inProgress = await UserQuery.countDocuments({ assigned_to: worker._id, status: 'in_progress' });
    const completed = await UserQuery.countDocuments({ assigned_to: worker._id, status: 'completed' });
    const cancelled = await UserQuery.countDocuments({ assigned_to: worker._id, status: 'cancelled' });

    // Get recent assignments (last 5)
    const recentAssignments = await UserQuery.find({ assigned_to: worker._id })
      .populate('user', 'name email phone')
      .sort({ assigned_at: -1 })
      .limit(5);

    // Calculate earnings (from completed assignments with hourly rate)
    const completedAssignments = await UserQuery.find({ 
      assigned_to: worker._id, 
      status: 'completed' 
    });

    let totalEarnings = 0;
    let totalHours = 0;
    completedAssignments.forEach(assignment => {
      if (assignment.actual_hours) {
        totalHours += assignment.actual_hours;
        totalEarnings += assignment.actual_hours * (worker.hourly_rate || 0);
      }
    });

    // Get rating summary
    const ratings = await UserQuery.find({ 
      assigned_to: worker._id, 
      rating: { $ne: null } 
    });
    
    const avgRating = ratings.length > 0 
      ? ratings.reduce((sum, q) => sum + q.rating, 0) / ratings.length 
      : 0;

    res.json({
      success: true,
      data: {
        worker: {
          id: worker._id,
          name: worker.name,
          service_type: worker.service_type,
          rating: worker.rating,
          total_reviews: worker.total_reviews,
          status: worker.status,
          hourly_rate: worker.hourly_rate
        },
        stats: {
          total: totalAssignments,
          pending,
          in_progress: inProgress,
          completed,
          cancelled,
          completion_rate: totalAssignments > 0 ? (completed / totalAssignments * 100).toFixed(1) : 0
        },
        earnings: {
          total: totalEarnings,
          total_hours: totalHours,
          average_per_assignment: completed > 0 ? totalEarnings / completed : 0
        },
        ratings_summary: {
          average_rating: avgRating,
          total_ratings: ratings.length
        },
        recent_assignments: recentAssignments
      }
    });

  } catch (error) {
    console.error('❌ Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Submit completion report (Worker)
const submitCompletionReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { actual_hours, completion_notes, photos } = req.body;

    if (!actual_hours || actual_hours <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide valid actual hours worked'
      });
    }

    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, 'mypassword');
    
    // Find worker using the helper function
    const worker = await findWorkerByUserId(decoded.userId);
    
    if (!worker) {
      return res.status(404).json({ 
        success: false, 
        error: 'Worker profile not found. Please contact admin.' 
      });
    }

    const assignment = await UserQuery.findById(id);
    if (!assignment) {
      return res.status(404).json({ success: false, error: 'Assignment not found' });
    }

    // Verify this assignment belongs to the worker
    if (assignment.assigned_to.toString() !== worker._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        error: 'You are not authorized to submit report for this assignment' 
      });
    }

    // Update assignment with completion report
    assignment.actual_hours = actual_hours;
    if (completion_notes) assignment.completion_notes = completion_notes;
    if (photos) assignment.completion_photos = photos;
    assignment.status = 'completed';
    assignment.completed_at = new Date();
    assignment.updated_at = new Date();

    await assignment.save();

    // Update worker status
    worker.status = 'active';
    await worker.save();

    res.json({
      success: true,
      message: 'Completion report submitted successfully',
      data: assignment
    });

  } catch (error) {
    console.error('❌ Error submitting completion report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = {
  getMyAssignments,
  getAssignmentDetails,
  updateAssignmentStatus,
  getWorkerDashboardStats,
  submitCompletionReport
};