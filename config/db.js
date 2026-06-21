const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Debug: Check if env variable is loaded
    console.log('Attempting to connect with URI:', process.env.MONGODB_URI ? 'URI is set' : 'URI is NOT set');
    
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI is not defined in environment variables');
      console.error('Make sure you have:');
      console.error('1. Created a .env file');
      console.error('2. Required dotenv in your main file: require("dotenv").config()');
      console.error('3. The .env file is in the root directory');
      process.exit(1);
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Troubleshooting tips:');
    console.error('1. Is MongoDB running? Run: mongod (or sudo systemctl start mongod)');
    console.error('2. Check MongoDB status: sudo systemctl status mongodb');
    console.error('3. Try: mongosh to test MongoDB shell');
    process.exit(1);
  }
};

module.exports = connectDB;