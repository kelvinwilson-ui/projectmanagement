import React from 'react';
import { API_BASE_URL } from '../config/runtimeUrls';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ error, info });
    // Optionally send to server-side logging endpoint
    try {
      fetch(`${API_BASE_URL}/logs`, {
        method: 'POST', body: JSON.stringify({ error: String(error), info }),
        headers: { 'Content-Type': 'application/json' }
      }).catch(() => {});
    } catch (e) {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20 }}>
          <h2>Something went wrong</h2>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#f4f4f4', padding: 12 }}>{String(this.state.error)}</pre>
          {this.state.info && <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(this.state.info, null, 2)}</pre>}
        </div>
      );
    }

    return this.props.children;
  }
}
