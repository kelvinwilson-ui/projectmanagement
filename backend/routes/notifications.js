import express from 'express';
import Notification from '../models/Notification.js';
import Board from '../models/Board.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get current user's notifications
router.get('/', protect, async (req, res) => {
  try {
    const notes = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100);
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Mark a notification as read
router.put('/:id/read', protect, async (req, res) => {
  try {
    const note = await Notification.findById(req.params.id);
    if (!note) return res.status(404).json({ message: 'Notification not found' });
    if (String(note.user) !== String(req.user._id)) return res.status(403).json({ message: 'Not authorized' });

    note.read = true;
    await note.save();
    res.json(note);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Mark a notification as unread
router.put('/:id/unread', protect, async (req, res) => {
  try {
    const note = await Notification.findById(req.params.id);
    if (!note) return res.status(404).json({ message: 'Notification not found' });
    if (String(note.user) !== String(req.user._id)) return res.status(403).json({ message: 'Not authorized' });

    note.read = false;
    await note.save();
    res.json(note);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Mark all as read
router.put('/read-all', protect, async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user._id, read: false }, { $set: { read: true } });
    res.json({ message: 'All notifications marked read' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Clear project-related notifications for a board (manager/admin only)
router.delete('/project/:boardId', protect, async (req, res) => {
  try {
    const board = await Board.findById(req.params.boardId).populate('creator', 'name email isAdmin');
    if (!board) return res.status(404).json({ message: 'Board not found' });

    const isCreator = board.creator && String(board.creator._id || board.creator) === String(req.user._id);
    if (!isCreator && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to clear project notifications' });
    }

    await Notification.deleteMany({
      type: { $in: ['project_deleted', 'project_completed'] },
      'data.boardId': String(req.params.boardId)
    });

    res.json({ message: 'Project notifications cleared' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
