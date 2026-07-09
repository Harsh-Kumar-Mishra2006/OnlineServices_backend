// models/Payment.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  bill: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Auth',
    required: true
  },
  payment_amount: {
    type: Number,
    required: true,
    min: 0
  },
  payment_screenshot: {
    public_id: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    }
  },
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  verified_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Auth',
    default: null
  },
  verified_at: {
    type: Date,
    default: null
  },
  verification_notes: {
    type: String,
    trim: true,
    default: ''
  },
  user_notes: {
    type: String,
    trim: true,
    default: ''
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Indexes
paymentSchema.index({ bill: 1 });
paymentSchema.index({ user: 1 });
paymentSchema.index({ status: 1 });

// Make sure this is correct
module.exports = mongoose.model('Payment', paymentSchema);