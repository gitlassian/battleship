// Vite config for the cat-shop storefront.
// Runs on port 5173 and forwards /api and /uploads to the API server (port 3001 by default),
// same as apps/admin, so the code uses plain "/api/..." paths and photo URLs from the API just work.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Where apps/api listens in development; override with API_URL=http://host:port.
const API_SERVER_URL = process.env.API_URL || 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': API_SERVER_URL,
      '/uploads': API_SERVER_URL,
    },
  },
});
