import express from 'express';
import Card from '../models/Card.js';
import Column from '../models/Column.js';
import Board from '../models/Board.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

const canManageProject = (user, board) => {
  if (!user || !board) return false;
  const isCreator = board.creator && String(board.creator) === String(user._id);
  return isCreator || !!user.isAdmin;
};

// Create a new card
router.post('/', protect, async (req, res) => {
  const card = new Card({
    title: req.body.title,
    description: req.body.description,
    columnId: req.body.columnId,
    order: req.body.order
  });

  try {
    // Check permission: only board creator or admin can create cards in a board
    const parentColumn = await Column.findById(req.body.columnId);
    if (!parentColumn) return res.status(400).json({ message: 'Parent column not found' });
    const parentBoard = await Board.findById(parentColumn.boardId);
    if (!parentBoard) return res.status(400).json({ message: 'Parent board not found' });

    if (!canManageProject(req.user, parentBoard)) {
      return res.status(403).json({ message: 'Not authorized to create a card on this board' });
    }

    const newCard = await card.save();

    // Auto-attach this card to its parent column
    await Column.findByIdAndUpdate(req.body.columnId, {
      $push: { cards: newCard._id }
    });

    res.status(201).json(newCard);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update a card (drag-and-drop between columns or reordering)
router.put('/:id', protect, async (req, res) => {
  try {
    const cardId = req.params.id;
    // If the update contains detail fields (description, assignee, dueDate, title), restrict who may perform them.
    const detailFields = ['description', 'assignee', 'dueDate', 'title'];
    const isDetailUpdate = Object.keys(req.body).some(k => detailFields.includes(k));

    if (isDetailUpdate) {
      const card = await Card.findById(cardId);
      if (!card) return res.status(404).json({ message: 'Card not found' });

      const column = await Column.findById(card.columnId);
      if (!column) return res.status(400).json({ message: 'Parent column not found' });

      const board = await Board.findById(column.boardId);
      if (!board) return res.status(400).json({ message: 'Parent board not found' });

      if (!canManageProject(req.user, board)) {
        return res.status(403).json({ message: 'Not authorized to edit this card details' });
      }
    }

    // Allow non-detail updates (e.g., columnId/order for drag-and-drop)
    await Card.findByIdAndUpdate(cardId, req.body);

    // Fetch fresh populated card and redact as needed for the requester
    const populated = await Card.findById(cardId)
      .populate('assignee', 'name email')
      .populate('comments.user', 'name email');

    // Determine restricted flag
    const column = await Column.findById(populated.columnId);
    const board = column ? await Board.findById(column.boardId) : null;
    const assigneeId = populated.assignee ? String(populated.assignee._id || populated.assignee) : null;
    const isAssignee = assigneeId && assigneeId === String(req.user._id);
    const isCreator = board && board.creator && String(board.creator) === String(req.user._id);
    const isAdmin = !!req.user.isAdmin;

    const cardObj = populated.toObject();
    if (!isAssignee && !isCreator && !isAdmin) {
      delete cardObj.description;
      cardObj.restricted = true;
    } else {
      cardObj.restricted = false;
    }

    res.json(cardObj);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get single card details, redacting description for unauthorized users
router.get('/:id', protect, async (req, res) => {
  try {
    const card = await Card.findById(req.params.id)
      .populate('assignee', 'name email')
      .populate('comments.user', 'name email');
    if (!card) return res.status(404).json({ message: 'Card not found' });

    const column = await Column.findById(card.columnId);
    const board = column ? await Board.findById(column.boardId) : null;

    const assigneeId = card.assignee ? String(card.assignee._id || card.assignee) : null;
    const isAssignee = assigneeId && assigneeId === String(req.user._id);
    const isCreator = board && board.creator && String(board.creator) === String(req.user._id);
    const isAdmin = !!req.user.isAdmin;

    const cardObj = card.toObject();
    if (!isAssignee && !isCreator && !isAdmin) {
      delete cardObj.description;
      cardObj.restricted = true;
    } else {
      cardObj.restricted = false;
    }

    res.json(cardObj);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete a card (only creator of board or admin)
router.delete('/:id', protect, async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);
    if (!card) return res.status(404).json({ message: 'Card not found' });

    // Find parent column and board
    const column = await Column.findById(card.columnId);
    if (!column) return res.status(400).json({ message: 'Parent column not found' });

    const board = await Board.findById(column.boardId);
    if (!board) return res.status(400).json({ message: 'Parent board not found' });

    if (!canManageProject(req.user, board)) {
      return res.status(403).json({ message: 'Not authorized to delete this card' });
    }

    // Proceed with delete
    await Card.findByIdAndDelete(req.params.id);
    await Column.findByIdAndUpdate(card.columnId, { $pull: { cards: card._id } });

    res.json({ message: 'Card deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Mark a card as ready for inspection (assignee can mark)
router.put('/:id/ready', protect, async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);
    if (!card) return res.status(404).json({ message: 'Card not found' });

    const assigneeId = card.assignee ? String(card.assignee) : null;
    const isAssignee = assigneeId && assigneeId === String(req.user._id);

    // Allow assignee, board creator, or admin to toggle readiness
    const column = await Column.findById(card.columnId);
    const board = column ? await Board.findById(column.boardId) : null;
    const isCreator = board && board.creator && String(board.creator) === String(req.user._id);

    if (!isAssignee && !isCreator && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to mark readiness for this card' });
    }

    // Toggle or set based on body
    if (typeof req.body.ready === 'boolean') {
      card.readyForInspection = req.body.ready;
    } else {
      card.readyForInspection = !card.readyForInspection;
    }

    await card.save();
    res.json(card);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add a comment to a card
router.post('/:id/comments', protect, async (req, res) => {
  try {
    const { text, user } = req.body;
    
    const updatedCard = await Card.findByIdAndUpdate(
      req.params.id,
      {
        $push: { comments: { text, user } }
      },
      { new: true }
    )
    .populate('assignee', 'name email')
    .populate('comments.user', 'name email');
    
    // Detect mentions in comment text (email mentions like @user@example.com)
    try {
      const mentionRegex = /@([\w.%+-]+@[\w.-]+\.[A-Za-z]{2,})/g;
      const mentions = new Set();
      let m;
      while ((m = mentionRegex.exec(text || '')) !== null) {
        mentions.add(m[1].toLowerCase());
      }

      if (mentions.size > 0) {
        const cardObj = await Card.findById(req.params.id);
        const column = await Column.findById(cardObj.columnId);
        const board = column ? await Board.findById(column.boardId) : null;

        for (const email of mentions) {
          const mentionedUser = await User.findOne({ email });
          if (!mentionedUser) continue;
          // Don't notify the commenter themselves
          if (String(mentionedUser._id) === String(req.user._id)) continue;

          await Notification.create({
            user: mentionedUser._id,
            type: 'mention',
            data: {
              cardId: req.params.id,
              boardId: board ? String(board._id) : null,
              text,
              from: req.user._id
            }
          });
        }
      }
    } catch (ign) {
      // non-fatal; continue
      console.error('Mention processing error', ign);
    }

    res.json(updatedCard);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Checklist endpoints
// Add a checklist item
router.post('/:id/checklists', protect, async (req, res) => {
  try {
    const { text, order } = req.body;
    if (!text) return res.status(400).json({ message: 'Checklist item text required' });

    const card = await Card.findById(req.params.id);
    if (!card) return res.status(404).json({ message: 'Card not found' });

    const column = await Column.findById(card.columnId);
    const board = column ? await Board.findById(column.boardId) : null;
    const assigneeId = card.assignee ? String(card.assignee) : null;
    const isAssignee = assigneeId && assigneeId === String(req.user._id);
    const isCreator = board && board.creator && String(board.creator) === String(req.user._id);

    if (!isAssignee && !isCreator && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to add checklist items' });
    }

    const newItem = { text, order: typeof order === 'number' ? order : (card.checklist.length || 0) };
    card.checklist.push(newItem);
    await card.save();

    const populated = await Card.findById(card._id).populate('assignee', 'name email').populate('comments.user', 'name email');
    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update a checklist item (toggle complete or edit text)
router.put('/:id/checklists/:itemId', protect, async (req, res) => {
  try {
    const { text, completed, order } = req.body;
    const card = await Card.findById(req.params.id);
    if (!card) return res.status(404).json({ message: 'Card not found' });

    const column = await Column.findById(card.columnId);
    const board = column ? await Board.findById(column.boardId) : null;
    const assigneeId = card.assignee ? String(card.assignee) : null;
    const isAssignee = assigneeId && assigneeId === String(req.user._id);
    const isCreator = board && board.creator && String(board.creator) === String(req.user._id);

    if (!isAssignee && !isCreator && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to update checklist items' });
    }

    const item = card.checklist.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Checklist item not found' });

    if (typeof text === 'string') item.text = text;
    if (typeof completed === 'boolean') item.completed = completed;
    if (typeof order === 'number') item.order = order;

    await card.save();

    const populated = await Card.findById(card._id).populate('assignee', 'name email').populate('comments.user', 'name email');
    res.json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete a checklist item
router.delete('/:id/checklists/:itemId', protect, async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);
    if (!card) return res.status(404).json({ message: 'Card not found' });

    const column = await Column.findById(card.columnId);
    const board = column ? await Board.findById(column.boardId) : null;
    const assigneeId = card.assignee ? String(card.assignee) : null;
    const isAssignee = assigneeId && assigneeId === String(req.user._id);
    const isCreator = board && board.creator && String(board.creator) === String(req.user._id);

    if (!isAssignee && !isCreator && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to delete checklist items' });
    }

    const item = card.checklist.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Checklist item not found' });

    item.remove();
    await card.save();

    const populated = await Card.findById(card._id).populate('assignee', 'name email').populate('comments.user', 'name email');
    res.json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;