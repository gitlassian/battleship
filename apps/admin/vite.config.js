// Vite config for the cat-shop admin panel.
// Runs on port 5174 and forwards /api and /uploads to the API server (port 3001 by default),
// so the code can use plain "/api/..." paths and photo URLs returned by the API just work.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_SERVER_URL = process.env.API_URL || 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': API_SERVER_URL,
      '/uploads': API_SERVER_URL,
    },
  },
});
