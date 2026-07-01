import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosClient from '../api/axiosClient';
import { API_BASE_URL } from '../config/runtimeUrls';

export const fetchBoards = createAsyncThunk('boards/fetchBoards', async (_, thunkAPI) => {
  const response = await axiosClient.get('/boards');
  return response.data;
});

export const fetchBoardDetails = createAsyncThunk('boards/fetchBoardDetails', async (boardId, thunkAPI) => {
  const response = await axiosClient.get(`/boards/${boardId}`);
  return response.data;
});

export const updateBoardColumns = createAsyncThunk('boards/updateBoardColumns', async ({ boardId, columns }, thunkAPI) => {
  const response = await axiosClient.put(`/boards/${boardId}/columns`, { columns });
  return response.data;
});

export const updateCardPosition = createAsyncThunk('boards/updateCardPosition', async ({ cardId, data }, thunkAPI) => {
  // Assuming cards also gets protected eventually, let's pass token
  const response = await axiosClient.put(`/cards/${cardId}`, data);
  return response.data;
});

export const toggleCardReady = createAsyncThunk('boards/toggleCardReady', async ({ cardId, ready }, thunkAPI) => {
  const response = await axiosClient.put(`/cards/${cardId}/ready`, { ready });
  return response.data;
});

export const updateCardDetails = createAsyncThunk('boards/updateCardDetails', async ({ cardId, data }, thunkAPI) => {
  const response = await axiosClient.put(`/cards/${cardId}`, data);
  return response.data;
});

export const addCardComment = createAsyncThunk('boards/addCardComment', async ({ cardId, text }, thunkAPI) => {
  const { auth } = thunkAPI.getState();
  const response = await axiosClient.post(`/cards/${cardId}/comments`, { 
    text, 
    user: auth.userInfo._id 
  });
  return response.data;
});

export const createCard = createAsyncThunk('boards/createCard', async ({ columnId, title, order }, thunkAPI) => {
  const response = await axiosClient.post('/cards', { columnId, title, order });
  return { ...response.data, columnId };
});

export const createColumn = createAsyncThunk('boards/createColumn', async ({ boardId, title, order }, thunkAPI) => {
  const response = await axiosClient.post('/columns', { boardId, title, order });
  return response.data;
});

export const deleteColumn = createAsyncThunk('boards/deleteColumn', async ({ columnId }, thunkAPI) => {
  const response = await axiosClient.delete(`/columns/${columnId}`);
  return { columnId };
});

export const createBoard = createAsyncThunk('boards/createBoard', async ({ title, description, urgency, deadline, collaborationMode }, thunkAPI) => {
  const response = await axiosClient.post('/boards', { title, description, urgency, deadline, collaborationMode });
  return response.data;
});

export const deleteBoard = createAsyncThunk('boards/deleteBoard', async (boardId, thunkAPI) => {
  await axiosClient.delete(`/boards/${boardId}`);
  return boardId;
});

const boardSlice = createSlice({
  name: 'boards',
  initialState: {
    list: [],
    currentBoard: null,
    status: 'idle',
    error: null
  },
  reducers: {
    updateBoardOptimistically: (state, action) => {
      state.currentBoard = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBoards.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchBoards.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.list = action.payload;
      })
      .addCase(fetchBoards.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message;
      })
      .addCase(fetchBoardDetails.fulfilled, (state, action) => {
        state.currentBoard = action.payload;
      })
      .addCase(createCard.fulfilled, (state, action) => {
        if (state.currentBoard) {
          const colIndex = state.currentBoard.columns.findIndex(c => String(c._id) === String(action.payload.columnId));
          if (colIndex !== -1) {
            state.currentBoard.columns[colIndex].cards.push(action.payload);
          }
        }
      })
      .addCase(createColumn.fulfilled, (state, action) => {
        if (state.currentBoard && String(state.currentBoard._id) === String(action.payload.boardId)) {
          state.currentBoard.columns.push({ ...action.payload, cards: [] });
        }
      })
      .addCase(deleteColumn.fulfilled, (state, action) => {
        const colId = action.payload.columnId;
        if (state.currentBoard) {
          state.currentBoard.columns = state.currentBoard.columns.filter(c => String(c._id) !== String(colId));
        }
      })
      .addCase(createBoard.fulfilled, (state, action) => {
        state.list.push(action.payload);
        state.currentBoard = action.payload; // Auto-select new board
      })
      .addCase(deleteBoard.fulfilled, (state, action) => {
        state.list = state.list.filter(b => String(b._id) !== String(action.payload));
        if (state.currentBoard && String(state.currentBoard._id) === String(action.payload)) {
          state.currentBoard = null;
        }
      })
      .addCase(updateCardDetails.fulfilled, (state, action) => {
        if (state.currentBoard) {
          const updatedCard = action.payload;
          const colIndex = state.currentBoard.columns.findIndex(c => String(c._id) === String(updatedCard.columnId));
          if (colIndex !== -1) {
            const cardIndex = state.currentBoard.columns[colIndex].cards.findIndex(c => String(c._id) === String(updatedCard._id));
            if (cardIndex !== -1) {
              state.currentBoard.columns[colIndex].cards[cardIndex] = {
                ...state.currentBoard.columns[colIndex].cards[cardIndex],
                ...updatedCard
              };
            }
          }
        }
      })
      .addCase(addCardComment.fulfilled, (state, action) => {
        if (state.currentBoard) {
          const updatedCard = action.payload;
          const colIndex = state.currentBoard.columns.findIndex(c => String(c._id) === String(updatedCard.columnId));
          if (colIndex !== -1) {
            const cardIndex = state.currentBoard.columns[colIndex].cards.findIndex(c => String(c._id) === String(updatedCard._id));
            if (cardIndex !== -1) {
              state.currentBoard.columns[colIndex].cards[cardIndex] = {
                ...state.currentBoard.columns[colIndex].cards[cardIndex],
                ...updatedCard
              };
            }
          }
        }
      })
      .addCase(toggleCardReady.fulfilled, (state, action) => {
        if (state.currentBoard) {
          const updatedCard = action.payload;
          const colIndex = state.currentBoard.columns.findIndex(c => String(c._id) === String(updatedCard.columnId));
          if (colIndex !== -1) {
            const cardIndex = state.currentBoard.columns[colIndex].cards.findIndex(c => String(c._id) === String(updatedCard._id));
            if (cardIndex !== -1) {
              state.currentBoard.columns[colIndex].cards[cardIndex] = {
                ...state.currentBoard.columns[colIndex].cards[cardIndex],
                ...updatedCard
              };
            }
          }
        }
      });
  }
});

export const { updateBoardOptimistically } = boardSlice.actions;
export default boardSlice.reducer;