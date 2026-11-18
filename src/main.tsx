import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { initUpdater } from './lib/updater';
import './index.css';
import App from './App';
import { UiProvider } from './components/ui';
import { AuthProvider } from './hooks/auth';

initUpdater();

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
