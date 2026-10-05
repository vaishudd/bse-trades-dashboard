import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the browser talks only to :5173; Vite forwards /api (including the SSE stream)
// to the Express server, so no CORS setup is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: true } },
  },
});
