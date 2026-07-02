//models/addWorker.js
const mongoose = require('mongoose');

// Service categories enum
const serviceCategories = [
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
  'Home Renovation'
];

const workerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Worker name is required'],
    trim: true
  },
  email: {
    type: String,
    unique: true,
    trim: true,
    lowercase: true,
    sparse:true,
    default: null,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  service_type: {
    type: String,
    required: [true, 'Service type is required'],
    trim: true,
    enum: {
      values: serviceCategories,
      message: 'Please select a valid service category'
    }
  },
  phone_number: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    trim: true,
    match: [/^[0-9]{10,15}$/, 'Please enter a valid phone number']
  },
  address: {
    street: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    state: {
      type: String,
      required: true,
      trim: true
    },
    pincode: {
      type: String,
      required: true,
      trim: true
    },
    country: {
      type: String,
      default: 'India',
      trim: true
    }
  },
  experience_years: {
    type: Number,
    required: [true, 'Years of experience is required'],
    min: [0, 'Experience cannot be negative'],
    max: [50, 'Experience seems too high']
  },
  skills: {
    type: [String],
    default: []
  },
  certifications: {
    type: [String],
    default: []
  },
  bio: {
    type: String,
    maxlength: 500
  },
  hourly_rate: {
    type: Number,
    required: [true, 'Hourly rate is required'],
    min: [0, 'Hourly rate cannot be negative']
  },
  availability: {
    monday: { type: Boolean, default: true },
    tuesday: { type: Boolean, default: true },
    wednesday: { type: Boolean, default: true },
    thursday: { type: Boolean, default: true },
    friday: { type: Boolean, default: true },
    saturday: { type: Boolean, default: false },
    sunday: { type: Boolean, default: false },
    start_time: { type: String, default: '09:00' },
    end_time: { type: String, default: '18:00' }
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  total_reviews: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending', 'busy'],
    default: 'pending'
  },
  joining_date: {
    type: Date,
    default: Date.now
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Auth',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
workerSchema.index({ phone_number: 1 }); // Phone is now primary
workerSchema.index({ email: 1 });
workerSchema.index({ service_type: 1 });
workerSchema.index({ status: 1 });
workerSchema.index({ rating: -1 });
workerSchema.index({ hourly_rate: 1 });

module.exports = mongoose.model("Worker", workerSchema);