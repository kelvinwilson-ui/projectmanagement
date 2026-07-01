import express from 'express';
import Board from '../models/Board.js';
import Column from '../models/Column.js';
import Card from '../models/Card.js';
import Notification from '../models/Notification.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

const isBoardInvolved = (board, user) => {
  if (!board || !user) return false;
  const isCreator = board.creator && String(board.creator._id || board.creator) === String(user._id);
  const isInvolved = (board.columns || []).some((column) =>
    (column.cards || []).some((card) => {
      const assigneeId = card.assignee ? String(card.assignee._id || card.assignee) : null;
      return assigneeId === String(user._id);
    })
  );

  return isCreator || isInvolved;
};

// Get all boards
router.get('/', protect, async (req, res) => {
  try {
    const boards = await Board.find()
      .populate('creator', 'name email isAdmin')
      .populate({
        path: 'columns',
        populate: {
          path: 'cards',
          model: 'Card',
          populate: [
            { path: 'assignee', model: 'User', select: 'name email' }
          ]
        }
      });

    const visibleBoards = req.user.isAdmin ? boards : boards.filter((board) => isBoardInvolved(board, req.user));

    res.json(visibleBoards);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get a single board with columns and cards populated
router.get('/:id', protect, async (req, res) => {
  try {
    let board = await Board.findById(req.params.id).populate('creator', 'name email isAdmin').populate({
      path: 'columns',
      populate: {
        path: 'cards',
        model: 'Card',
        populate: [
          { path: 'assignee', model: 'User', select: 'name email' },
          { path: 'comments.user', model: 'User', select: 'name email' }
        ]
      }
    });
    if (!board) return res.status(404).json({ message: 'Board not found' });

      if (!req.user.isAdmin && !isBoardInvolved(board, req.user)) {
      return res.status(403).json({ message: 'Not authorized to view this project' });
    }

    // Redact card descriptions for users not allowed to view them.
    // Allowed viewers: card assignee, board creator, or admins.
    const boardObj = board.toObject();
    for (const col of boardObj.columns || []) {
      for (const c of col.cards || []) {
        const assigneeId = c.assignee ? String(c.assignee._id || c.assignee) : null;
        const isAssignee = assigneeId && assigneeId === String(req.user._id);
        const isBoardCreator = boardObj.creator && String(boardObj.creator._id || boardObj.creator) === String(req.user._id);
        const isAdmin = !!req.user.isAdmin;

        if (!isAssignee && !isBoardCreator && !isAdmin) {
          // Remove description and mark as restricted so frontend can show a friendly message
          delete c.description;
          c.restricted = true;
        } else {
          c.restricted = false;
        }
      }
    }

    res.json(boardObj);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a new board
router.post('/', protect, async (req, res) => {
  // Allow admins and project managers to create new boards
  if (!req.user.isAdmin && req.user.role === 'user') {
    return res.status(403).json({ message: 'Only admins or project managers can create new projects' });
  }

  const board = new Board({
    title: req.body.title,
    description: req.body.description,
    urgency: req.body.urgency,
    deadline: req.body.deadline,
    collaborationMode: req.body.collaborationMode === 'solo' ? 'solo' : 'team',
    creator: req.user._id // Assign logged in user as creator
  });
  
  try {
    const newBoard = await board.save();
    
    // Automatically create the 3 default columns for every new project
    const col1 = await Column.create({ title: 'To Do List', boardId: newBoard._id, order: 0, isDefault: true });
    const col2 = await Column.create({ title: 'In Progress', boardId: newBoard._id, order: 1, isDefault: true });
    const col3 = await Column.create({ title: 'Completed', boardId: newBoard._id, order: 2, isDefault: true });
    
    newBoard.columns.push(col1._id, col2._id, col3._id);
    await newBoard.save();

    const populatedBoard = await Board.findById(newBoard._id).populate({
      path: 'columns',
      populate: { 
        path: 'cards', 
        model: 'Card',
        populate: [
          { path: 'assignee', model: 'User', select: 'name email' },
          { path: 'comments.user', model: 'User', select: 'name email' }
        ]
      }
    });

    res.status(201).json(populatedBoard);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update columns order and cards (for drag and drop)
router.put('/:id/columns', protect, async (req, res) => {
  try {
    const { columns } = req.body;
    
    // Update each column's cards array in the database
    for (const col of columns) {
      await Column.findByIdAndUpdate(col._id, {
        cards: col.cards.map(c => typeof c === 'string' ? c : c._id)
      });
    }
    
    res.json({ message: 'Columns updated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete a board
router.delete('/:id', protect, async (req, res) => {
  try {
    const board = await Board.findById(req.params.id).populate({
      path: 'creator',
      select: 'name email isAdmin'
    }).populate({
      path: 'columns',
      populate: {
        path: 'cards',
        model: 'Card',
        populate: {
          path: 'assignee',
          model: 'User',
          select: 'name email'
        }
      }
    });
    if (!board) return res.status(404).json({ message: 'Board not found' });
    
    // Allow deletion if user is creator or an admin. If board has no creator (old boards), allow admins to delete.
    if (board.creator) {
      const isCreator = board.creator.toString() === req.user._id.toString();
      if (!isCreator && !req.user.isAdmin) {
        return res.status(403).json({ message: 'Not authorized to delete this project, only the creator or an admin can.' });
      }
    } else {
      // No creator set: only admins can delete
      if (!req.user.isAdmin) {
        return res.status(403).json({ message: 'Not authorized to delete this project.' });
      }
    }

    const boardTitle = board.title;
    const deletedBy = req.user._id;
    const managerName = board.creator?.name || req.user.name || 'the project manager';
    const assigneeIds = new Set();

    for (const column of board.columns || []) {
      for (const card of column.cards || []) {
        const assigneeId = card.assignee ? String(card.assignee._id || card.assignee) : null;
        if (assigneeId) assigneeIds.add(assigneeId);
      }
    }

    const notificationText = `Project "${boardTitle}" was deleted by the project manager. You no longer have tasks on this project.`;

    for (const userId of assigneeIds) {
      const note = await Notification.create({
        user: userId,
        type: 'project_deleted',
        data: {
          boardId: String(board._id),
          boardTitle,
          projectManagerName: managerName,
          deletedBy: String(deletedBy),
          text: notificationText
        }
      });

      try {
        const socketId = global.connectedSockets && global.connectedSockets.get(String(userId));
        if (socketId && global.io) {
          global.io.to(socketId).emit('notification', note);
        }
      } catch (emitErr) {
        console.error('Socket emit error', emitErr);
      }
    }

    const columnIds = (board.columns || []).map((column) => column._id);
    if (columnIds.length > 0) {
      await Card.deleteMany({ columnId: { $in: columnIds } });
    }
    await Column.deleteMany({ boardId: req.params.id });
    await Board.findByIdAndDelete(req.params.id);

    res.json({ message: 'Board deleted successfully', id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;