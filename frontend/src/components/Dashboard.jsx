import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchBoards, createBoard, deleteBoard } from '../store/boardSlice';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/runtimeUrls';
import TrashIcon from './icons/TrashIcon';

const Dashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { list, status } = useSelector((state) => state.boards);
  const { userInfo } = useSelector((state) => state.auth);
  const canCreateProject = !!userInfo?.isAdmin;
  const userToken = useSelector((state) => state.auth?.userToken);
  
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState('Medium');
  const [deadline, setDeadline] = useState('');
  const [collaborationMode, setCollaborationMode] = useState('team');
  const [homeNotice, setHomeNotice] = useState(null);
  const [homeNoticeFlash, setHomeNoticeFlash] = useState(false);
  const [homeNoticeExpanded, setHomeNoticeExpanded] = useState(false);

  useEffect(() => {
    dispatch(fetchBoards());
  }, [dispatch]);

  useEffect(() => {
    let cancelled = false;

    const loadHomeNotice = async () => {
      if (status !== 'succeeded' || list.length !== 0 || !userToken) {
        setHomeNotice(null);
        return;
      }

      try {
        const res = await axios.get(`${API_BASE_URL}/notifications`, {
          headers: { Authorization: `Bearer ${userToken}` }
        });

        const relevant = (res.data || [])
          .filter((note) => note.type === 'project_completed' || note.type === 'project_deleted')
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

        if (!cancelled) {
          setHomeNotice(relevant || null);
          setHomeNoticeExpanded(false);
        }
      } catch (error) {
        if (!cancelled) {
          setHomeNotice(null);
          setHomeNoticeExpanded(false);
        }
      }
    };

    loadHomeNotice();

    return () => {
      cancelled = true;
    };
  }, [status, list.length, userToken]);

  useEffect(() => {
    const noticeId = new URLSearchParams(location.search).get('noticeId');
    if (!noticeId || !homeNotice || homeNotice._id !== noticeId) {
      setHomeNoticeFlash(false);
      return;
    }

    setHomeNoticeExpanded(true);
    setHomeNoticeFlash(true);
    const target = document.getElementById('home-project-notice');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    const timer = setTimeout(() => setHomeNoticeFlash(false), 2500);
    return () => clearTimeout(timer);
  }, [location.search, homeNotice]);

  const buildHomeNoticeMessage = () => {
    if (!homeNotice) return null;

    const boardTitle = homeNotice.data?.boardTitle || 'a project';
    const managerName = homeNotice.data?.projectManagerName || 'the project manager';
    const receivedAt = homeNotice.createdAt ? new Date(homeNotice.createdAt) : null;
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

    if (homeNotice.type === 'project_completed') {
      return {
        title: 'Project completed',
        greeting: `${greeting}, ${userInfo?.name || 'Manager'}.`,
        body: `Project "${boardTitle}" has been completed by ${managerName}.`,
        receivedAt
      };
    }

    return {
      title: 'Project terminated',
      greeting: `${greeting}, ${userInfo?.name || 'Manager'}.`,
      body: `Project "${boardTitle}" has been terminated by ${managerName}.`,
      receivedAt
    };
  };

  const greetingForTime = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const formatReceivedTime = (date) => {
    if (!date || Number.isNaN(date.getTime())) return '';
    return date.toLocaleString([], {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleOpenHomeNotice = () => {
    setHomeNoticeExpanded(true);
  };

  const handleCloseHomeNotice = () => {
    setHomeNoticeExpanded(false);
  };

  const handleAddProject = (e) => {
    e.preventDefault();
    dispatch(createBoard({ title, description, urgency, deadline, collaborationMode })).then((res) => {
      if (!res.error) {
        setShowModal(false);
        setTitle('');
        setDescription('');
        setUrgency('Medium');
        setDeadline('');
        setCollaborationMode('team');
      }
    });
  };

  const handleDeleteProject = (e, boardId) => {
    e.stopPropagation(); // Prevent navigating to the board when clicking delete
    if (window.confirm('Are you sure you want to delete this project? All lists and cards will be lost.')) {
      dispatch(deleteBoard(boardId));
    }
  };

  const getProjectParticipants = (board) => {
    const participants = [];
    const seen = new Set();

    const addUser = (user) => {
      if (!user) return;
      const id = String(user._id || user);
      if (seen.has(id)) return;
      seen.add(id);
      participants.push(user);
    };

    addUser(board.creator);
    (board.columns || []).forEach((column) => {
      (column.cards || []).forEach((card) => addUser(card.assignee));
    });

    return participants;
  };

  return (
    <div className="pm-page pm-dashboard" style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto', color: '#172b4d' }}>
      <div className="pm-page__hero" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: 'white', margin: 0, fontSize: '2rem' }}>Your Projects Dashboard</h1>
        {canCreateProject && (
        <button 
          onClick={() => setShowModal(true)}
          style={{
            background: '#5aac44',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '6px',
            fontSize: '1.2rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            transition: 'background 0.2s, transform 0.1s'
          }}
          onMouseOver={e => e.currentTarget.style.backgroundColor = '#61bd4f'}
          onMouseOut={e => e.currentTarget.style.backgroundColor = '#5aac44'}
          onMouseDown={e => e.currentTarget.style.transform = 'translateY(2px)'}
          onMouseUp={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          + ADD NEW PROJECT
        </button>
        )}
      </div>
      
      {status === 'succeeded' && list.length === 0 && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9990,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: 'rgba(3, 17, 31, 0.58)',
          backdropFilter: 'blur(6px)'
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.98)',
            borderRadius: '20px',
            padding: '28px',
            width: 'min(720px, 100%)',
            boxShadow: homeNoticeFlash ? '0 0 0 4px rgba(0,121,191,0.25), 0 22px 44px rgba(0,0,0,0.34)' : '0 22px 44px rgba(0,0,0,0.28)',
            border: '1px solid rgba(0,121,191,0.15)',
            borderTop: '8px solid #0079bf',
            transition: 'box-shadow 0.25s ease'
          }} id="home-project-notice">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#0079bf', marginBottom: 10 }}>
                  Messages
                </div>
                <h2 style={{ margin: '0 0 10px 0', color: '#172b4d', fontSize: 'clamp(1.7rem, 3vw, 2.4rem)' }}>
                  {buildHomeNoticeMessage() ? (homeNoticeExpanded ? buildHomeNoticeMessage().greeting : `${greetingForTime()}, ${userInfo?.name || 'Manager'}.`) : `${greetingForTime()}, ${userInfo?.name || 'Manager'}.`}
                </h2>
                <p style={{ margin: 0, color: '#5e6c84', fontSize: '17px', lineHeight: 1.65 }}>
                  {buildHomeNoticeMessage()
                    ? (homeNoticeExpanded ? buildHomeNoticeMessage().body : 'You have a new message. Click Open to read the details.')
                    : 'No active projects right now. When a project is completed or terminated, the message will appear here.'}
                </p>
              </div>
              <div style={{ minWidth: 180, textAlign: 'right', padding: '12px 14px', background: '#f4f8fc', borderRadius: '12px', border: '1px solid #d9e7f3' }}>
                <div style={{ fontSize: '12px', color: '#5e6c84', marginBottom: 4 }}>Received</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#172b4d' }}>
                  {buildHomeNoticeMessage() ? formatReceivedTime(buildHomeNoticeMessage().receivedAt) : '--'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24, flexWrap: 'wrap' }}>
              {buildHomeNoticeMessage() ? (
                !homeNoticeExpanded ? (
                  <button
                    type="button"
                    onClick={handleOpenHomeNotice}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '999px',
                      border: 'none',
                      background: '#0079bf',
                      color: 'white',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    Open
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCloseHomeNotice}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '999px',
                      border: 'none',
                      background: '#ebecf0',
                      color: '#172b4d',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    Close
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '999px',
                    border: 'none',
                    background: '#0079bf',
                    color: 'white',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Go Home
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="pm-board-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
        {list.map(board => (
          <div 
            key={board._id} 
            onClick={() => navigate(`/board/${board._id}`)}
            className="pm-project-card"
            style={{
              background: 'white',
              padding: '25px',
              borderRadius: '12px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              display: 'flex', flexDirection: 'column',
              minHeight: '160px'
            }}
            onMouseOver={e => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.2)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#0079bf', fontSize: '1.4rem', paddingRight: '10px' }}>{board.title}</h3>
                {getProjectParticipants(board).length > 0 && (
                  <div style={{ fontSize: '12px', color: '#5e6c84' }}>
                      Project Managers: {getProjectParticipants(board).map((user) => user?.name || 'Unknown').join(', ')}
                  </div>
                )}
              </div>
              {(!board.creator || String(board.creator?._id || board.creator) === String(userInfo?._id) || userInfo?.isAdmin) && (
                <button 
                  onClick={(e) => handleDeleteProject(e, board._id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#eb5a46',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    padding: '4px',
                    borderRadius: '4px'
                  }}
                  title="Delete Project"
                  onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(235, 90, 70, 0.1)'}
                  onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <TrashIcon size={18} />
                </button>
              )}
            </div>
            <p style={{ flex: 1, fontSize: '14px', color: '#5e6c84', margin: '0 0 15px 0' }}>{board.description || 'No description provided.'}</p>
            <div>
              <span style={{ 
                padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold',
                background: board.urgency === 'High' ? '#ffe3e3' : board.urgency === 'Low' ? '#e3fcef' : '#fff0b3',
                color: board.urgency === 'High' ? '#bf2600' : board.urgency === 'Low' ? '#006644' : '#ff8b00',
                marginRight: '10px'
              }}>
                {board.urgency || 'Medium'} Urgency
              </span>
              {board.deadline && (
                 <span style={{ fontSize: '12px', color: '#5e6c84', fontWeight: 'bold' }}>
                   ⏰ Due: {new Date(board.deadline).toLocaleDateString()} 
                   {new Date(board.deadline) < new Date() ? ' (Expired)' : ` (${Math.ceil((new Date(board.deadline) - new Date()) / (1000 * 60 * 60 * 24))} days left)`}
                 </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '40px', borderRadius: '12px', width: '450px', boxShadow: '0 10px 20px rgba(0,0,0,0.2)' }}>
            <h2 style={{ marginTop: 0, marginBottom: '25px', color: '#172b4d' }}>Create a New Project</h2>
            <form onSubmit={handleAddProject} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <input 
                required 
                placeholder="Project Name (e.g., Marketing Campaign)" 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                style={{ padding: '12px', borderRadius: '6px', border: '2px solid #dfe1e6', fontSize: '16px' }} 
              />
              <textarea 
                required 
                placeholder="Briefly describe the project goals..." 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                style={{ padding: '12px', borderRadius: '6px', border: '2px solid #dfe1e6', height: '100px', fontSize: '16px', resize: 'none' }} 
              />
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#5e6c84' }}>Project Urgency / Priority:</label>
                <select 
                  value={urgency} 
                  onChange={e => setUrgency(e.target.value)} 
                  style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '2px solid #dfe1e6', fontSize: '16px', backgroundColor: 'white' }}
                >
                  <option value="Low">Low - Not urgent</option>
                  <option value="Medium">Medium - Regular priority</option>
                  <option value="High">High - Critical / Urgent</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#5e6c84' }}>Project Deadline:</label>
                <input 
                  type="date"
                  value={deadline} 
                  onChange={e => setDeadline(e.target.value)} 
                  style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '2px solid #dfe1e6', fontSize: '16px', backgroundColor: 'white', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#5e6c84' }}>Will you assign people to tasks?</label>
                <div style={{ display: 'grid', gap: '10px' }}>
                  <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '12px', border: collaborationMode === 'solo' ? '2px solid #0079bf' : '2px solid #dfe1e6', borderRadius: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="collaborationMode"
                      value="solo"
                      checked={collaborationMode === 'solo'}
                      onChange={() => setCollaborationMode('solo')}
                      style={{ marginTop: '4px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#172b4d' }}>Do it yourself</div>
                      <div style={{ fontSize: '13px', color: '#5e6c84', marginTop: '4px' }}>You will manage the project alone and assign no one.</div>
                    </div>
                  </label>
                  <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '12px', border: collaborationMode === 'team' ? '2px solid #0079bf' : '2px solid #dfe1e6', borderRadius: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="collaborationMode"
                      value="team"
                      checked={collaborationMode === 'team'}
                      onChange={() => setCollaborationMode('team')}
                      style={{ marginTop: '4px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#172b4d' }}>Assign people to tasks</div>
                      <div style={{ fontSize: '13px', color: '#5e6c84', marginTop: '4px' }}>You can assign workers to different tasks in this project.</div>
                    </div>
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '10px 20px', background: '#ebecf0', color: '#172b4d', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>Cancel</button>
                <button type="submit" style={{ padding: '10px 20px', background: '#5aac44', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>Create Project</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;