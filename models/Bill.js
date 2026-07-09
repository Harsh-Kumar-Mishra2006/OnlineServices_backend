// models/Bill.js
const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
  // Bill Details
  bill_number: {
    type: String,
    required: true,
    unique: true
  },
  
  // Customer Information (manually entered by admin)
  customer_name: {
    type: String,
    required: true
  },
  customer_email: {
    type: String,
    required: true
  },
  customer_phone: {
    type: String,
    required: true
  },
  customer_address: {
    street: String,
    city: String,
    state: String,
    pincode: String
  },
  
  // Service Information (manually entered by admin)
  service_type: {
    type: String,
    required: true
  },
  service_description: {
    type: String,
    required: true
  },
  
  // Worker Information (manually entered by admin)
  worker_name: {
    type: String,
    required: true
  },
  worker_phone: {
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
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  total_amount: {
    type: Number,
    required: true,
    min: 0
  },

  // Add this field to the bill schema
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    default: null
  },

  // Add this field to track if bill is paid
  is_paid: {
    type: Boolean,
    default: false
  },
  
  // Additional Notes
  notes: {
    type: String,
    trim: true
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

// Indexes
billSchema.index({ bill_number: 1 }, { unique: true });
billSchema.index({ customer_email: 1 });
billSchema.index({ created_at: -1 });

// Generate bill number
billSchema.statics.generateBillNumber = async function() {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const count = await this.countDocuments();
  const sequence = String(count + 1).padStart(4, '0');
  return `INV-${year}${month}-${sequence}`;
};

module.exports = mongoose.model('Bill', billSchema);