import axios from 'axios';
import { API_BASE_URL } from '../config/runtimeUrls';

const client = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // send cookies for refresh token
});

// Attach access token from localStorage
client.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('userToken');
    if (token) config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
  } catch (e) {
    // ignore
  }
  return config;
});

// Response interceptor: on 401 attempt a refresh once
let isRefreshing = false;
let refreshQueue = [];

const processQueue = (error, token = null) => {
  refreshQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  refreshQueue = [];
};

client.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;
    if (err.response && err.response.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return client(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, null, { withCredentials: true });
        const newToken = response.data.token;
        localStorage.setItem('userToken', newToken);
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return client(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // clear stored auth
        localStorage.removeItem('userToken');
        localStorage.removeItem('userInfo');
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(err);
  }
);

export default client;
