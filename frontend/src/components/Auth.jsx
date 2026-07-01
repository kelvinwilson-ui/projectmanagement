import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser, registerUser } from '../store/authSlice';

const Auth = () => {
  const dispatch = useDispatch();
  const { loading, error } = useSelector(state => state.auth);
  
  const [isLogin, setIsLogin] = useState(true);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('user');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isLogin) {
      dispatch(loginUser({ identifier, password }));
    } else {
      dispatch(registerUser({ name, email: identifier, password, role }));
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0079bf' }}>
      <div style={{ background: 'white', padding: '40px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '300px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
          <img src="/teampilot-logo.png" alt="TeamPilot logo" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />
        </div>
        <h1 style={{ textAlign: 'center', margin: '0 0 10px 0', color: '#172b4d', fontSize: '1.25rem' }}>TeamPilot</h1>
        <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#172b4d' }}>
          {isLogin ? 'Log in to TeamPilot' : 'Sign up for TeamPilot'}
        </h2>
        
        {error && <div style={{ color: 'red', marginBottom: '10px', fontSize: '14px', textAlign: 'center' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {!isLogin && (
            <input 
              type="text" 
              placeholder="Name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              required={!isLogin}
              style={{ padding: '10px', borderRadius: '4px', border: '2px solid #dfe1e6' }}
            />
          )}
          
          <input 
            type="text" 
            placeholder={isLogin ? 'Email or phone number' : 'Email address'} 
            value={identifier} 
            onChange={(e) => setIdentifier(e.target.value)} 
            required
            style={{ padding: '10px', borderRadius: '4px', border: '2px solid #dfe1e6' }}
          />
          
          <input 
            type="password" 
            placeholder={isLogin ? 'Password (optional for first login)' : 'Password'} 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required={!isLogin}
            style={{ padding: '10px', borderRadius: '4px', border: '2px solid #dfe1e6' }}
          />

          {!isLogin && (
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={{ padding: '10px', borderRadius: '4px', border: '2px solid #dfe1e6', background: 'white' }}
            >
              <option value="user">User</option>
              <option value="projectManager">Project Manager</option>
            </select>
          )}

          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              background: '#5aac44', 
              color: 'white', 
              border: 'none', 
              padding: '10px', 
              borderRadius: '4px', 
              cursor: 'pointer',
              fontWeight: 'bold',
              marginTop: '10px'
            }}
          >
            {loading ? 'Processing...' : (isLogin ? 'Log in' : 'Sign up')}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '14px', color: '#5e6c84' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span 
            onClick={() => setIsLogin(!isLogin)} 
            style={{ color: '#0052cc', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {isLogin ? 'Sign up' : 'Log in'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Auth;