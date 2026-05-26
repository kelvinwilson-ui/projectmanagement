import React, { useEffect, useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { io } from 'socket.io-client';

const API_BASE = 'http://localhost:5000/api';

export default function NotificationBell() {
  const { userToken } = useSelector(state => state.auth);
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!userToken) return;

    // fetch existing notifications
    axios.get(`${API_BASE}/notifications`, { headers: { Authorization: `Bearer ${userToken}` } })
      .then(res => setNotifications(res.data || []))
      .catch(() => {});

    // connect socket
    const socket = io('http://localhost:5000', { autoConnect: false });
    socketRef.current = socket;
    socket.connect();
    socket.on('connect', () => {
      socket.emit('authenticate', userToken);
    });
    socket.on('authenticated', () => {});
    socket.on('unauthorized', () => {});

    socket.on('notification', (note) => {
      setNotifications(prev => [note, ...prev]);
    });

    return () => {
      try { socket.disconnect(); } catch (e) {}
    };
  }, [userToken]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markRead = async (id) => {
    try {
      await axios.put(`${API_BASE}/notifications/${id}/read`, {}, { headers: { Authorization: `Bearer ${userToken}` } });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
    } catch (e) {}
  };

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{ position: 'relative', padding: 8, background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }} title="Notifications">
        🔔
        {unreadCount > 0 && (
          <span style={{ position: 'absolute', top: -4, right: -4, background: 'red', color: 'white', borderRadius: '50%', padding: '2px 6px', fontSize: 12 }}>{unreadCount}</span>
        )}
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '36px', width: 320, maxHeight: 360, overflowY: 'auto', background: 'white', color: '#333', boxShadow: '0 6px 18px rgba(0,0,0,0.2)', borderRadius: 6, zIndex: 40 }}>
          <div style={{ padding: 10, borderBottom: '1px solid #eee', fontWeight: 'bold' }}>Notifications</div>
          {notifications.length === 0 && <div style={{ padding: 10 }}>No notifications</div>}
          {notifications.map(n => (
            <div key={n._id} style={{ padding: 10, borderBottom: '1px solid #f5f5f5', background: n.read ? 'white' : '#f9fbff' }}>
              <div style={{ fontSize: 13 }}>
                {n.type === 'mention' ? 'You were mentioned in a comment' : n.type}
              </div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>{n.data && n.data.text ? n.data.text.substring(0, 120) : ''}</div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                {!n.read && <button onClick={() => markRead(n._id)} style={{ padding: '6px 8px', fontSize: 12 }}>Mark read</button>}
                <a href={`/board/${n.data?.boardId || ''}`} style={{ fontSize: 12, color: '#0079bf', textDecoration: 'none' }}>Open</a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
