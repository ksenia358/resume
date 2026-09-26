import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.scss';
import '../i18n';
import { AntdProvider } from '../app/AntdProvider';
import { KingApp } from './KingApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AntdProvider>
      <KingApp />
    </AntdProvider>
  </StrictMode>,
);
