import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Board from './components/Board';
import Dashboard from './components/Dashboard';
import Auth from './components/Auth';
import AdminPanel from './components/AdminPanel';
import CompleteSetup from './components/CompleteSetup';
import { logout } from './store/authSlice';
import NotificationBell from './components/NotificationBell';

function App() {
  const { userInfo } = useSelector(state => state.auth);
  const dispatch = useDispatch();

  if (!userInfo) {
    return <Auth />;
  }

  if (userInfo.mustSetPassword) {
    return <CompleteSetup />;
  }

  return (
    <Router>
      <div style={{ fontFamily: 'sans-serif', height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header style={{ padding: '10px 20px', backgroundColor: '#026aa7', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>
            <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>Project Management Tool</Link>
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span>Welcome, {userInfo.name}</span>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <NotificationBell />
            </div>
            {userInfo?.isAdmin && (
              <Link to="/admin" style={{ color: 'white', textDecoration: 'none', marginRight: 8 }}>Admin</Link>
            )}
            <button 
              onClick={() => dispatch(logout())}
              style={{
                padding: '6px 12px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Logout
            </button>
          </div>
        </header>
        <main style={{ flex: 1, backgroundColor: '#0079bf', overflowY: 'auto' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/board/:id" element={<Board />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;