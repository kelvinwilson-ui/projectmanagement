import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { fetchBoards } from '../store/boardSlice';
import { fetchAllUsers } from '../store/authSlice';
import { API_BASE_URL } from '../config/runtimeUrls';

const normalizePhoneLink = (phone) => String(phone || '').replace(/[^\d+]/g, '');

const Profile = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { userInfo, allUsers } = useSelector((state) => state.auth);
  const boards = useSelector((state) => state.boards?.list || []);
  const currentBoard = useSelector((state) => state.boards?.currentBoard || null);
  const [progressUpdates, setProgressUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('progress');
  const [selectedUserId, setSelectedUserId] = useState('');

  const isManager = !!userInfo?.isAdmin;

  const goToMainBoard = () => {
    if (currentBoard?._id) {
      navigate(`/board/${currentBoard._id}`);
      return;
    }

    navigate('/');
  };

  useEffect(() => {
    dispatch(fetchAllUsers());
    dispatch(fetchBoards());
  }, [dispatch]);

  useEffect(() => {
    const loadProgress = async () => {
      try {
        setLoading(true);
        const token = userInfo?.token;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const boardIds = boards.map((board) => board._id).filter(Boolean);
        const results = await Promise.all(
          boardIds.map((boardId) => axios.get(`${API_BASE_URL}/progress?boardId=${boardId}`, { headers }))
        );
        const flattened = results.flatMap((result) => result.data || []);
        setProgressUpdates(flattened);
      } catch (error) {
        console.error('Failed to load progress updates', error);
      } finally {
        setLoading(false);
      }
    };

    if (isManager && boards.length > 0) {
      loadProgress();
    } else {
      setLoading(false);
    }
  }, [boards, isManager, userInfo?.token]);

  const boardCards = useMemo(() => {
    return boards.flatMap((board) =>
      (board.columns || []).flatMap((column) =>
        (column.cards || []).map((card) => ({
          ...card,
          boardTitle: board.title,
          boardId: board._id,
          boardCreator: board.creator,
          columnTitle: column.title,
        }))
      )
    );
  }, [boards]);

  const assigneeRows = useMemo(() => {
    const rows = new Map();

    for (const user of allUsers) {
      rows.set(String(user._id), {
        user,
        cards: [],
        latestProgress: null,
      });
    }

    for (const card of boardCards) {
      const assigneeId = String(card.assignee?._id || card.assignee || '');
      if (!assigneeId) continue;
      if (!rows.has(assigneeId)) {
        rows.set(assigneeId, { user: { _id: assigneeId, name: 'Unknown', email: '', phone: '' }, cards: [], latestProgress: null });
      }
      rows.get(assigneeId).cards.push(card);
    }

    for (const update of progressUpdates) {
      const assigneeId = String(update.user?._id || update.user || '');
      const row = rows.get(assigneeId);
      if (!row) continue;
      if (!row.latestProgress || new Date(update.createdAt) > new Date(row.latestProgress.createdAt)) {
        row.latestProgress = update;
      }
    }

    return Array.from(rows.values()).sort((a, b) => {
      const aName = a.user?.name || '';
      const bName = b.user?.name || '';
      return aName.localeCompare(bName);
    });
  }, [allUsers, boardCards, progressUpdates]);

  const progressRows = useMemo(() => {
    const latestByCard = new Map();
    for (const update of progressUpdates) {
      const cardId = String(update.card?._id || update.card || '');
      const existing = latestByCard.get(cardId);
      if (!existing || new Date(update.createdAt) > new Date(existing.createdAt)) {
        latestByCard.set(cardId, update);
      }
    }

    return boardCards
      .map((card) => ({
        card,
        progress: latestByCard.get(String(card._id)) || null,
      }))
      .filter((row) => row.card.assignee)
      .sort((a, b) => (b.progress?.percent || 0) - (a.progress?.percent || 0));
  }, [boardCards, progressUpdates]);

  const selectedAssignee = assigneeRows.find((row) => String(row.user?._id) === String(selectedUserId)) || assigneeRows[0] || null;

  useEffect(() => {
    if (!selectedUserId && selectedAssignee?.user?._id) {
      setSelectedUserId(String(selectedAssignee.user._id));
    }
  }, [selectedAssignee, selectedUserId]);

  if (!isManager) {
    return (
      <div style={{ padding: '32px', color: 'white' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
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
        <h2 style={{ marginTop: 0 }}>Profile</h2>
        <p>This profile area is available to project managers.</p>
      </div>
    );
  }

  const totalCards = boardCards.length;
  const totalAssignees = assigneeRows.filter((row) => row.cards.length > 0).length;
  const averageProgress = progressRows.length
    ? Math.round(progressRows.reduce((sum, row) => sum + (row.progress?.percent || 0), 0) / progressRows.length)
    : 0;

  return (
    <div className="pm-page pm-profile" style={{ padding: '28px', color: 'white' }}>
      <div className="pm-profile__header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '2rem' }}>Manager Profile</h2>
          <div style={{ opacity: 0.88, marginTop: 6 }}>Monitor live progress and assignee details from one place.</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: '14px 18px', minWidth: 120 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Cards</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{totalCards}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: '14px 18px', minWidth: 120 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Assignees</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{totalAssignees}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: '14px 18px', minWidth: 120 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Average Progress</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{averageProgress}%</div>
          </div>
        </div>
      </div>

      <div className="pm-profile__tabs" style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button onClick={() => setActiveTab('progress')} style={{ padding: '10px 16px', borderRadius: 999, border: 'none', background: activeTab === 'progress' ? 'white' : 'rgba(255,255,255,0.16)', color: activeTab === 'progress' ? '#026aa7' : 'white', fontWeight: 800, cursor: 'pointer' }}>
          Current Progress
        </button>
        <button onClick={() => setActiveTab('assignees')} style={{ padding: '10px 16px', borderRadius: 999, border: 'none', background: activeTab === 'assignees' ? 'white' : 'rgba(255,255,255,0.16)', color: activeTab === 'assignees' ? '#026aa7' : 'white', fontWeight: 800, cursor: 'pointer' }}>
          Assignee Details
        </button>
      </div>

      {loading ? (
        <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 18, padding: 24 }}>Loading manager data...</div>
      ) : activeTab === 'progress' ? (
        <div style={{ display: 'grid', gap: 14 }}>
          {progressRows.length === 0 ? (
            <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 18, padding: 24 }}>No progress updates yet.</div>
          ) : progressRows.map(({ card, progress }) => (
            <div key={card._id} style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 18, padding: 20, backdropFilter: 'blur(10px)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>{card.boardTitle} / {card.columnTitle}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{card.title}</div>
                  <div style={{ marginTop: 6, opacity: 0.9 }}>Assignee: {card.assignee?.name || 'Unassigned'}</div>
                </div>
                <div style={{ fontSize: 30, fontWeight: 900, color: '#dff7e8' }}>{progress?.percent ?? 0}%</div>
              </div>
              <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 12, background: 'rgba(0,0,0,0.12)' }}>
                {progress?.note || 'No note provided'}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                {progress ? `${progress.user?.name || 'Unknown'} • ${new Date(progress.createdAt).toLocaleString()}` : 'No progress posted yet'}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="pm-profile__layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) 1fr', gap: 18, alignItems: 'start' }}>
          <div className="pm-profile__list" style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 18, padding: 16, maxHeight: '72vh', overflowY: 'auto' }}>
            {assigneeRows.filter((row) => row.cards.length > 0).map((row) => {
              const selected = String(row.user?._id) === String(selectedAssignee?.user?._id);
              return (
                <button
                  key={row.user?._id}
                  onClick={() => setSelectedUserId(String(row.user?._id))}
                  style={{ width: '100%', textAlign: 'left', marginBottom: 10, border: 'none', borderRadius: 14, padding: 14, background: selected ? 'white' : 'rgba(255,255,255,0.1)', color: selected ? '#026aa7' : 'white', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                    <strong>{row.user?.name || 'Unknown'}</strong>
                    <span>{row.cards.length} tasks</span>
                  </div>
                  <div style={{ fontSize: 13, opacity: selected ? 0.78 : 0.9, marginTop: 6 }}>{row.user?.email || 'No email'}</div>
                  {row.user?.phone && (
                    <div style={{ fontSize: 13, opacity: selected ? 0.78 : 0.9, marginTop: 4 }}>
                      <a href={`tel:${normalizePhoneLink(row.user.phone)}`} style={{ color: 'inherit', textDecoration: 'underline' }}>
                        {row.user.phone}
                      </a>
                    </div>
                  )}
                  <div style={{ fontSize: 13, opacity: selected ? 0.78 : 0.9, marginTop: 4 }}>
                    Latest progress: {row.latestProgress ? `${row.latestProgress.percent}%` : 'No update yet'}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="pm-profile__detail" style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 18, padding: 22, minHeight: 300 }}>
            {selectedAssignee ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.6rem' }}>{selectedAssignee.user?.name || 'Unknown Assignee'}</h3>
                    <div style={{ marginTop: 6, opacity: 0.88 }}>
                      {selectedAssignee.user?.email ? (
                        <a href={`mailto:${selectedAssignee.user.email}`} style={{ color: 'inherit', textDecoration: 'underline' }}>
                          {selectedAssignee.user.email}
                        </a>
                      ) : (
                        'No email provided'
                      )}
                    </div>
                    <div style={{ marginTop: 4, opacity: 0.88 }}>
                      {selectedAssignee.user?.phone ? (
                        <a href={`tel:${normalizePhoneLink(selectedAssignee.user.phone)}`} style={{ color: 'inherit', textDecoration: 'underline' }}>
                          {selectedAssignee.user.phone}
                        </a>
                      ) : (
                        'No phone provided'
                      )}
                    </div>
                  </div>
                  <div style={{ minWidth: 140, padding: '12px 16px', borderRadius: 14, background: 'rgba(0,0,0,0.16)' }}>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>Tasks Assigned</div>
                    <div style={{ fontSize: 28, fontWeight: 800 }}>{selectedAssignee.cards.length}</div>
                  </div>
                </div>

                <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>
                  <div style={{ fontWeight: 800 }}>Assigned Tasks</div>
                  {selectedAssignee.cards.map((card) => {
                    const latest = progressUpdates.filter((entry) => String(entry.card?._id || entry.card || '') === String(card._id)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
                    return (
                      <div key={card._id} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                          <strong>{card.title}</strong>
                          <span>{latest ? `${latest.percent}%` : '0%'}</span>
                        </div>
                        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.88 }}>{card.boardTitle} • {card.columnTitle}</div>
                        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.88 }}>{latest?.note || 'No recent progress note'}</div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div>Select an assignee to view details.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;