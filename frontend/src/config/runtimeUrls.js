const getLocation = () => {
  if (typeof window === 'undefined') return null;
  return window.location;
};

const getFallbackApiBase = () => {
  const location = getLocation();

  if (location && /vercel\.app$/i.test(location.hostname)) {
    return 'https://projectmanagement-production-61f5.up.railway.app';
  }

  return '/api';
};

const getFallbackSocketBase = () => {
  const location = getLocation();
  if (!location) return 'http://localhost:5000';
  return `${location.protocol}//${location.hostname}:5000`;
};

export const API_BASE_URL = import.meta.env?.VITE_API_URL || import.meta.env?.VITE_API_BASE_URL || getFallbackApiBase();
export const SOCKET_URL = import.meta.env?.VITE_SOCKET_URL || getFallbackSocketBase();
