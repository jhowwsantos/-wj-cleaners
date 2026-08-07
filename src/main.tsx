import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    const msg = String(event.message || event.error?.message || event.error || '');
    if (
      msg.includes('IDBDatabase') ||
      msg.includes('database connection is closing') ||
      event.error?.name === 'InvalidStateError'
    ) {
      console.warn('Prevented unhandled IDBDatabase closing error:', event.error || msg);
      event.preventDefault();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const msg = String(event.reason?.message || event.reason || '');
    if (
      msg.includes('IDBDatabase') ||
      msg.includes('database connection is closing') ||
      event.reason?.name === 'InvalidStateError'
    ) {
      console.warn('Prevented unhandled IDBDatabase closing rejection:', event.reason);
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

