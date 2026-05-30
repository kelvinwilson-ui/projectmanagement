import React, { useEffect, useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, SOCKET_URL } from '../config/runtimeUrls';

export default function NotificationBell() {
  const { userToken, userInfo } = useSelector(state => state.auth);
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [toast, setToast] = useState(null);
  const [toastNote, setToastNote] = useState(null);
  const [previewNote, setPreviewNote] = useState(null);
  const socketRef = useRef(null);
  const toastTimerRef = useRef(null);

  const playTone = (frequency = 880, duration = 0.12, volume = 0.04) => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gainNode.gain.value = volume;
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + duration);
      oscillator.onended = () => context.close().catch(() => {});
    } catch (error) {
      // ignore audio failures
    }
  };

  const getNotificationLabel = (note) => {
    if (!note) return 'New notification';
    if (note.type === 'mention') return 'You were mentioned in a comment';
    if (note.type === 'comment') return 'New comment activity';
    if (note.type === 'assigned') return 'A task was assigned to you';
    if (note.type === 'progress') return 'New progress update';
    if (note.type === 'project_deleted') return 'Project deleted';
    if (note.type === 'project_completed') return 'Project completed';
    return 'New notification';
  };

  const formatReceivedTime = (dateValue) => {
    const date = dateValue ? new Date(dateValue) : null;
    if (!date || Number.isNaN(date.getTime())) return '';
    return date.toLocaleString([], {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const greetingForTime = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const playNotificationSound = (note) => {
    const soundMap = {
      mention: { frequency: 1040, duration: 0.14, volume: 0.055 },
      comment: { frequency: 880, duration: 0.13, volume: 0.05 },
      assigned: { frequency: 760, duration: 0.13, volume: 0.05 },
      progress: { frequency: 700, duration: 0.14, volume: 0.05 },
      project_deleted: { frequency: 620, duration: 0.16, volume: 0.055 },
      project_completed: { frequency: 980, duration: 0.16, volume: 0.055 },
    };

    const sound = soundMap[note?.type] || { frequency: 840, duration: 0.13, volume: 0.05 };
    playTone(sound.frequency, sound.duration, sound.volume);
  };

  const openProjectPreview = async (note) => {
    if (!note) return;

    if (note?._id && !note.read) {
      markRead(note._id);
    }

    playNotificationSound(note);

    setPreviewNote(note);
    setOpen(false);
  };

  const showToast = (note) => {
    const message = getNotificationLabel(note);
    setToastNote(note);
    setToast({
      title: message,
      body: note?.data?.text ? note.data.text.substring(0, 120) : '',
    });
    playNotificationSound(note);

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 4500);

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(message, {
          body: note?.data?.text ? note.data.text.substring(0, 140) : 'You have a new notification',
        });
      } catch (error) {
        // ignore browser notification failures
      }
    }
  };

  useEffect(() => {
    if (!userToken) return;

    // fetch existing notifications
    axios.get(`${API_BASE_URL}/notifications`, { headers: { Authorization: `Bearer ${userToken}` } })
      .then(res => setNotifications(res.data || []))
      .catch(() => {});

    // connect socket
    const socket = io(SOCKET_URL, { autoConnect: false });
    socketRef.current = socket;
    socket.connect();
    socket.on('connect', () => {
      socket.emit('authenticate', userToken);
    });
    socket.on('authenticated', () => {});
    socket.on('unauthorized', () => {});

    socket.on('notification', (note) => {
      setNotifications(prev => [note, ...prev]);
      showToast(note);
    });

    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      try { socket.disconnect(); } catch (e) {}
    };
  }, [userToken]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 640px)');
    const update = () => setIsMobile(mq.matches);
    update();
    try {
      mq.addEventListener('change', update);
    } catch (e) {
      mq.addListener(update);
    }
    return () => {
      try { mq.removeEventListener('change', update); } catch (e) { mq.removeListener(update); }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleToastClick = async () => {
    if (!toastNote) return;

    if (toastNote?._id && !toastNote.read) {
      markRead(toastNote._id);
    }

    const boardId = toastNote?.data?.boardId;
    if (toastNote?.type === 'project_deleted' || toastNote?.type === 'project_completed') {
      await openProjectPreview(toastNote);
    } else if (boardId) {
      navigate(`/board/${boardId}`);
    }

    setToast(null);
    setToastNote(null);
  };

  const markRead = async (id) => {
    try {
      await axios.put(`${API_BASE_URL}/notifications/${id}/read`, {}, { headers: { Authorization: `Bearer ${userToken}` } });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
    } catch (e) {}
  };

  const markUnread = async (id) => {
    try {
      await axios.put(`${API_BASE_URL}/notifications/${id}/unread`, {}, { headers: { Authorization: `Bearer ${userToken}` } });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: false } : n));
      if (previewNote?._id === id) {
        setPreviewNote(prev => prev ? { ...prev, read: false } : prev);
      }
    } catch (e) {}
  };

  const clearProjectNotifications = async (boardId) => {
    try {
      await axios.delete(`${API_BASE_URL}/notifications/project/${boardId}`, { headers: { Authorization: `Bearer ${userToken}` } });
      setNotifications(prev => prev.filter(n => !(n.data?.boardId === boardId && (n.type === 'project_deleted' || n.type === 'project_completed'))));
      if (previewNote?.data?.boardId === boardId) {
        setPreviewNote(null);
      }
      setOpen(true);
    } catch (e) {}
  };

  const markAllRead = async () => {
    try {
      await axios.put(`${API_BASE_URL}/notifications/read-all`, {}, { headers: { Authorization: `Bearer ${userToken}` } });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e) {}
  };

  const openNotification = async (note) => {
    if (!note) return;

    if (note?._id && !note.read) {
      markRead(note._id);
    }

    const boardId = note?.data?.boardId;

    // For project-level notifications, show the project preview modal
    if (note?.type === 'project_deleted' || note?.type === 'project_completed') {
      await openProjectPreview(note);
      setOpen(false);
      return;
    }

    // If the notification contains inline text (comment, mention, etc.), show the preview modal on mobile/any device
    const hasInlineText = !!note?.data?.text && String(note.data.text).trim().length > 0;
    if (hasInlineText && note.type !== 'assigned' /* keep assigned navigating to board if boardId exists */) {
      setPreviewNote(note);
      setOpen(false);
      return;
    }

    // Otherwise navigate to the board if available, else fallback to root
    if (boardId) {
      navigate(`/board/${boardId}`);
    } else {
      navigate('/');
    }
    // Close the notifications overlay so the navigated view is visible on mobile
    setOpen(false);
  };

  const closePreview = () => {
    setPreviewNote(null);
  };

  const previewTitle = getNotificationLabel(previewNote);
  const previewBoardTitle = previewNote?.data?.boardTitle || 'a project';
  const previewManagerName = previewNote?.data?.projectManagerName || 'the project manager';
  const previewBody = previewNote?.type === 'project_completed'
    ? `Project "${previewBoardTitle}" has been completed by ${previewManagerName}.`
    : `Project "${previewBoardTitle}" has been terminated by ${previewManagerName}.`;
  const canClearProjectNotes = !!previewNote && (userInfo?.isAdmin || String(userInfo?._id) === String(previewNote?.data?.deletedBy));

  return (
    <div style={{ position: 'relative' }}>
      {previewNote && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          background: 'rgba(3, 17, 31, 0.58)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24
        }}>
          <div style={{
            width: 'min(720px, 100%)',
            background: 'rgba(255,255,255,0.98)',
            borderRadius: 20,
            borderTop: '8px solid #0079bf',
            boxShadow: '0 22px 44px rgba(0,0,0,0.28)',
            padding: 28
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0079bf', marginBottom: 10 }}>
                  Messages
                </div>
                <h2 style={{ margin: '0 0 10px 0', color: '#172b4d', fontSize: 'clamp(1.7rem, 3vw, 2.4rem)' }}>
                  {greetingForTime()}, {userToken ? 'Manager' : 'there'}.
                </h2>
                <p style={{ margin: 0, color: '#5e6c84', fontSize: 17, lineHeight: 1.65 }}>
                  {previewBody}
                </p>
              </div>
              <div style={{ minWidth: 180, textAlign: 'right', padding: '12px 14px', background: '#f4f8fc', borderRadius: 12, border: '1px solid #d9e7f3' }}>
                <div style={{ fontSize: 12, color: '#5e6c84', marginBottom: 4 }}>Received</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#172b4d' }}>{formatReceivedTime(previewNote.createdAt)}</div>
                <div style={{ marginTop: 10, color: '#0a7f3e', fontSize: 14, fontWeight: 800 }}>
                  {previewNote.read ? '✓ Read' : 'Unread'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24, flexWrap: 'wrap' }}>
              {previewNote.read ? (
                <button
                  type="button"
                  onClick={() => markUnread(previewNote._id)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 999,
                    border: 'none',
                    background: '#f0b429',
                    color: '#102a43',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Mark unread
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => markRead(previewNote._id)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 999,
                    border: 'none',
                    background: '#0a7f3e',
                    color: 'white',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Mark read
                </button>
              )}
              {canClearProjectNotes && (
                <button
                  type="button"
                  onClick={() => clearProjectNotifications(previewNote.data?.boardId)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 999,
                    border: 'none',
                    background: '#bf2600',
                    color: 'white',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Clear project messages
                </button>
              )}
              <button
                type="button"
                onClick={closePreview}
                style={{
                  padding: '10px 18px',
                  borderRadius: 999,
                  border: 'none',
                  background: '#ebecf0',
                  color: '#172b4d',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div style={{
          position: 'fixed',
          right: 20,
          top: 76,
          zIndex: 9999,
          width: 320,
          background: '#102a43',
          color: 'white',
          borderRadius: 10,
          boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
          padding: '14px 16px',
          borderLeft: '4px solid #5aac44',
          cursor: 'pointer'
        }} onClick={handleToastClick} role="button" tabIndex={0} onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleToastClick();
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{toast.title}</div>
          {toast.body && <div style={{ fontSize: 13, opacity: 0.9 }}>{toast.body}</div>}
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>Click to open</div>
        </div>
      )}
      <button onClick={() => setOpen(!open)} style={{ position: 'relative', padding: 8, background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }} title="Notifications">
        🔔
        {unreadCount > 0 && (
          <span style={{ position: 'absolute', top: -4, right: -4, background: 'red', color: 'white', borderRadius: '50%', padding: '2px 6px', fontSize: 12 }}>{unreadCount}</span>
        )}
      </button>
      {open && (
        isMobile ? (
          <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(3,17,31,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', padding: 12 }}>
            <div style={{ width: '100%', maxWidth: 640, maxHeight: '88vh', overflowY: 'auto', background: 'white', color: '#333', boxShadow: '0 -6px 18px rgba(0,0,0,0.2)', borderTopLeftRadius: 12, borderTopRightRadius: 12, zIndex: 10001 }}>
              <div style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee' }}>
                <strong>Notifications</strong>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={markAllRead} style={{ fontSize: 12, padding: '6px 8px' }}>Mark all read</button>
                  <button onClick={() => setOpen(false)} style={{ fontSize: 12, padding: '6px 8px' }}>Close</button>
                </div>
              </div>
              <div style={{ paddingBottom: 24 }}>
                {notifications.length === 0 && <div style={{ padding: 12 }}>No notifications</div>}
                {notifications.map(n => (
                  <div key={n._id} style={{ padding: 12, borderBottom: '1px solid #f5f5f5', background: n.read ? 'white' : '#f9fbff' }}>
                    <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{getNotificationLabel(n)}</span>
                      {n.read && (
                        <span title="Read" aria-label="Read" style={{ color: '#0a7f3e', fontSize: 14, fontWeight: 700 }}>✓</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>{n.data && n.data.text ? n.data.text.substring(0, 120) : ''}</div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                      {!n.read ? (
                        <button onClick={() => markRead(n._id)} style={{ padding: '6px 8px', fontSize: 12 }}>Mark read</button>
                      ) : (
                        <button onClick={() => markUnread(n._id)} style={{ padding: '6px 8px', fontSize: 12 }}>Mark unread</button>
                      )}
                      <button type="button" onClick={() => openNotification(n)} style={{ padding: 0, border: 'none', background: 'transparent', color: '#0079bf', cursor: 'pointer', fontSize: 12 }}>Open</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ position: 'absolute', right: 0, top: '36px', width: 320, maxHeight: 360, overflowY: 'auto', background: 'white', color: '#333', boxShadow: '0 6px 18px rgba(0,0,0,0.2)', borderRadius: 6, zIndex: 40 }}>
            <div style={{ padding: 10, borderBottom: '1px solid #eee', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Notifications</span>
              <button onClick={markAllRead} style={{ fontSize: 12, padding: '6px 8px' }}>Mark all read</button>
            </div>
            {notifications.length === 0 && <div style={{ padding: 10 }}>No notifications</div>}
            {notifications.map(n => (
              <div key={n._id} style={{ padding: 10, borderBottom: '1px solid #f5f5f5', background: n.read ? 'white' : '#f9fbff' }}>
                <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{getNotificationLabel(n)}</span>
                  {n.read && (
                    <span title="Read" aria-label="Read" style={{ color: '#0a7f3e', fontSize: 14, fontWeight: 700 }}>
                      ✓
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>{n.data && n.data.text ? n.data.text.substring(0, 120) : ''}</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  {!n.read ? (
                    <button onClick={() => markRead(n._id)} style={{ padding: '6px 8px', fontSize: 12 }}>Mark read</button>
                  ) : (
                    <button onClick={() => markUnread(n._id)} style={{ padding: '6px 8px', fontSize: 12 }}>Mark unread</button>
                  )}
                  <button type="button" onClick={() => openNotification(n)} style={{ padding: 0, border: 'none', background: 'transparent', color: '#0079bf', cursor: 'pointer', fontSize: 12 }}>Open</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
