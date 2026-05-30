import express from 'express';
import Column from '../models/Column.js';
import Board from '../models/Board.js';
import Card from '../models/Card.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

const canManageProject = (user, board) => {
  if (!user || !board) return false;
  const isCreator = board.creator && String(board.creator) === String(user._id);
  return isCreator || !!user.isAdmin;
};

const isSystemColumn = (column) => {
  if (!column) return false;
  const title = String(column.title || '').trim().toLowerCase();
  const defaultTitles = ['to do list', 'in progress', 'completed'];
  return column.isDefault || defaultTitles.includes(title) || [0, 1, 2].includes(Number(column.order));
};

// Create a new column
router.post('/', protect, async (req, res) => {
  const column = new Column({
    title: req.body.title,
    boardId: req.body.boardId,
    order: req.body.order
  });

  try {
    const newColumn = await column.save();
    
    // Auto-attach this column to the parent board
    await Board.findByIdAndUpdate(req.body.boardId, {
      $push: { columns: newColumn._id }
    });
    
    res.status(201).json(newColumn);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete a column (only board creator or admin)
router.delete('/:id', protect, async (req, res) => {
  try {
    const column = await Column.findById(req.params.id);
    if (!column) return res.status(404).json({ message: 'Column not found' });

    const board = await Board.findById(column.boardId);
    if (!board) return res.status(400).json({ message: 'Parent board not found' });

    if (!canManageProject(req.user, board)) {
      return res.status(403).json({ message: 'Not authorized to delete this column' });
    }

    // Prevent deletion of system default columns, including older boards without isDefault set
    if (isSystemColumn(column)) {
      return res.status(400).json({ message: 'Default column cannot be deleted' });
    }

    // Delete associated cards
    await Card.deleteMany({ _id: { $in: column.cards } });

    // Remove column from board
    await Board.findByIdAndUpdate(board._id, { $pull: { columns: column._id } });

    // Delete the column
    await Column.findByIdAndDelete(column._id);

    res.json({ message: 'Column deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;