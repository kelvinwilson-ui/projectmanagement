const RAILWAY_BACKEND = 'https://projectmanagement-production-61f5.up.railway.app/api';

const getLocation = () => {
  if (typeof window === 'undefined') return null;
  return window.location;
};

const getApiBase = () => {
  // Check environment variables first
  if (import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (import.meta.env?.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // Runtime check: if on Vercel domain, use Railway backend
  const location = getLocation();
  if (location && /vercel\.app$/i.test(location.hostname)) {
    return RAILWAY_BACKEND;
  }

  // Default to /api for local dev
  return '/api';
};

const getSocketBase = () => {
  if (import.meta.env?.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  
  const location = getLocation();
  if (!location) return 'http://localhost:5000';
  return `${location.protocol}//${location.hostname}:5000`;
};

// Call functions at runtime to get values
export const API_BASE_URL = getApiBase();
export const SOCKET_URL = getSocketBase();

// Also export functions for dynamic calls if needed
export { getApiBase, getSocketBase };
