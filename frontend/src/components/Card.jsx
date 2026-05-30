import React, { useEffect, useState } from 'react';
import { Draggable } from 'react-beautiful-dnd';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import { updateCardDetails, addCardComment, toggleCardReady } from '../store/boardSlice';
import CreateAssigneeInline from './CreateAssigneeInline';
import { API_BASE_URL } from '../config/runtimeUrls';

const Card = ({ card, index, urgency, boardCreator, boardMode }) => {
  const dispatch = useDispatch();
  const allUsers = useSelector((state) => state.auth?.allUsers || []);
  const auth = useSelector(state => state.auth);
  const userInfo = auth?.userInfo || null;

  const [showModal, setShowModal] = useState(false);
  const [description, setDescription] = useState(card.description || '');
  const [assigneeId, setAssigneeId] = useState(card.assignee?._id || card.assignee || '');
  const [dueDate, setDueDate] = useState(card.dueDate ? new Date(card.dueDate).toISOString().substr(0, 10) : '');
  const [newComment, setNewComment] = useState('');
  const [ready, setReady] = useState(!!card.readyForInspection);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressNote, setProgressNote] = useState('');
  const [progressHistory, setProgressHistory] = useState([]);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [savingProgress, setSavingProgress] = useState(false);

  const assignedUserId = String(card.assignee?._id || card.assignee || '');
  const isSoloBoard = String(boardMode || 'team') === 'solo';
  const assignedUser = isSoloBoard ? null : (card.assignee && typeof card.assignee === 'object'
    ? card.assignee
    : allUsers.find(u => String(u._id) === assignedUserId));
  const isAssignee = assignedUserId && assignedUserId === String(userInfo?._id);
  const isBoardCreator = boardCreator && String(boardCreator._id || boardCreator) === String(userInfo?._id);
  const isAdmin = !!userInfo?.isAdmin;
  const canViewDescription = isAssignee || isBoardCreator || isAdmin;
  const canEditDescription = isBoardCreator || isAdmin;
  const canEditAssignee = canEditDescription && !isSoloBoard;
  const canEditDetails = canEditDescription;
  const canPostProgress = isAssignee || isBoardCreator || isAdmin;
  const isReadOnlyViewer = !(isAssignee || isBoardCreator || isAdmin);

  useEffect(() => {
    setDescription(card.description || '');
    setAssigneeId(card.assignee?._id || card.assignee || '');
    setDueDate(card.dueDate ? new Date(card.dueDate).toISOString().substr(0, 10) : '');
    setReady(!!card.readyForInspection);
  }, [card._id, card.description, card.dueDate, card.readyForInspection, card.assignee]);

  const apiConfig = {
    headers: userInfo?.token || auth?.userToken
      ? { Authorization: `Bearer ${userInfo?.token || auth?.userToken}` }
      : {}
  };

  const getBorderColor = () => {
    switch (urgency) {
      case 'High': return '#bf2600';
      case 'Low': return '#006644';
      case 'Medium':
      default: return '#ff8b00';
    }
  };

  const handleSaveDetails = (e) => {
    e.preventDefault();
    (async () => {
      const action = await dispatch(updateCardDetails({
        cardId: card._id,
        data: {
          description,
          ...(canEditAssignee ? { assignee: assigneeId ? assigneeId : null } : {}),
          dueDate: dueDate ? dueDate : null
        }
      }));

      if (action?.error) {
        alert(action.error.message || 'Failed to save task details');
        return;
      }

      const updatedCard = action?.payload;
      if (updatedCard) {
        setAssigneeId(updatedCard.assignee?._id || updatedCard.assignee || '');
      }
      setShowModal(false);
    })();
  };

  const handleAddComment = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    dispatch(addCardComment({ cardId: card._id, text: newComment }));
    setNewComment('');
  };

  const getInitials = (userObj) => {
    if (!userObj || !userObj.name) return '?';
    return userObj.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const handleToggleReady = async () => {
    try {
      const action = await dispatch(toggleCardReady({ cardId: card._id, ready: !ready }));
      const updated = action.payload;
      setReady(!!updated.readyForInspection);
    } catch (err) {
      console.error('Failed to toggle ready', err);
    }
  };

  // Fetch fresh card details when opening modal to ensure server-side redaction applies
  const fetchCard = async () => {
    try {
      setLoadingDetails(true);
      setLoadingProgress(true);
      setProgressHistory([]);
      setProgressPercent(0);
      setProgressNote('');
      if (!canViewDescription) {
        return;
      }
      const token = userInfo?.token;
      const res = await fetch(`${API_BASE_URL}/cards/${card._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      setDescription(data.description || '');
      setAssigneeId(data.assignee?._id || data.assignee || '');
      setDueDate(data.dueDate ? new Date(data.dueDate).toISOString().substr(0,10) : '');
      setReady(!!data.readyForInspection);

      const progressRes = await axios.get(`${API_BASE_URL}/progress?cardId=${card._id}`, apiConfig);
      setProgressHistory(progressRes.data || []);
      const latest = (progressRes.data || [])[0];
      if (latest) {
        setProgressPercent(Number(latest.percent) || 0);
        setProgressNote(latest.note || '');
      }
    } catch (err) {
      console.error('Failed to fetch card details', err);
    } finally {
      setLoadingDetails(false);
      setLoadingProgress(false);
    }
  };

  const handleSaveProgress = async (e) => {
    e.preventDefault();
    if (!canPostProgress) return;

    try {
      setSavingProgress(true);
      const response = await axios.post(`${API_BASE_URL}/progress/cards/${card._id}`, {
        percent: progressPercent,
        note: progressNote
      }, apiConfig);
      setProgressHistory(prev => [response.data, ...prev]);
    } catch (error) {
      alert(error?.response?.data?.message || 'Failed to save progress');
    } finally {
      setSavingProgress(false);
    }
  };

  // open modal and fetch details
  const openModal = () => {
    if (!canViewDescription) {
      alert("You are not authorized to view or edit this task because you are not the assignee, board creator, or an admin.");
      return;
    }
    setShowModal(true);
    fetchCard();
  };

  return (
    <>
      <Draggable draggableId={String(card._id)} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            onClick={openModal}
            style={{
              userSelect: 'none',
              padding: '16px',
              margin: '0 0 8px 0',
              backgroundColor: getBorderColor(),
              color: 'white',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              boxShadow: snapshot.isDragging ? '0 5px 10px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.2)',
              ...provided.draggableProps.style
            }}
          >
            <div style={{ marginBottom: card.dueDate || card.description ? '8px' : '0' }}>{card.title}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '8px' }}>
              <div>
                {canViewDescription && card.description && (
                  <div style={{ fontSize: '0.8rem', opacity: 0.9, marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    ≡ {card.description}
                  </div>
                )}
                {card.comments && card.comments.length > 0 && (
                  <div style={{ fontSize: '0.8rem', opacity: 0.9, marginBottom: '4px' }}>
                    💬 {card.comments.length}
                  </div>
                )}
                {card.dueDate && (
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    ⏰ Deadline: {new Date(card.dueDate).toLocaleDateString()}
                  </div>
                )}
                {ready && (
                  <div style={{ fontSize: '0.8rem', opacity: 0.95, marginTop: '4px', color: '#0a7f3e' }}>
                    ✓ Ready for inspection
                  </div>
                )}
              </div>

              {assignedUser ? (
                <div
                  title={`Assigned to: ${assignedUser.name || assignedUser.email || 'Assigned user'}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: 'rgba(255,255,255,0.16)',
                    borderRadius: '999px',
                    padding: '4px 8px',
                    maxWidth: '180px',
                    flexShrink: 0
                  }}
                >
                  <div
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.32)',
                      color: '#fff',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      flexShrink: 0
                    }}
                  >
                    {getInitials(assignedUser)}
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {assignedUser.name || assignedUser.email || 'Assigned'}
                  </span>
                </div>
              ) : assigneeId ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'rgba(255,255,255,0.16)',
                  borderRadius: '999px',
                  padding: '4px 8px',
                  maxWidth: '180px',
                  flexShrink: 0
                }}>
                  <div
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.32)',
                      color: '#fff',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      flexShrink: 0
                    }}
                  >
                    ?
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Assigned
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </Draggable>

      {showModal && (
        <div className="pm-card-modal" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={() => setShowModal(false)}>
          <div className="pm-card-modal__body" style={{ background: 'white', padding: '40px', borderRadius: '12px', width: '500px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 20px rgba(0,0,0,0.2)', color: '#172b4d' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#172b4d' }}>{card.title}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b778c' }}>✕</button>
            </div>

            <form onSubmit={handleSaveDetails} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#5e6c84' }}>Task Description</label>
                {canViewDescription ? (
                  <textarea placeholder="Add a more detailed description..." value={description} onChange={e => setDescription(e.target.value)} readOnly={!canEditDescription} style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '2px solid #dfe1e6', height: '120px', fontSize: '16px', resize: 'none', boxSizing: 'border-box', backgroundColor: canEditDescription ? 'white' : '#fafafa' }} />
                ) : (
                  <div style={{ padding: '12px', borderRadius: '6px', border: '2px solid #f0f0f0', background: '#fafafa', color: '#6b778c' }}>
                    You are not assigned to this task. Task details are restricted.
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#5e6c84' }}>
                  Assignee
                  {canEditAssignee && (
                    <CreateAssigneeInline onCreated={async (newUserId) => {
                      try {
                        // attempt to persist assignment on the backend first
                        const action = await dispatch(updateCardDetails({
                          cardId: card._id,
                          data: {
                            description,
                            assignee: newUserId,
                            dueDate: dueDate ? dueDate : null
                          }
                        }));

                        if (action.error) {
                          // show error and do not assume assignment succeeded
                          alert('Failed to assign user: ' + (action.error.message || 'Not authorized'));
                        } else {
                          // update local select state and refresh fetched details
                          setAssigneeId(newUserId);
                          // fetch fresh card details so UI derives from server state
                          fetchCard();
                        }
                      } catch (err) {
                        console.error('Error assigning user', err);
                        alert('Error assigning user');
                      }
                    }} />
                  )}
                </label>
                {canEditAssignee ? (
                  <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} disabled={!canEditAssignee} style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '2px solid #dfe1e6', fontSize: '16px', boxSizing: 'border-box', backgroundColor: canEditAssignee ? 'white' : '#fafafa' }}>
                    <option value="">-- Unassigned --</option>
                    {allUsers.map(u => (
                      <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                ) : (
                  <div style={{ padding: '12px', borderRadius: '6px', border: '2px solid #f0f0f0', background: '#fafafa', color: '#6b778c' }}>
                    This project is set to working alone, so tasks cannot be assigned to other people.
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#5e6c84' }}>Due Date</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '2px solid #dfe1e6', fontSize: '16px', backgroundColor: 'white', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  {isAssignee && (
                    <button type="button" onClick={handleToggleReady} style={{ marginRight: 8, padding: '10px 16px', background: ready ? '#0a7f3e' : '#0079bf', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                      {ready ? 'Marked Ready' : 'Mark Ready for Inspection'}
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" disabled={!canEditDetails} style={{ padding: '10px 20px', background: canEditDetails ? '#5aac44' : '#c7d9c6', color: 'white', border: 'none', borderRadius: '6px', cursor: canEditDetails ? 'pointer' : 'not-allowed', fontWeight: 'bold', fontSize: '16px' }}>
                    Save Details
                  </button>
                </div>
              </div>
            </form>

            <hr style={{ margin: '30px 0', border: '1px solid #dfe1e6' }} />

            <div style={{ marginBottom: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: 12, flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, color: '#172b4d', fontSize: '1.2rem' }}>Progress Updates</h3>
                <div style={{ fontSize: '13px', color: '#5e6c84' }}>
                  {loadingProgress ? 'Loading progress...' : `Current progress: ${progressHistory[0] ? `${progressHistory[0].percent}%` : '0%'}`}
                </div>
              </div>

              {canPostProgress ? (
                <form onSubmit={handleSaveProgress} style={{ display: 'grid', gap: '12px', padding: '14px', background: '#f7fbff', borderRadius: '10px', border: '1px solid #d9e7f3' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontWeight: 700, color: '#5e6c84' }}>Percent complete</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={progressPercent}
                      onChange={(e) => setProgressPercent(Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                    <div style={{ marginTop: 4, fontSize: 13, color: '#172b4d', fontWeight: 700 }}>{progressPercent}%</div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontWeight: 700, color: '#5e6c84' }}>Progress note</label>
                    <textarea
                      value={progressNote}
                      onChange={(e) => setProgressNote(e.target.value)}
                      placeholder="Describe what you finished or what is still pending..."
                      rows={3}
                      style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cfd7e6', boxSizing: 'border-box', resize: 'vertical' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" disabled={savingProgress} style={{ padding: '10px 16px', border: 'none', borderRadius: 8, background: '#0079bf', color: 'white', fontWeight: 800, cursor: savingProgress ? 'not-allowed' : 'pointer' }}>
                      {savingProgress ? 'Saving...' : 'Post Progress'}
                    </button>
                  </div>
                </form>
              ) : (
                <div style={{ padding: '14px', background: '#f4f5f7', borderRadius: '10px', color: '#5e6c84' }}>
                  Only the assignee can post progress for this task.
                </div>
              )}

              <div style={{ marginTop: '14px', display: 'grid', gap: '10px' }}>
                {progressHistory.length === 0 && !loadingProgress && (
                  <div style={{ color: '#5e6c84', fontStyle: 'italic' }}>No progress updates yet.</div>
                )}
                {progressHistory.slice(0, 5).map((entry) => (
                  <div key={entry._id} style={{ background: 'white', border: '1px solid #e6edf5', borderRadius: 10, padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <strong style={{ color: '#172b4d' }}>{entry.user?.name || 'Unknown'}</strong>
                      <span style={{ color: '#0a7f3e', fontWeight: 800 }}>{entry.percent}%</span>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 13, color: '#5e6c84' }}>{entry.note || 'No note provided'}</div>
                    <div style={{ marginTop: 6, fontSize: 12, color: '#98a1b2' }}>{new Date(entry.createdAt).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 style={{ marginTop: 0, color: '#172b4d', fontSize: '1.2rem', marginBottom: '15px' }}>Comments</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px', maxHeight: '200px', overflowY: 'auto' }}>
                {card.comments && card.comments.length > 0 ? (
                  card.comments.map((comment, i) => (
                    <div key={i} style={{ background: '#f4f5f7', padding: '10px 15px', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <strong style={{ fontSize: '0.9rem', color: '#172b4d' }}>{comment.user?.name || 'Unknown User'}</strong>
                        <span style={{ fontSize: '0.8rem', color: '#5e6c84' }}>{new Date(comment.createdAt).toLocaleString()}</span>
                      </div>
                      <p style={{ margin: 0, color: '#172b4d', fontSize: '0.95rem' }}>{comment.text}</p>
                    </div>
                  ))
                ) : (
                  <p style={{ margin: 0, color: '#5e6c84', fontStyle: 'italic' }}>No comments yet.</p>
                )}
              </div>

              <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '10px' }}>
                <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Write a comment..." style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '2px solid #dfe1e6', fontSize: '14px', boxSizing: 'border-box' }} />
                <button type="submit" style={{ padding: '10px 20px', background: '#0079bf', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>Post</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Card;
