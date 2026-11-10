import React from 'react';
import ReactDOM from 'react-dom/client';
import { ProvekoProvider } from '@proveko/ui-sdk';
import '../../../ui-sdk/src/styles/theme.css';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ProvekoProvider>
      <App />
    </ProvekoProvider>
  </React.StrictMode>
);
