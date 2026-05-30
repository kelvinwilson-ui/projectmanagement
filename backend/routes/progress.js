import express from 'express';
import Board from '../models/Board.js';
import Card from '../models/Card.js';
import Column from '../models/Column.js';
import ProgressUpdate from '../models/ProgressUpdate.js';
import Notification from '../models/Notification.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

const canViewBoard = (user, board) => {
  if (!user || !board) return false;
  const isCreator = board.creator && String(board.creator) === String(user._id);
  return isCreator || !!user.isAdmin;
};

// Post a progress update for a card (assignee or manager)
router.post('/cards/:cardId', protect, async (req, res) => {
  try {
    const { percent, note } = req.body;
    const card = await Card.findById(req.params.cardId);
    if (!card) return res.status(404).json({ message: 'Card not found' });

    const column = await Column.findById(card.columnId);
    const parentBoard = column ? await Board.findById(column.boardId).populate('creator', 'name email isAdmin') : null;
    if (!parentBoard) return res.status(400).json({ message: 'Parent board not found' });

    const assigneeId = card.assignee ? String(card.assignee) : null;
    const isAssignee = assigneeId && assigneeId === String(req.user._id);
    const isCreator = parentBoard.creator && String(parentBoard.creator._id || parentBoard.creator) === String(req.user._id);
    if (!isAssignee && !isCreator && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to post progress for this task' });
    }

    const update = await ProgressUpdate.create({
      board: parentBoard._id,
      card: card._id,
      user: req.user._id,
      percent: Number(percent),
      note: note || ''
    });

    const populated = await ProgressUpdate.findById(update._id)
      .populate('user', 'name email')
      .populate('card', 'title')
      .populate('board', 'title');

    const managerId = parentBoard.creator ? String(parentBoard.creator._id || parentBoard.creator) : null;
    if (managerId && managerId !== String(req.user._id)) {
      const managerNote = await Notification.create({
        user: managerId,
        type: 'progress',
        data: {
          boardId: String(parentBoard._id),
          boardTitle: parentBoard.title,
          cardId: String(card._id),
          cardTitle: card.title,
          progressId: String(update._id),
          percent: Number(percent),
          text: `${req.user.name} posted ${percent}% progress on "${card.title}".`
        }
      });

      try {
        const socketId = global.connectedSockets && global.connectedSockets.get(managerId);
        if (socketId && global.io) {
          global.io.to(socketId).emit('notification', managerNote);
        }
      } catch (emitErr) {
        console.error('Socket emit error', emitErr);
      }
    }

    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Fetch progress for a board, or a specific card
router.get('/', protect, async (req, res) => {
  try {
    const { boardId, cardId } = req.query;
    if (!boardId && !cardId) return res.status(400).json({ message: 'boardId or cardId required' });

    let query = {};
    if (cardId) query.card = cardId;
    if (boardId) query.board = boardId;

    const board = boardId ? await Board.findById(boardId) : null;
    if (board && !canViewBoard(req.user, board) && String(board.creator) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to view progress for this board' });
    }

    const updates = await ProgressUpdate.find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('user', 'name email phone isAdmin')
      .populate('card', 'title assignee columnId')
      .populate('board', 'title creator');

    res.json(updates);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;