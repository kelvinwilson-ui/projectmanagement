import mongoose from 'mongoose';

const cardSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    columnId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Column',
      required: true,
    },
    order: {
      type: Number,
      required: true,
    },
    dueDate: {
      type: Date,
    },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    readyForInspection: {
      type: Boolean,
      default: false
    },
    checklist: [
      {
        text: { type: String, required: true },
        completed: { type: Boolean, default: false },
        order: { type: Number, default: 0 },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    comments: [
      {
        text: { type: String, required: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

export default mongoose.model('Card', cardSchema);