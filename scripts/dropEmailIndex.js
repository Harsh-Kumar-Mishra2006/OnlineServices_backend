const mongoose = require('mongoose');
require('dotenv').config();

const dropEmailIndex = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'your_mongodb_uri');
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('auths');

    // Get all indexes
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes);

    // Drop email_1 index if it exists
    const emailIndex = indexes.find(idx => idx.name === 'email_1');
    if (emailIndex) {
      await collection.dropIndex('email_1');
      console.log('✅ Dropped email_1 index');
    } else {
      console.log('ℹ️ email_1 index not found');
    }

    // Create new index WITHOUT unique constraint
    await collection.createIndex(
      { email: 1 },
      { 
        sparse: true,
        name: 'email_1'
      }
    );
    console.log('✅ Created new email_1 index (without unique constraint)');

    console.log('🎉 Index fixed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

dropEmailIndex();