import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { seedTypesAndTraits } from './db/repo.js';
import { SettingsProvider } from './context/SettingsContext.jsx';
import './styles.css';

// Read saved theme preference (default 'dark') and apply before first paint.
const saved = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', saved);

(async () => {
  await seedTypesAndTraits();

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </StrictMode>
  );
})();
