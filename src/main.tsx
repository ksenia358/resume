import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.scss';
import './i18n';
import { AntdProvider } from './app/AntdProvider';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AntdProvider>
      <App />
    </AntdProvider>
  </StrictMode>,
);
