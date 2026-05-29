import { configureStore } from '@reduxjs/toolkit';
import boardReducer from './boardSlice';
import authReducer from './authSlice';

export const store = configureStore({
  reducer: {
    boards: boardReducer,
    auth: authReducer,
  },
});