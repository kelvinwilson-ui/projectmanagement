import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchAllUsers, updateUserRole } from '../store/authSlice';

const AdminPanel = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { allUsers, userInfo } = useSelector(state => state.auth);
  const currentBoard = useSelector(state => state.boards?.currentBoard || null);

  useEffect(() => {
    dispatch(fetchAllUsers());
  }, [dispatch]);

  const goToMainBoard = () => {
    if (currentBoard?._id) {
      navigate(`/board/${currentBoard._id}`);
      return;
    }

    navigate('/');
  };

  if (!userInfo?.isAdmin) return <div style={{ padding: 20, color: 'white' }}>Access denied.</div>;

  return (
    <div className="pm-page pm-admin" style={{ padding: 20 }}>
      <div className="pm-admin__actions" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => navigate('/')}
          style={{ padding: '10px 16px', borderRadius: 999, border: 'none', background: 'rgba(255,255,255,0.16)', color: 'white', fontWeight: 800, cursor: 'pointer' }}
        >
          Dashboard
        </button>
        <button
          type="button"
          onClick={goToMainBoard}
          style={{ padding: '10px 16px', borderRadius: 999, border: 'none', background: 'white', color: '#026aa7', fontWeight: 800, cursor: 'pointer' }}
        >
          Main Board
        </button>
      </div>
      <h2 style={{ color: '#172b4d' }}>User Role Management</h2>
      <div style={{ marginTop: 12 }}>
        {allUsers.map(u => (
          <div key={u._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f4f5f7', borderRadius: 8, marginBottom: 8 }}>
            <div>
              <strong>{u.name}</strong> <span style={{ color: '#6b778c' }}>({u.email})</span>
              {u.isAdmin && <span style={{ marginLeft: 8, color: '#0a7f3e' }}>• Admin</span>}
            </div>
            <div>
              {String(u._id) === String(userInfo._id) ? (
                <em style={{ color: '#6b778c' }}>You</em>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {userInfo?.isAdmin && (
                    <button onClick={() => dispatch(updateUserRole({ userId: u._id, isAdmin: !u.isAdmin }))} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: u.isAdmin ? '#bf2600' : '#0079bf', color: 'white' }}>
                      {u.isAdmin ? 'Revoke Admin' : 'Make Admin'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminPanel;
