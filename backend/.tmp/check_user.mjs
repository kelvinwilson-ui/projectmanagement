import mongoose from 'mongoose';
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/project_management';
await mongoose.connect(uri);
const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({ name:String, email:String, phone:String, password:String, mustSetPassword:Boolean, isAdmin:Boolean }));
const Board = mongoose.models.Board || mongoose.model('Board', new mongoose.Schema({ title:String, creator:{ type: mongoose.Schema.Types.ObjectId, ref:'User' } }));
const user = await User.findOne({ email: 'xqulfiis@gmail.com' }).lean();
console.log(JSON.stringify({ user }, null, 2));
if (user) {
  const boards = await Board.find({}).populate('creator', 'name email isAdmin').lean();
  const createdBoards = boards.filter(b => String(b.creator?._id || b.creator) === String(user._id));
  console.log(JSON.stringify({ createdBoards: createdBoards.map(b => ({ _id: b._id, title: b.title, creator: b.creator })), allBoards: boards.map(b => ({ _id: b._id, title: b.title, creator: b.creator })) }, null, 2));
}
await mongoose.disconnect();
