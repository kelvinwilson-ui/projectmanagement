import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { completePasswordSetup } from '../store/authSlice';

const CompleteSetup = () => {
  const dispatch = useDispatch();
  const { userInfo } = useSelector(state => state.auth);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    if (!password || password.length < 6) {
      setMessage('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setMessage('Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      const action = await dispatch(completePasswordSetup({ userId: userInfo._id, password }));
      if (completePasswordSetup.fulfilled.match(action)) {
        setMessage('Password saved. You can now use your portal normally.');
      } else {
        setMessage(action.payload || 'Unable to complete setup');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0079bf' }}>
      <div style={{ background: 'white', padding: '40px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '340px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#172b4d' }}>Set Your Password</h2>
        <p style={{ color: '#5e6c84', fontSize: '14px', marginBottom: '16px', textAlign: 'center' }}>
          Welcome {userInfo?.name || 'there'}. Finish your account setup by creating a password.
        </p>
        {message && <div style={{ color: message.includes('saved') ? '#0a7f3e' : 'red', marginBottom: '10px', fontSize: '14px' }}>{message}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ padding: '10px', borderRadius: '4px', border: '2px solid #dfe1e6' }}
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            style={{ padding: '10px', borderRadius: '4px', border: '2px solid #dfe1e6' }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{ background: '#5aac44', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            {loading ? 'Saving...' : 'Save Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CompleteSetup;