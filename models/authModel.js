//authModel.js
const mongoose = require('mongoose');

const authSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['user', 'worker', 'admin'], 
    default: 'user' 
  },
  profile: {
    age: { type: String, default: '' },
    gender: { type: String, default: '' },
    dob: { type: String, default: '' },
    address: { type: String, default: '' },
    education: { type: String, default: '' },
    bio: { type: String, default: '' },
    avatar: { type: String, default: '' }
  },
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Auth', authSchema);