import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { adminCreateUser } from '../store/authSlice';

const CreateAssigneeInline = ({ onCreated }) => {
  const dispatch = useDispatch();
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loadingCreate, setLoadingCreate] = useState(false);

  const handleCreate = async () => {
    if (!name || !email) return alert('Name and email are required');
    try {
      setLoadingCreate(true);
      const action = await dispatch(adminCreateUser({ name, email, phone }));

      if (action && action.meta && action.meta.requestStatus === 'fulfilled' && action.payload && action.payload._id) {
        onCreated(action.payload._id);
        setShow(false);
        setName(''); setEmail(''); setPhone('');
      } else {
        const errMsg = action && action.payload ? action.payload : (action && action.error ? action.error.message : 'Unknown error');
        alert('Failed to create user: ' + errMsg);
      }
    } catch (err) {
      console.error('Failed to create user', err);
      alert('Failed to create user: ' + (err.message || 'Unknown error'));
    } finally {
      setLoadingCreate(false);
    }
  };

  if (!show) {
    return (
      <button 
        type="button" 
        onClick={() => setShow(true)} 
        style={{ 
          marginLeft: '8px', 
          padding: '2px 8px', 
          background: '#0a7f3e', 
          color: 'white', 
          borderRadius: '4px', 
          border: 'none', 
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold'
        }}
        title="Add New Assignee"
      >
        + Add New
      </button>
    );
  }

  return (
    <div style={{ marginTop: '8px', padding: '12px', background: '#f4f5f7', borderRadius: '4px', border: '1px solid #dfe1e6' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <input placeholder="Name *" value={name} onChange={e => setName(e.target.value)} style={{ padding: '6px', flex: 1, minWidth: '120px' }} />
        <input placeholder="Email *" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: '6px', flex: 1, minWidth: '120px' }} />
        <input placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} style={{ padding: '6px', flex: 1, minWidth: '100px' }} />
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="button" onClick={handleCreate} disabled={loadingCreate} style={{ padding: '6px 12px', background: '#0079bf', color: 'white', borderRadius: 4, border: 'none', cursor: loadingCreate ? 'not-allowed' : 'pointer' }}>{loadingCreate ? 'Creating…' : 'Create'}</button>
        <button type="button" onClick={() => setShow(false)} style={{ padding: '6px 12px', background: '#ccc', borderRadius: 4, border: 'none', cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  );
};

export default CreateAssigneeInline;