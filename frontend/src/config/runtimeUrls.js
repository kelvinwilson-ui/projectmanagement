const getLocation = () => {
  if (typeof window === 'undefined') return null;
  return window.location;
};

const getFallbackApiBase = () => {
  return '/api';
};

const getFallbackSocketBase = () => {
  const location = getLocation();
  if (!location) return 'http://localhost:5000';
  return `${location.protocol}//${location.hostname}:5000`;
};

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || getFallbackApiBase();
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || getFallbackSocketBase();
