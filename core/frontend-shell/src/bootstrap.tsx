import React from 'react';
import ReactDOM from 'react-dom/client';
import { PlatformProvider } from '@platform/ui-sdk';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <PlatformProvider>
      <App />
    </PlatformProvider>
  </React.StrictMode>
);
