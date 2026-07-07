const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
  // Reference to the original query
  query: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserQuery',
    required: true
  },
  
  // User who is billed
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Auth',
    required: true
  },
  
  // Worker who performed the service
  worker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Worker',
    required: true
  },
  
  // Bill Details
  bill_number: {
    type: String,
    required: true,
    unique: true
  },
  
  // Service details (snapshot from query)
  service_type: {
    type: String,
    required: true
  },
  
  service_description: {
    type: String,
    required: true
  },
  
  // Billing Items
  items: [{
    description: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1
    },
    rate: {
      type: Number,
      required: true,
      min: 0
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  
  // Cost Breakdown
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  
  tax_rate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  discount_type: {
    type: String,
    enum: ['percentage', 'fixed'],
    default: 'fixed'
  },
  
  total_amount: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Payment Terms
  payment_status: {
    type: String,
    enum: ['pending', 'paid', 'overdue', 'cancelled'],
    default: 'pending'
  },
  
  due_date: {
    type: Date,
    required: true
  },
  
  payment_date: {
    type: Date,
    default: null
  },
  
  payment_method: {
    type: String,
    enum: ['cash', 'card', 'upi', 'bank_transfer', 'other'],
    default: null
  },
  
  payment_transaction_id: {
    type: String,
    default: null
  },
  
  // Additional Notes
  notes: {
    type: String,
    trim: true
  },
  
  terms_conditions: {
    type: String,
    default: 'Payment is due within 15 days. Late payments may incur additional charges.'
  },
  
  // Admin who created the bill
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Auth',
    required: true
  },
  
  // Timestamps
  created_at: {
    type: Date,
    default: Date.now
  },
  
  updated_at: {
    type: Date,
    default: Date.now
  },
  
  // Soft delete
  is_deleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Indexes for better performance
billSchema.index({ bill_number: 1 }, { unique: true });
billSchema.index({ user: 1 });
billSchema.index({ query: 1 });
billSchema.index({ payment_status: 1 });
billSchema.index({ due_date: 1 });
billSchema.index({ created_at: -1 });

// Generate bill number
billSchema.statics.generateBillNumber = async function() {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const count = await this.countDocuments();
  const sequence = String(count + 1).padStart(4, '0');
  return `INV-${year}${month}-${sequence}`;
};

// Virtual for amount due
billSchema.virtual('amount_due').get(function() {
  if (this.payment_status === 'paid') return 0;
  return this.total_amount;
});

// Method to check if bill is overdue
billSchema.methods.isOverdue = function() {
  if (this.payment_status === 'paid' || this.payment_status === 'cancelled') {
    return false;
  }
  return new Date() > new Date(this.due_date);
};

// Method to mark as paid
billSchema.methods.markAsPaid = async function(paymentMethod, transactionId) {
  this.payment_status = 'paid';
  this.payment_date = new Date();
  if (paymentMethod) this.payment_method = paymentMethod;
  if (transactionId) this.payment_transaction_id = transactionId;
  this.updated_at = new Date();
  return this.save();
};

module.exports = mongoose.model('Bill', billSchema);