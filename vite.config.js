import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Minimal Vite config. Nothing fancy in v1.
export default defineConfig({
  plugins: [react()],
});
