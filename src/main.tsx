import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import WalletContext from './context/WalletContext';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <WalletContext>
      <App />
    </WalletContext>
  </React.StrictMode>
);