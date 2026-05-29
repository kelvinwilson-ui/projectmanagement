import mongoose from 'mongoose';

const boardSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    urgency: {
      type: String,
      default: 'Medium',
    },
    deadline: {
      type: Date,
    },
    collaborationMode: {
      type: String,
      enum: ['solo', 'team'],
      default: 'team',
    },
    completionAnnouncedAt: {
      type: Date,
      default: null,
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false // Set to false temporarily for backwards compatibility with old boards
    },
    columns: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Column',
      }
    ]
  },
  { timestamps: true }
);

export default mongoose.model('Board', boardSchema);