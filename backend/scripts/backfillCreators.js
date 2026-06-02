import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Board from '../models/Board.js';
import User from '../models/User.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/project_management';

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB for backfill');

  // Find an admin user to assign as creator if available
  let user = await User.findOne({ isAdmin: true });
  if (!user) {
    user = await User.findOne();
  }

  if (!user) {
    console.log('No users found to assign as creator. Create a user first.');
    process.exit(1);
  }

  const boards = await Board.find({ $or: [ { creator: { $exists: false } }, { creator: null } ] });
  if (boards.length === 0) {
    console.log('No boards require backfill.');
    process.exit(0);
  }

  console.log(`Found ${boards.length} boards to update. Assigning to user: ${user._id} (${user.email || user.name})`);

  for (const b of boards) {
    b.creator = user._id;
    await b.save();
    console.log('Updated board', b._id, '-> creator', user._id);
  }

  console.log('Backfill complete.');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
