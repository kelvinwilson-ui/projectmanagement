import React, { useState } from 'react';
import { Droppable } from 'react-beautiful-dnd';
import { useDispatch, useSelector } from 'react-redux';
import { createCard, deleteColumn } from '../store/boardSlice';
import Card from './Card';

const Column = ({ column, urgency, boardCreator, boardMode }) => {
  const dispatch = useDispatch();
  const { userInfo } = useSelector(state => state.auth);
  const [isAdding, setIsAdding] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');

  const isSystemColumn = () => {
    const title = String(column?.title || '').trim().toLowerCase();
    const defaultTitles = ['to do list', 'in progress', 'completed'];
    return column?.isDefault || defaultTitles.includes(title) || [0, 1, 2].includes(Number(column?.order));
  };

  const getColBg = () => {
    return '#ebecf0';
  };

  const handleAddCard = (e) => {
    e.preventDefault();
    if (!newCardTitle.trim()) return;

    dispatch(createCard({
      columnId: column._id,
      title: newCardTitle,
      order: column.cards ? column.cards.length : 0
    }));

    setNewCardTitle('');
    setIsAdding(false);
  };

  const canDelete = () => {
    if (isSystemColumn()) return false;
    if (!boardCreator) return !!userInfo?.isAdmin;
    return String(boardCreator._id || boardCreator) === String(userInfo?._id) || userInfo?.isAdmin;
  };

  const canAddCard = () => {
    if (!boardCreator) return !!userInfo?.isAdmin;
    return String(boardCreator._id || boardCreator) === String(userInfo?._id) || userInfo?.isAdmin;
  };

  return (
    <div className="pm-column" style={{
      background: getColBg(),
      width: '300px',
      padding: '10px',
      margin: '0 10px',
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', padding: '8px', color: '#172b4d' }}>{column.title}</h3>
        {canDelete(column.boardId ? column.boardId : null) && (
          <button onClick={() => dispatch(deleteColumn({ columnId: column._id }))} style={{ background: 'transparent', border: 'none', color: '#bf2600', cursor: 'pointer' }} title="Delete list">✕</button>
        )}
      </div>
      <Droppable droppableId={String(column._id)}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            style={{
              flexGrow: 1,
              minHeight: '100px',
              backgroundColor: snapshot.isDraggingOver ? 'rgba(0,0,0,0.05)' : 'transparent',
              transition: 'background-color 0.2s ease',
              padding: '4px',
              borderRadius: '4px'
            }}
          >
            {column.cards && column.cards.map((card, index) => (
              <Card key={card._id} card={card} index={index} urgency={urgency} boardCreator={boardCreator} boardMode={boardMode} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {/* Add Card Form */}
      {isAdding ? (
        <form onSubmit={handleAddCard} style={{ marginTop: '8px' }}>
          <textarea
            autoFocus
            placeholder="Enter a title for this card..."
            value={newCardTitle}
            onChange={(e) => setNewCardTitle(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '4px',
              border: 'none',
              resize: 'none',
              marginBottom: '8px',
              boxSizing: 'border-box',
              boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
            }}
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAddCard(e);
              }
            }}
          />
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button type="submit" style={{ background: '#0079bf', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>
              Add card
            </button>
            <button type="button" onClick={() => setIsAdding(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#6b778c' }}>
              ✕
            </button>
          </div>
        </form>
      ) : (
        canAddCard() ? (
        <button 
          onClick={() => setIsAdding(true)}
          style={{
            marginTop: '8px',
            textAlign: 'left',
            padding: '8px',
            background: 'transparent',
            border: 'none',
            color: '#5e6c84',
            cursor: 'pointer',
            borderRadius: '4px',
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dadbe2'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          + Add a card
        </button>
        ) : null
      )}
    </div>
  );
};

export default Column;