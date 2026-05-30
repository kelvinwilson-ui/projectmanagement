import mongoose from 'mongoose';

const progressUpdateSchema = new mongoose.Schema(
  {
    board: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
    card: { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    percent: { type: Number, required: true, min: 0, max: 100 },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('ProgressUpdate', progressUpdateSchema);