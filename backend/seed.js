import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Board from './models/Board.js';
import Column from './models/Column.js';
import Card from './models/Card.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/project_management';

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB for seeding');
    
    await Board.deleteMany({});
    await Column.deleteMany({});
    await Card.deleteMany({});

    const board = await Board.create({ title: 'Main Project Board' });

    const col1 = await Column.create({ title: 'To Do List', boardId: board._id, order: 0 });
    const col2 = await Column.create({ title: 'In Progress', boardId: board._id, order: 1 });
    const col3 = await Column.create({ title: 'Completed', boardId: board._id, order: 2 });

    const card1 = await Card.create({ title: 'Set up Database Models', columnId: col1._id, order: 0 });
    const card2 = await Card.create({ title: 'Create Redux Store', columnId: col1._id, order: 1 });

    const card3 = await Card.create({ title: 'Integrate React DnD', columnId: col2._id, order: 0 });

    col1.cards.push(card1._id, card2._id);
    await col1.save();
    
    col2.cards.push(card3._id);
    await col2.save();

    board.columns.push(col1._id, col2._id, col3._id);
    await board.save();

    console.log('Database successfully seeded!');
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
