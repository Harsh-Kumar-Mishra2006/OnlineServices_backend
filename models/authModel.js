// models/authModel.js
const mongoose = require('mongoose');

const authSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    // ONLY make email required for users and admins in controller
    // For workers, it's optional
    sparse: true, // Allows multiple null values
    default: null,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    // REMOVE 'unique: true' from here
  },
  username: { 
    type: String, 
    sparse: true,
    default: null,
    trim: true
    // REMOVE 'unique: true' from here
  },
  phone: { 
    type: String, 
    required: true, // REQUIRED for ALL roles
    unique: true,   // Phone is UNIQUE primary identifier
    trim: true,
    match: [/^[0-9]{10,15}$/, 'Please enter a valid phone number']
  },
  password: { 
    type: String, 
    required: true 
  },
  role: { 
    type: String, 
    enum: ['user', 'worker', 'admin'], 
    default: 'user' 
  },
  profile: {
    age: { type: String, default: '' },
    gender: { type: String, enum: ['male', 'female', 'other', ''], default: '' },
    dob: { type: String, default: '' },
    address: { type: String, default: '' },
    education: { type: String, default: '' },
    bio: { type: String, default: '' },
    avatar: { type: String, default: '' }
  },
  isVerified: { 
    type: Boolean, 
    default: false 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true
});

// Indexes
authSchema.index({ phone: 1 }, { unique: true }); // Phone is primary key (UNIQUE)
authSchema.index({ email: 1 }, { sparse: true }); // Email index WITHOUT unique
authSchema.index({ username: 1 }, { sparse: true }); // Username index WITHOUT unique
authSchema.index({ role: 1, isActive: 1 });

module.exports = mongoose.model('Auth', authSchema);