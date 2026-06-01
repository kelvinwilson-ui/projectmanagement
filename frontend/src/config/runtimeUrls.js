const RAILWAY_BACKEND = 'https://projectmanagement-production-61f5.up.railway.app';

const getLocation = () => {
  if (typeof window === 'undefined') return null;
  return window.location;
};

const getFallbackApiBase = () => {
  const location = getLocation();

  if (location && /vercel\.app$/i.test(location.hostname)) {
    return RAILWAY_BACKEND;
  }

  return '/api';
};

const getFallbackSocketBase = () => {
  const location = getLocation();
  if (!location) return 'http://localhost:5000';
  return `${location.protocol}//${location.hostname}:5000`;
};

// On Vercel, ALWAYS use Railway backend regardless of env vars
const location = getLocation();
const isVercelDeployment = location && /vercel\.app$/i.test(location.hostname);
export const API_BASE_URL = isVercelDeployment ? RAILWAY_BACKEND : (import.meta.env?.VITE_API_URL || import.meta.env?.VITE_API_BASE_URL || getFallbackApiBase());
export const SOCKET_URL = import.meta.env?.VITE_SOCKET_URL || getFallbackSocketBase();
