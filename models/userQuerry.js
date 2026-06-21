const mongoose = require('mongoose');

const userQuerySchema = new mongoose.Schema({
  // User Details
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Auth',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  address: {
    street: {
      type: String,
      required: [true, 'Street address is required'],
      trim: true
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true
    },
    pincode: {
      type: String,
      required: [true, 'Pincode is required'],
      trim: true
    },
    landmark: {
      type: String,
      trim: true
    }
  },
  
  // Issue Details
  issue: {
    type: String,
    required: [true, 'Issue description is required'],
    trim: true,
    maxlength: [1000, 'Issue description cannot exceed 1000 characters']
  },
  
  service_type_required: {
    type: String,
    required: [true, 'Service type is required'],
    trim: true,
    enum: [
      'Plumber',
      'Electrician', 
      'Carpenter',
      'Painter',
      'AC Technician',
      'Mechanic',
      'Cleaner',
      'Gardener',
      'Mason',
      'Roofing Specialist',
      'Flooring Specialist',
      'Appliance Repair',
      'Pest Control',
      'Locksmith',
      'Home Renovation',
      'Other'
    ]
  },
  
  // Urgency Levels
  urgency: {
    type: String,
    required: [true, 'Urgency level is required'],
    enum: {
      values: ['urgent', 'very_high', 'high', 'medium', 'low', 'flexible'],
      message: 'Please select a valid urgency level'
    }
  },
  
  urgency_details: {
    urgent: {
      timeframe: { type: String, default: 'Within 1 hour' },
      priority: { type: Number, default: 5 }
    },
    very_high: {
      timeframe: { type: String, default: '2-3 hours' },
      priority: { type: Number, default: 4 }
    },
    high: {
      timeframe: { type: String, default: '4-6 hours' },
      priority: { type: Number, default: 3 }
    },
    medium: {
      timeframe: { type: String, default: 'Today' },
      priority: { type: Number, default: 2 }
    },
    low: {
      timeframe: { type: String, default: '1-2 days' },
      priority: { type: Number, default: 1 }
    },
    flexible: {
      timeframe: { type: String, default: '3-5 days' },
      priority: { type: Number, default: 0 }
    }
  },
  
  // Preferred Schedule
  preferred_schedule: {
    preferred_date: {
      type: Date,
      default: Date.now
    },
    preferred_time_slot: {
      type: String,
      enum: ['morning', 'afternoon', 'evening', 'night', 'anytime'],
      default: 'anytime'
    },
    flexible_timing: {
      type: Boolean,
      default: true
    }
  },
  
  // Attachments
  attachments: [{
    filename: String,
    url: String,
    filetype: String,
    uploaded_at: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Budget
  budget: {
    min: {
      type: Number,
      default: 0
    },
    max: {
      type: Number,
      default: null
    },
    is_negotiable: {
      type: Boolean,
      default: true
    }
  },
  
  // Status Tracking
  status: {
    type: String,
    enum: ['pending', 'assigned', 'in_progress', 'completed', 'cancelled', 'rescheduled'],
    default: 'pending'
  },
  
  // Assignment Details
  assigned_to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Worker',
    default: null
  },
  
  assigned_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Auth',
    default: null
  },
  
  assigned_at: {
    type: Date,
    default: null
  },
  
  // Timeline
  created_at: {
    type: Date,
    default: Date.now
  },
  
  updated_at: {
    type: Date,
    default: Date.now
  },
  
  scheduled_date: {
    type: Date,
    default: null
  },
  
  completed_at: {
    type: Date,
    default: null
  },
  
  // Admin Notes
  admin_notes: {
    type: String,
    trim: true
  },
  
  worker_notes: {
    type: String,
    trim: true
  },
  
  // Rating & Feedback (after completion)
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  
  feedback: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  feedback_given_at: {
    type: Date,
    default: null
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Indexes for better query performance
userQuerySchema.index({ email: 1 });
userQuerySchema.index({ status: 1 });
userQuerySchema.index({ urgency: 1 });
userQuerySchema.index({ service_type_required: 1 });
userQuerySchema.index({ 'address.city': 1 });
userQuerySchema.index({ assigned_to: 1 });
userQuerySchema.index({ created_at: -1 });

// Virtual for urgency priority
userQuerySchema.virtual('urgency_priority').get(function() {
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

// Method to check if query is overdue
userQuerySchema.methods.isOverdue = function() {
  if (this.status !== 'assigned' && this.status !== 'pending') return false;
  
  const urgencyTimeframes = {
    'urgent': 1, // hours
    'very_high': 3,
    'high': 6,
    'medium': 24,
    'low': 48,
    'flexible': 120
  };
  
  const hoursLimit = urgencyTimeframes[this.urgency] || 24;
  const hoursPassed = (Date.now() - this.created_at) / (1000 * 60 * 60);
  
  return hoursPassed > hoursLimit;
};

module.exports = mongoose.model('UserQuery', userQuerySchema);