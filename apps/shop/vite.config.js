// Vite config for the cat-shop storefront (port 5173).
// The API address comes from VITE_API_URL (see src/api.js); the API allows CORS from :5173.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
