import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import axiosClient from '../api/axiosClient';
import { API_BASE_URL } from '../config/runtimeUrls';

const readStoredJson = (key) => {
  const value = localStorage.getItem(key);
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch (error) {
    localStorage.removeItem(key);
    return null;
  }
};

const userToken = localStorage.getItem('userToken') || null;
const userInfo = readStoredJson('userInfo');

export const registerUser = createAsyncThunk('auth/register', async (userData, thunkAPI) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/register`, userData, { withCredentials: true });
    localStorage.setItem('userInfo', JSON.stringify(response.data));
    localStorage.setItem('userToken', response.data.token);
    return response.data;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response.data.message || error.message);
  }
});

export const loginUser = createAsyncThunk('auth/login', async (userData, thunkAPI) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, userData, { withCredentials: true });
    localStorage.setItem('userInfo', JSON.stringify(response.data));
    localStorage.setItem('userToken', response.data.token);
    return response.data;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response.data.message || error.message);
  }
});

export const logout = createAsyncThunk('auth/logout', async () => {
  try {
    await axiosClient.post('/auth/logout');
  } catch (e) {
    // ignore
  }
  localStorage.removeItem('userInfo');
  localStorage.removeItem('userToken');
});

export const fetchAllUsers = createAsyncThunk('auth/fetchAllUsers', async (_, thunkAPI) => {
  try {
    const response = await axiosClient.get(`/auth/users`);
    return response.data;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response.data.message || error.message);
  }
});

export const toggleAdminUser = createAsyncThunk('auth/toggleAdminUser', async ({ userId, isAdmin }, thunkAPI) => {
  try {
    const response = await axiosClient.put(`/auth/users/${userId}/admin`, { isAdmin });
    return response.data;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || error.message);
  }
});

export const updateUserRole = createAsyncThunk('auth/updateUserRole', async ({ userId, isAdmin }, thunkAPI) => {
  try {
    const response = await axiosClient.put(`/auth/users/${userId}/role`, { isAdmin });
    return response.data;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || error.message);
  }
});

export const completePasswordSetup = createAsyncThunk('auth/completePasswordSetup', async ({ userId, password }, thunkAPI) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/complete-setup`, { userId, password }, { withCredentials: true });
    return { message: response.data.message, userId };
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || error.message);
  }
});

export const adminCreateUser = createAsyncThunk('auth/adminCreateUser', async ({ name, email, phone }, thunkAPI) => {
  try {
    const state = thunkAPI.getState();
    const token = state.auth?.userToken;
    const response = await axiosClient.post(`/auth/users`, { name, email, phone });
    return response.data;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || error.message);
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    userInfo,
    userToken,
    allUsers: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(registerUser.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        state.userInfo = action.payload;
        state.userToken = action.payload.token;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(loginUser.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.userInfo = action.payload;
        state.userToken = action.payload.token;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(logout.fulfilled, (state) => {
        state.userInfo = null;
        state.userToken = null;
      })
      .addCase(fetchAllUsers.fulfilled, (state, action) => {
        state.allUsers = action.payload;
      });
      builder.addCase(toggleAdminUser.fulfilled, (state, action) => {
        const updated = action.payload;
        state.allUsers = state.allUsers.map(u => String(u._id) === String(updated._id) ? updated : u);
        // If current user was updated, update stored userInfo
        if (state.userInfo && String(state.userInfo._id) === String(updated._id)) {
          state.userInfo = { ...state.userInfo, isAdmin: updated.isAdmin };
          localStorage.setItem('userInfo', JSON.stringify(state.userInfo));
        }
      });
      builder.addCase(adminCreateUser.fulfilled, (state, action) => {
        state.allUsers.push(action.payload);
      });
      builder.addCase(updateUserRole.fulfilled, (state, action) => {
        const updated = action.payload;
        state.allUsers = state.allUsers.map(u => String(u._id) === String(updated._id) ? updated : u);
        if (state.userInfo && String(state.userInfo._id) === String(updated._id)) {
          state.userInfo = {
            ...state.userInfo,
            isAdmin: updated.isAdmin,
          };
          localStorage.setItem('userInfo', JSON.stringify(state.userInfo));
        }
      });
      builder.addCase(completePasswordSetup.fulfilled, (state) => {
        if (state.userInfo) {
          state.userInfo = { ...state.userInfo, mustSetPassword: false };
          localStorage.setItem('userInfo', JSON.stringify(state.userInfo));
        }
      });
  },
});

export default authSlice.reducer;