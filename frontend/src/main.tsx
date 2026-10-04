import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { ReadAloudProvider } from './context/ReadAloudContext';
import { ThemeProvider } from './context/ThemeContext';
import { FarmProvider } from './context/FarmContext';
import './style.css';

// Register PWA Service Worker immediately
if ('serviceWorker' in navigator && import.meta.env.MODE !== 'test') {
  const registerSW = () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[AgriGuard PWA] Service Worker active with scope:', reg.scope);
        // Force update check on every launch to avoid stale app versions
        reg.update();
      })
      .catch((err) => {
        console.warn('[AgriGuard PWA] Service Worker registration failed:', err);
      });
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    registerSW();
  } else {
    window.addEventListener('load', registerSW);
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <LanguageProvider>
        <ReadAloudProvider>
          <ThemeProvider>
            <FarmProvider>
              <App />
            </FarmProvider>
          </ThemeProvider>
        </ReadAloudProvider>
      </LanguageProvider>
    </AuthProvider>
  </React.StrictMode>
);
