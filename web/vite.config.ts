import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server proxies the API and the Socket.IO channel, so the browser talks to one
// origin. That keeps the refresh-token cookie SameSite=Strict and avoids CORS in dev.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // also reachable from a phone on the same Wi-Fi: http://<laptop-IP>:5173
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: false },
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
});
