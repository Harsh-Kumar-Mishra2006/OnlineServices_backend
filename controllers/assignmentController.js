const Assignment = require('../models/Assignment');
const UserQuery = require('../models/userQuerry');
const Worker = require('../models/addWorker');
const Auth = require('../models/authModel');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// ============= ADMIN FUNCTIONS =============

// Create a new assignment (Admin)
const createAssignment = async (req, res) => {
  try {
    const {
      queryId,
      workerId,
      scheduled_date,
      scheduled_time_slot,
      admin_notes,
      estimated_hours
    } = req.body;

    // Validate required fields
    if (!queryId || !workerId || !scheduled_date) {
      return res.status(400).json({
        success: false,
        error: 'Query ID, Worker ID, and scheduled date are required'
      });
    }

    // Verify admin
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const decoded = jwt.verify(token, 'mypassword');
    const admin = await Auth.findById(decoded.userId);

    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admins can create assignments'
      });
    }

    // Check if query exists
    const query = await UserQuery.findById(queryId);
    if (!query) {
      return res.status(404).json({
        success: false,
        error: 'Query not found'
      });
    }

    // Check if query is already assigned
    if (query.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Query is already ${query.status}. Cannot assign.`
      });
    }

    // Check if worker exists
    const worker = await Worker.findById(workerId);
    if (!worker) {
      return res.status(404).json({
        success: false,
        error: 'Worker not found'
      });
    }

    // Verify worker service type matches
    if (worker.service_type !== query.service_type_required) {
      return res.status(400).json({
        success: false,
        error: `Worker specializes in ${worker.service_type}, but query requires ${query.service_type_required}`
      });
    }

    // Check if worker is available
    if (worker.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: `Worker is currently ${worker.status} and not available`
      });
    }

    // Check for existing assignment for this query
    const existingAssignment = await Assignment.findOne({
      query: queryId,
      status: { $in: ['assigned', 'accepted', 'in_progress'] }
    });

    if (existingAssignment) {
      return res.status(400).json({
        success: false,
        error: 'This query already has an active assignment'
      });
    }

    // Create assignment
    const assignment = await Assignment.create({
      query: queryId,
      worker: workerId,
      assigned_by: admin._id,
      scheduled_date: new Date(scheduled_date),
      scheduled_time_slot: scheduled_time_slot || 'anytime',
      admin_notes: admin_notes || '',
      estimated_hours: estimated_hours || 0,
      status: 'assigned',
      worker_response: 'pending'
    });

    // Update query status
    query.status = 'assigned';
    query.assigned_to = workerId;
    query.assigned_by = admin._id;
    query.assigned_at = new Date();
    query.scheduled_date = new Date(scheduled_date);
    query.admin_notes = admin_notes || '';
    await query.save();

    // Update worker status
    worker.status = 'busy';
    await worker.save();

    console.log(`✅ Assignment created: ${assignment._id} by admin ${admin.email}`);

    res.status(201).json({
      success: true,
      message: 'Worker assigned successfully',
      data: {
        assignment: {
          id: assignment._id,
          status: assignment.status,
          scheduled_date: assignment.scheduled_date,
          scheduled_time_slot: assignment.scheduled_time_slot
        },
        query: {
          id: query._id,
          status: query.status,
          assigned_to: worker.name,
          service_type: query.service_type_required
        },
        worker: {
          id: worker._id,
          name: worker.name,
          service_type: worker.service_type,
          status: worker.status
        }
      }
    });

  } catch (error) {
    console.error('Error creating assignment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get all assignments (Admin)
const getAllAssignments = async (req, res) => {
  try {
    const {
      status,
      worker_id,
      query_id,
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    // Verify admin
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const decoded = jwt.verify(token, 'mypassword');
    const admin = await Auth.findById(decoded.userId);

    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admins can view all assignments'
      });
    }

    let filter = {};
    if (status) filter.status = status;
    if (worker_id) filter.worker = worker_id;
    if (query_id) filter.query = query_id;

    let sort = {};
    sort[sort_by] = sort_order === 'desc' ? -1 : 1;

    const assignments = await Assignment.find(filter)
      .populate('query', 'name email issue service_type_required urgency address status')
      .populate('worker', 'name email service_type phone_number hourly_rate rating')
      .populate('assigned_by', 'name email')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Assignment.countDocuments(filter);

    res.json({
      success: true,
      data: assignments,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });

  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get assignment by ID
const getAssignmentById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid assignment ID' });
    }

    const assignment = await Assignment.findById(id)
      .populate('query', 'name email phone issue service_type_required urgency address status created_at')
      .populate('worker', 'name email service_type phone_number hourly_rate rating experience_years skills')
      .populate('assigned_by', 'name email');

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found'
      });
    }

    // Check authorization
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const decoded = jwt.verify(token, 'mypassword');
    const user = await Auth.findById(decoded.userId);

    // Allow if admin, or the assigned worker, or the query owner
    const isAdmin = user.role === 'admin';
    const isAssignedWorker = assignment.worker._id.toString() === user._id.toString();
    const isQueryOwner = assignment.query.user._id.toString() === user._id.toString();

    if (!isAdmin && !isAssignedWorker && !isQueryOwner) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: assignment
    });

  } catch (error) {
    console.error('Error fetching assignment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ============= WORKER FUNCTIONS =============

// Get worker's assignments
const getMyAssignments = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const decoded = jwt.verify(token, 'mypassword');
    const user = await Auth.findById(decoded.userId);

    if (user.role !== 'worker') {
      return res.status(403).json({
        success: false,
        error: 'Only workers can access their assignments'
      });
    }

    const worker = await Worker.findOne({ email: user.email });
    if (!worker) {
      return res.status(404).json({
        success: false,
        error: 'Worker profile not found'
      });
    }

    let filter = { worker: worker._id };
    if (status) filter.status = status;

    const assignments = await Assignment.find(filter)
      .populate('query', 'name email issue service_type_required urgency address status created_at')
      .populate('assigned_by', 'name email')
      .sort({ created_at: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Assignment.countDocuments(filter);

    res.json({
      success: true,
      data: assignments,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });

  } catch (error) {
    console.error('Error fetching worker assignments:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Worker accepts assignment
const acceptAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { worker_notes } = req.body;

    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found'
      });
    }

    // Verify worker
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const decoded = jwt.verify(token, 'mypassword');
    const user = await Auth.findById(decoded.userId);

    if (user.role !== 'worker') {
      return res.status(403).json({
        success: false,
        error: 'Only workers can accept assignments'
      });
    }

    const worker = await Worker.findOne({ email: user.email });
    if (!worker || assignment.worker.toString() !== worker._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'This assignment is not for you'
      });
    }

    if (assignment.status !== 'assigned') {
      return res.status(400).json({
        success: false,
        error: `Cannot accept assignment. Status is ${assignment.status}`
      });
    }

    await assignment.accept();
    if (worker_notes) {
      assignment.worker_notes = worker_notes;
      await assignment.save();
    }

    // Update query status
    const query = await UserQuery.findById(assignment.query);
    if (query) {
      query.status = 'in_progress';
      await query.save();
    }

    // Update worker status
    worker.status = 'busy';
    await worker.save();

    res.json({
      success: true,
      message: 'Assignment accepted successfully',
      data: {
        assignment: {
          id: assignment._id,
          status: assignment.status,
          accepted_at: assignment.accepted_at
        }
      }
    });

  } catch (error) {
    console.error('Error accepting assignment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Worker rejects assignment
const rejectAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { worker_notes } = req.body;

    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found'
      });
    }

    // Verify worker
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const decoded = jwt.verify(token, 'mypassword');
    const user = await Auth.findById(decoded.userId);

    if (user.role !== 'worker') {
      return res.status(403).json({
        success: false,
        error: 'Only workers can reject assignments'
      });
    }

    const worker = await Worker.findOne({ email: user.email });
    if (!worker || assignment.worker.toString() !== worker._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'This assignment is not for you'
      });
    }

    if (assignment.status !== 'assigned') {
      return res.status(400).json({
        success: false,
        error: `Cannot reject assignment. Status is ${assignment.status}`
      });
    }

    await assignment.reject();
    if (worker_notes) {
      assignment.worker_notes = worker_notes;
      await assignment.save();
    }

    // Update query status back to pending
    const query = await UserQuery.findById(assignment.query);
    if (query) {
      query.status = 'pending';
      query.assigned_to = null;
      query.assigned_by = null;
      query.assigned_at = null;
      await query.save();
    }

    // Update worker status
    worker.status = 'active';
    await worker.save();

    res.json({
      success: true,
      message: 'Assignment rejected',
      data: {
        assignment: {
          id: assignment._id,
          status: assignment.status,
          rejected_at: assignment.worker_response_date
        }
      }
    });

  } catch (error) {
    console.error('Error rejecting assignment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Worker starts work
const startWork = async (req, res) => {
  try {
    const { id } = req.params;

    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found'
      });
    }

    // Verify worker
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const decoded = jwt.verify(token, 'mypassword');
    const user = await Auth.findById(decoded.userId);

    const worker = await Worker.findOne({ email: user.email });
    if (!worker || assignment.worker.toString() !== worker._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    if (assignment.status !== 'accepted') {
      return res.status(400).json({
        success: false,
        error: `Cannot start work. Status is ${assignment.status}`
      });
    }

    await assignment.start();

    // Update query status
    const query = await UserQuery.findById(assignment.query);
    if (query) {
      query.status = 'in_progress';
      await query.save();
    }

    res.json({
      success: true,
      message: 'Work started',
      data: {
        assignment: {
          id: assignment._id,
          status: assignment.status,
          started_at: assignment.started_at
        }
      }
    });

  } catch (error) {
    console.error('Error starting work:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Worker completes work
const completeWork = async (req, res) => {
  try {
    const { id } = req.params;
    const { completion_notes, actual_hours, completion_rating } = req.body;

    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found'
      });
    }

    // Verify worker
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const decoded = jwt.verify(token, 'mypassword');
    const user = await Auth.findById(decoded.userId);

    const worker = await Worker.findOne({ email: user.email });
    if (!worker || assignment.worker.toString() !== worker._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    if (assignment.status !== 'accepted' && assignment.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        error: `Cannot complete work. Status is ${assignment.status}`
      });
    }

    await assignment.complete(completion_notes, completion_rating);
    if (actual_hours) assignment.actual_hours = actual_hours;
    await assignment.save();

    // Update query status
    const query = await UserQuery.findById(assignment.query);
    if (query) {
      query.status = 'completed';
      query.completed_at = new Date();
      await query.save();
    }

    // Update worker status
    worker.status = 'active';
    await worker.save();

    res.json({
      success: true,
      message: 'Work completed successfully',
      data: {
        assignment: {
          id: assignment._id,
          status: assignment.status,
          completed_at: assignment.completed_at,
          actual_hours: assignment.actual_hours
        }
      }
    });

  } catch (error) {
    console.error('Error completing work:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ============= USER FUNCTIONS =============

// Get user's assignments (for the queries they created)
const getUserAssignments = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const decoded = jwt.verify(token, 'mypassword');
    const user = await Auth.findById(decoded.userId);

    if (user.role !== 'user') {
      return res.status(403).json({
        success: false,
        error: 'Only users can access their assignments'
      });
    }

    // Find all queries by this user
    const queries = await UserQuery.find({ user: user._id });
    const queryIds = queries.map(q => q._id);

    let filter = { query: { $in: queryIds } };
    if (status) filter.status = status;

    const assignments = await Assignment.find(filter)
      .populate('query', 'name email issue service_type_required urgency address status created_at')
      .populate('worker', 'name email service_type phone_number hourly_rate rating')
      .populate('assigned_by', 'name email')
      .sort({ created_at: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Assignment.countDocuments(filter);

    res.json({
      success: true,
      data: assignments,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });

  } catch (error) {
    console.error('Error fetching user assignments:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Admin cancels assignment
const cancelAssignment = async (req, res) => {
  try {
    const { id } = req.params;

    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found'
      });
    }

    // Verify admin
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const decoded = jwt.verify(token, 'mypassword');
    const user = await Auth.findById(decoded.userId);

    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admins can cancel assignments'
      });
    }

    if (assignment.status === 'completed' || assignment.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: `Cannot cancel. Status is ${assignment.status}`
      });
    }

    assignment.status = 'cancelled';
    await assignment.save();

    // Update query status
    const query = await UserQuery.findById(assignment.query);
    if (query) {
      query.status = 'pending';
      query.assigned_to = null;
      query.assigned_by = null;
      query.assigned_at = null;
      await query.save();
    }

    // Update worker status
    const worker = await Worker.findById(assignment.worker);
    if (worker) {
      worker.status = 'active';
      await worker.save();
    }

    res.json({
      success: true,
      message: 'Assignment cancelled',
      data: assignment
    });

  } catch (error) {
    console.error('Error cancelling assignment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = {
  // Admin functions
  createAssignment,
  getAllAssignments,
  getAssignmentById,
  cancelAssignment,
  
  // Worker functions
  getMyAssignments,
  acceptAssignment,
  rejectAssignment,
  startWork,
  completeWork,
  
  // User functions
  getUserAssignments
};