// Vite config for the cat-shop storefront.
// Runs on port 5173 and forwards every /api request to the API server on port 3001,
// so the browser talks to one origin and the code can use plain "/api/cats" paths.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Where apps/api listens in development (see plan.md on the agentbridge board).
const API_SERVER_URL = process.env.API_URL || 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': API_SERVER_URL },
  },
});
