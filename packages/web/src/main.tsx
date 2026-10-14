import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/context.js';
import { initTheme, ThemeProvider } from '@/lib/theme.js';
import { App } from './app';
import './styles.css';

initTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <ThemeProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </I18nProvider>
  </StrictMode>,
);
