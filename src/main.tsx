import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import App from './App';
import { UiProvider } from './components/ui';
import { AuthProvider } from './hooks/auth';

registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <UiProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </UiProvider>
    </HashRouter>
  </React.StrictMode>
);
