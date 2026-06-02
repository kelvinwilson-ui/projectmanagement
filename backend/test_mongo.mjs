import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb+srv://kelvinwilson_db_user_projectmanagement:7OzhXlQUzEEfKQSn@cluster0.rkbnvuf.mongodb.net/?appName=Cluster0';

console.log('Testing MongoDB connection...');
console.log('URI:', MONGODB_URI.substring(0, 60) + '...');

try {
  await mongoose.connect(MONGODB_URI, {
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 10000,
  });
  console.log('✅ MongoDB connected!');
  process.exit(0);
} catch (error) {
  console.error('❌ Connection failed:', error.message);
  process.exit(1);
}
