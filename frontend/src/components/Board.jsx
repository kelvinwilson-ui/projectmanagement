import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { DragDropContext } from 'react-beautiful-dnd';
import { fetchBoards, fetchBoardDetails, updateBoardOptimistically, updateCardPosition, createColumn, updateBoardColumns } from '../store/boardSlice';
import { fetchAllUsers } from '../store/authSlice';
import Column from './Column';

import { useParams, useNavigate } from 'react-router-dom';

const Board = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { currentBoard, status, list } = useSelector((state) => state.boards);

  const [boardData, setBoardData] = useState(null);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [timeLeft, setTimeLeft] = useState('');
  const [celebrationActive, setCelebrationActive] = useState(false);
  const [confetti, setConfetti] = useState([]);
  const [moveCongratsActive, setMoveCongratsActive] = useState(false);
  const [moveCongratsPieces, setMoveCongratsPieces] = useState([]);
  const [deadlineMissedActive, setDeadlineMissedActive] = useState(false);
  const [deadlineMissedPieces, setDeadlineMissedPieces] = useState([]);
  const previousAllCompleteRef = useRef(false);

  const celebrationKey = id ? `celebration-dismissed-${id}` : null;
  const deadlineMissedKey = id ? `deadline-missed-dismissed-${id}` : null;

  // Timer effect to calculate countdown based on deadline
  useEffect(() => {
    if (!boardData?.deadline) return;

    const calculateTimeLeft = () => {
      const difference = new Date(boardData.deadline) - new Date();
      if (difference <= 0) {
        setTimeLeft('Expired');
        return;
      }
      
      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [boardData?.deadline]);

  useEffect(() => {
    if (id) {
      dispatch(fetchBoardDetails(id));
      dispatch(fetchAllUsers());
    }
  }, [id, dispatch]);

  useEffect(() => {
    if (currentBoard) {
      setBoardData(currentBoard);
    }
  }, [currentBoard]);

  const handleAddColumn = (e) => {
    e.preventDefault();
    if (!newColumnTitle.trim() || !boardData) return;

    dispatch(createColumn({
      boardId: boardData._id,
      title: newColumnTitle,
      order: boardData.columns ? boardData.columns.length : 0
    }));

    setNewColumnTitle('');
    setIsAddingColumn(false);
  };

  const onDragEnd = (result) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const sourceColumn = boardData.columns.find(col => String(col._id) === source.droppableId);
    const destColumn = boardData.columns.find(col => String(col._id) === destination.droppableId);
    const movedFromCompleted = isCompletedColumn(sourceColumn) && !isCompletedColumn(destColumn);

    const sourceCards = Array.from(sourceColumn.cards || []).map(c => ({...c}));
    const destCards = source.droppableId === destination.droppableId ? sourceCards : Array.from(destColumn.cards || []).map(c => ({...c}));

    const [movedCard] = sourceCards.splice(source.index, 1);
    
    // Update the columnId immediately so visually it matches
    const updatedMovedCard = { ...movedCard, columnId: destination.droppableId };
    destCards.splice(destination.index, 0, updatedMovedCard);

    sourceCards.forEach((c, i) => c.order = i);
    if (source.droppableId !== destination.droppableId) {
      destCards.forEach((c, i) => c.order = i);
    }

    const updatedColumns = boardData.columns.map(col => {
      if (String(col._id) === source.droppableId) return { ...col, cards: sourceCards };
      if (String(col._id) === destination.droppableId) return { ...col, cards: destCards };
      return col;
    });

    const newBoardState = { ...boardData, columns: updatedColumns };
    setBoardData(newBoardState);
    dispatch(updateBoardOptimistically(newBoardState));

    // Update card's column ID for consistency 
    dispatch(updateCardPosition({ 
      cardId: draggableId, 
      data: { columnId: destination.droppableId, order: destination.index } 
    }));
    
    // Crucially update the arrays in the backend to match the new visual order
    dispatch(updateBoardColumns({
      boardId: id,
      columns: updatedColumns
    }));

    if (movedFromCompleted) {
      const colors = ['#ff4d6d', '#ffd166', '#06d6a0', '#4dabf7', '#f06595', '#9c88ff'];
      const burst = Array.from({ length: 42 }, (_, index) => ({
        id: `${Date.now()}-${index}-${Math.random()}`,
        left: Math.random() * 100,
        delay: Math.random() * 0.4,
        duration: 2.4 + Math.random() * 1.6,
        size: 8 + Math.random() * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotate: Math.random() * 360,
      }));

      setMoveCongratsPieces(burst);
      setMoveCongratsActive(true);

      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(`Nice move, ${projectManagerName}!`, {
            body: 'A completed task was moved back into progress.',
          });
        } catch (error) {
          // ignore browser notification failures
        }
      }

      setTimeout(() => {
        setMoveCongratsPieces([]);
      }, 3200);
    }
  };

  const getBgColor = (urgency) => {
    return 'transparent';
  };

  const isCompletedColumn = (column) => {
    const title = String(column?.title || '').trim().toLowerCase();
    return column?.isDefault && (column?.order === 2 || title === 'completed') || title === 'completed' || Number(column?.order) === 2;
  };

  const projectManagerName = boardData?.creator?.name || 'Project Manager';

  const projectParticipants = (() => {
    const participants = [];
    const seen = new Set();

    const addUser = (user) => {
      if (!user) return;
      const id = String(user._id || user);
      if (seen.has(id)) return;
      seen.add(id);
      participants.push(user);
    };

    addUser(boardData?.creator);
    (boardData?.columns || []).forEach((column) => {
      (column.cards || []).forEach((card) => addUser(card.assignee));
    });

    return participants;
  })();

  useEffect(() => {
    if (!boardData || !boardData.deadline) {
      setCelebrationActive(false);
      setDeadlineMissedActive(false);
      previousAllCompleteRef.current = false;
      return;
    }

    const now = new Date();
    const deadlineDate = new Date(boardData.deadline);
    const allCards = (boardData.columns || []).flatMap((column) => column.cards || []);
    const completedColumn = (boardData.columns || []).find((column) => isCompletedColumn(column));
    const completedCards = completedColumn?.cards || [];
    const allComplete = allCards.length > 0 && completedCards.length === allCards.length;
    const dismissed = celebrationKey ? localStorage.getItem(celebrationKey) === '1' : false;
    const deadlineMissedDismissed = deadlineMissedKey ? localStorage.getItem(deadlineMissedKey) === '1' : false;

    if (previousAllCompleteRef.current && !allComplete && celebrationKey) {
      localStorage.removeItem(celebrationKey);
    }

    previousAllCompleteRef.current = allComplete;

    if (allComplete && now <= deadlineDate && !dismissed) {
      setCelebrationActive(true);
    } else {
      setCelebrationActive(false);
      setConfetti([]);
    }

    if (now > deadlineDate && !allComplete && !deadlineMissedDismissed) {
      setDeadlineMissedActive(true);
    } else {
      setDeadlineMissedActive(false);
      setDeadlineMissedPieces([]);
    }
  }, [boardData, celebrationKey]);

  useEffect(() => {
    if (!celebrationActive) return;

    const spawnConfetti = () => {
      const colors = ['#ff4d6d', '#ffd166', '#06d6a0', '#4dabf7', '#f06595', '#9c88ff'];
      const newPieces = Array.from({ length: 18 }, (_, index) => ({
        id: `${Date.now()}-${index}-${Math.random()}`,
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        duration: 3.5 + Math.random() * 2.5,
        size: 8 + Math.random() * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotate: Math.random() * 360,
      }));

      setConfetti((prev) => [...prev.slice(-220), ...newPieces]);
    };

    spawnConfetti();
    const timer = setInterval(spawnConfetti, 450);
    return () => clearInterval(timer);
  }, [celebrationActive]);

  useEffect(() => {
    if (!deadlineMissedActive) return;

    const playSadTone = () => {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const context = new AudioContextClass();
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(280, context.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(180, context.currentTime + 0.6);
        gainNode.gain.setValueAtTime(0.04, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.7);
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.75);
        oscillator.onended = () => context.close().catch(() => {});
      } catch (error) {
        // ignore audio failures
      }
    };

    const spawnPieces = () => {
      const colors = ['#94a3b8', '#cbd5e1', '#60a5fa', '#a5b4fc'];
      const newPieces = Array.from({ length: 14 }, (_, index) => ({
        id: `${Date.now()}-${index}-${Math.random()}`,
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        duration: 4 + Math.random() * 2.5,
        size: 7 + Math.random() * 9,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotate: Math.random() * 360,
      }));

      setDeadlineMissedPieces((prev) => [...prev.slice(-180), ...newPieces]);
    };

    playSadTone();
    spawnPieces();
    const timer = setInterval(spawnPieces, 650);
    return () => clearInterval(timer);
  }, [deadlineMissedActive]);

  const closeCelebration = () => {
    if (celebrationKey) {
      localStorage.setItem(celebrationKey, '1');
    }
    setCelebrationActive(false);
    setConfetti([]);
  };

  const closeMoveCongrats = () => {
    setMoveCongratsActive(false);
    setMoveCongratsPieces([]);
  };

  const closeDeadlineMissed = () => {
    if (deadlineMissedKey) {
      localStorage.setItem(deadlineMissedKey, '1');
    }
    setDeadlineMissedActive(false);
    setDeadlineMissedPieces([]);
  };

  if (status === 'loading' || !boardData) return <div style={{ padding: '20px', color: 'white' }}>Loading board...</div>;

  return (
    <div className="pm-page pm-board" style={{ 
      padding: '20px', 
      minHeight: '100%', 
      display: 'flex', 
      flexDirection: 'column'
    }}>
      {celebrationActive && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          background: 'rgba(5, 15, 31, 0.72)',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none'
          }}>
            {confetti.map((piece) => (
              <span
                key={piece.id}
                style={{
                  position: 'absolute',
                  left: `${piece.left}%`,
                  top: '-10vh',
                  width: piece.size,
                  height: piece.size * 1.5,
                  background: piece.color,
                  transform: `rotate(${piece.rotate}deg)`,
                  borderRadius: 2,
                  opacity: 0.95,
                  animation: `confetti-fall ${piece.duration}s linear forwards`,
                  animationDelay: `${piece.delay}s`,
                }}
              />
            ))}
          </div>

          <div style={{
            position: 'relative',
            zIndex: 9999,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            color: 'white'
          }}>
            <div style={{
              fontSize: 'clamp(2rem, 5vw, 4.5rem)',
              fontWeight: 900,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              textShadow: '0 6px 24px rgba(0,0,0,0.45)',
              animation: 'celebrate-pop 1.4s ease-in-out infinite alternate'
            }}>
              Congratulations, {projectManagerName}!
            </div>
            <div style={{
              marginTop: 12,
              fontSize: 'clamp(1rem, 2vw, 1.4rem)',
              maxWidth: 700,
              opacity: 0.95,
              lineHeight: 1.5
            }}>
              Every item is complete before the deadline. Great work.
            </div>

            <div style={{
              marginTop: 28,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              justifyContent: 'center'
            }}>
              {Array.from({ length: 6 }).map((_, index) => (
                <span key={index} style={{
                  padding: '10px 18px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.16)',
                  border: '1px solid rgba(255,255,255,0.28)',
                  fontWeight: 700,
                  animation: `name-pulse 1.8s ease-in-out ${index * 0.12}s infinite alternate`
                }}>
                  {projectManagerName}
                </span>
              ))}
            </div>

            <button
              type="button"
              onClick={closeCelebration}
              style={{
                marginTop: 32,
                padding: '12px 20px',
                border: 'none',
                borderRadius: 10,
                background: '#ffd166',
                color: '#102a43',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 10px 30px rgba(0,0,0,0.25)'
              }}
            >
              Close Celebration
            </button>
          </div>
        </div>
      )}
      {moveCongratsActive && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9997,
          background: 'rgba(8, 23, 48, 0.55)',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {moveCongratsPieces.map((piece) => (
              <span
                key={piece.id}
                style={{
                  position: 'absolute',
                  left: `${piece.left}%`,
                  top: '-10vh',
                  width: piece.size,
                  height: piece.size * 1.5,
                  background: piece.color,
                  transform: `rotate(${piece.rotate}deg)`,
                  borderRadius: 2,
                  opacity: 0.95,
                  animation: `confetti-fall ${piece.duration}s linear forwards`,
                  animationDelay: `${piece.delay}s`,
                }}
              />
            ))}
          </div>

          <div style={{
            position: 'relative',
            zIndex: 9998,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            color: 'white',
            padding: 24
          }}>
            <div style={{
              fontSize: 'clamp(1.8rem, 4.5vw, 4rem)',
              fontWeight: 900,
              textShadow: '0 6px 24px rgba(0,0,0,0.45)',
              animation: 'celebrate-pop 1.2s ease-in-out infinite alternate'
            }}>
              Great move, {projectManagerName}!
            </div>
            <div style={{ marginTop: 12, fontSize: 'clamp(1rem, 2vw, 1.2rem)', maxWidth: 700, lineHeight: 1.5 }}>
              Great move — you’re moving through every task properly.
            </div>
            <button
              type="button"
              onClick={closeMoveCongrats}
              style={{
                marginTop: 28,
                padding: '12px 20px',
                border: 'none',
                borderRadius: 10,
                background: '#06d6a0',
                color: '#07212f',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 10px 30px rgba(0,0,0,0.25)'
              }}
            >
              Close Congratulation
            </button>
          </div>
        </div>
      )}
      {deadlineMissedActive && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9996,
          background: 'rgba(15, 23, 42, 0.76)',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {deadlineMissedPieces.map((piece) => (
              <span
                key={piece.id}
                style={{
                  position: 'absolute',
                  left: `${piece.left}%`,
                  top: '-10vh',
                  width: piece.size,
                  height: piece.size * 1.5,
                  background: piece.color,
                  transform: `rotate(${piece.rotate}deg)`,
                  borderRadius: 2,
                  opacity: 0.88,
                  animation: `confetti-fall ${piece.duration}s linear forwards`,
                  animationDelay: `${piece.delay}s`,
                }}
              />
            ))}
          </div>

          <div style={{
            position: 'relative',
            zIndex: 9997,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            color: 'white',
            padding: 24
          }}>
            <div style={{
              fontSize: 'clamp(1.8rem, 4.5vw, 4rem)',
              fontWeight: 900,
              textShadow: '0 6px 24px rgba(0,0,0,0.45)',
              animation: 'celebrate-pop 1.2s ease-in-out infinite alternate'
            }}>
              Keep going, {projectManagerName}
            </div>
            <div style={{ marginTop: 12, fontSize: 'clamp(1rem, 2vw, 1.2rem)', maxWidth: 760, lineHeight: 1.6 }}>
              The deadline has passed, but the project is not finished yet. Don’t stop here. Reset, regroup, and finish strong.
            </div>
            <button
              type="button"
              onClick={closeDeadlineMissed}
              style={{
                marginTop: 28,
                padding: '12px 20px',
                border: 'none',
                borderRadius: 10,
                background: '#94a3b8',
                color: '#0f172a',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 10px 30px rgba(0,0,0,0.25)'
              }}
            >
              Close Message
            </button>
          </div>
        </div>
      )}
      <div className="pm-board__topbar" style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
        <button 
          onClick={() => navigate('/')} 
          style={{ 
            background: 'rgba(255,255,255,0.2)', 
            border: 'none', 
            color: 'white', 
            padding: '8px 12px', 
            borderRadius: '4px', 
            marginRight: '20px', 
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
          onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'}
          onMouseOut={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
        >
          &larr; Back to Dashboard
        </button>
        <div>
          <h2 style={{ margin: 0, color: 'white' }}>{boardData.title}</h2>
          {boardData.description && (
            <p style={{ margin: '5px 0 0 0', color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem' }}>
              {boardData.description} 
              <span style={{ 
                marginLeft: '10px', padding: '2px 8px', borderRadius: '10px', fontSize: '0.8rem',
                backgroundColor: 'rgba(255,255,255,0.2)' 
              }}>
                {boardData.urgency || 'Medium'} Urgency
              </span>
              {boardData.deadline && (
                <span style={{ 
                  marginLeft: '10px', padding: '2px 8px', borderRadius: '10px', fontSize: '0.8rem',
                  backgroundColor: 'rgba(255,255,255,0.2)' 
                }}>
                  ⏰ Due: {new Date(boardData.deadline).toLocaleDateString()} {timeLeft && `(${timeLeft})`}
                </span>
              )}
            </p>
          )}
            {projectParticipants.length > 0 && (
              <div style={{ marginTop: '6px', color: 'rgba(255,255,255,0.85)', fontSize: '0.85rem' }}>
                Project Managers: {projectParticipants.map((user) => user?.name || 'Unknown').join(', ')}
              </div>
            )}
        </div>
      </div>
      
      <div className="pm-board__lanes" style={{ display: 'flex', overflowX: 'auto', flexGrow: 1, alignItems: 'flex-start', paddingBottom: '20px' }}>
        <DragDropContext onDragEnd={onDragEnd}>
          {boardData.columns?.map(column => (
            <Column key={column._id} column={column} urgency={boardData.urgency || 'Medium'} boardCreator={boardData.creator} boardMode={boardData.collaborationMode} />
          ))}
        </DragDropContext>

        <div style={{ minWidth: '300px', marginLeft: '10px', flexShrink: 0 }}>
          {isAddingColumn ? (
            <form onSubmit={handleAddColumn} style={{ background: '#ebecf0', padding: '10px', borderRadius: '8px' }}>
              <input
                autoFocus
                type="text"
                placeholder="Enter list title..."
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '2px solid #0079bf',
                  marginBottom: '8px',
                  boxSizing: 'border-box'
                }}
              />
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button type="submit" style={{ background: '#0079bf', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>
                  Add list
                </button>
                <button type="button" onClick={() => setIsAddingColumn(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#6b778c' }}>
                  ✕
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsAddingColumn(true)}
              style={{
                width: '100%',
                padding: '12px',
                background: 'rgba(255, 255, 255, 0.24)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.32)'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.24)'}
            >
              + Add another list
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Board;