const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  // Reference to the user query
  query: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserQuery',
    required: [true, 'Query reference is required']
  },
  
  // Worker assigned
  worker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Worker',
    required: [true, 'Worker reference is required']
  },
  
  // Admin who assigned
  assigned_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Auth',
    required: [true, 'Admin reference is required']
  },
  
  // Assignment details
  assignment_date: {
    type: Date,
    default: Date.now
  },
  
  scheduled_date: {
    type: Date,
    required: [true, 'Scheduled date is required']
  },
  
  scheduled_time_slot: {
    type: String,
    enum: ['morning', 'afternoon', 'evening', 'night', 'anytime'],
    default: 'anytime'
  },
  
  // Assignment status
  status: {
    type: String,
    enum: ['assigned', 'accepted', 'in_progress', 'completed', 'cancelled', 'rejected'],
    default: 'assigned'
  },
  
  // Worker's response
  worker_response: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },
  
  worker_response_date: {
    type: Date,
    default: null
  },
  
  worker_notes: {
    type: String,
    trim: true
  },
  
  // Admin notes
  admin_notes: {
    type: String,
    trim: true
  },
  
  // Timeline
  accepted_at: {
    type: Date,
    default: null
  },
  
  started_at: {
    type: Date,
    default: null
  },
  
  completed_at: {
    type: Date,
    default: null
  },
  
  // Duration tracking
  estimated_hours: {
    type: Number,
    default: 0
  },
  
  actual_hours: {
    type: Number,
    default: 0
  },
  
  // Completion details
  completion_notes: {
    type: String,
    trim: true
  },
  
  completion_rating: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  
  // Payment details
  payment_status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  
  payment_amount: {
    type: Number,
    default: 0
  },
  
  payment_date: {
    type: Date,
    default: null
  },
  
  // Notification tracking
  worker_notified: {
    type: Boolean,
    default: false
  },
  
  worker_notified_at: {
    type: Date,
    default: null
  },
  
  user_notified: {
    type: Boolean,
    default: false
  },
  
  user_notified_at: {
    type: Date,
    default: null
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Indexes
assignmentSchema.index({ query: 1 });
assignmentSchema.index({ worker: 1 });
assignmentSchema.index({ status: 1 });
assignmentSchema.index({ assigned_by: 1 });
assignmentSchema.index({ assignment_date: -1 });
assignmentSchema.index({ scheduled_date: 1 });

// Virtual for urgency priority
assignmentSchema.virtual('urgency_priority').get(function() {
  const priorities = {
    'urgent': 5,
    'very_high': 4,
    'high': 3,
    'medium': 2,
    'low': 1,
    'flexible': 0
  };
  return priorities[this.urgency] || 0;
});

// Methods
assignmentSchema.methods.accept = async function() {
  this.worker_response = 'accepted';
  this.status = 'accepted';
  this.worker_response_date = new Date();
  this.accepted_at = new Date();
  await this.save();
};

assignmentSchema.methods.reject = async function() {
  this.worker_response = 'rejected';
  this.status = 'rejected';
  this.worker_response_date = new Date();
  await this.save();
};

assignmentSchema.methods.start = async function() {
  this.status = 'in_progress';
  this.started_at = new Date();
  await this.save();
};

assignmentSchema.methods.complete = async function(notes, rating) {
  this.status = 'completed';
  this.completed_at = new Date();
  if (notes) this.completion_notes = notes;
  if (rating) this.completion_rating = rating;
  await this.save();
};

module.exports = mongoose.model('Assignment', assignmentSchema);