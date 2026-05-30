import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './store/index.js'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'

// React.StrictMode removed to prevent react-beautiful-dnd double-mount issues in React 18
// Global error handlers: render a visible overlay for runtime errors
window.addEventListener('error', (e) => {
  try {
    const existing = document.getElementById('global-error-overlay');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.id = 'global-error-overlay';
    el.style.position = 'fixed';
    el.style.top = '0';
    el.style.left = '0';
    el.style.right = '0';
    el.style.background = 'white';
    el.style.color = 'black';
    el.style.zIndex = '99999';
    el.style.padding = '16px';
    el.style.borderBottom = '1px solid #ddd';
    el.style.fontFamily = 'monospace';
    el.textContent = `Error: ${e.message || e.error || e}`;
    document.body.appendChild(el);
  } catch (err) {
    // ignore
  }
});

window.addEventListener('unhandledrejection', (e) => {
  try {
    const existing = document.getElementById('global-error-overlay');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.id = 'global-error-overlay';
    el.style.position = 'fixed';
    el.style.top = '0';
    el.style.left = '0';
    el.style.right = '0';
    el.style.background = 'white';
    el.style.color = 'black';
    el.style.zIndex = '99999';
    el.style.padding = '16px';
    el.style.borderBottom = '1px solid #ddd';
    el.style.fontFamily = 'monospace';
    el.textContent = `Unhandled Rejection: ${e.reason || e}`;
    document.body.appendChild(el);
  } catch (err) {
    // ignore
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </Provider>
)
