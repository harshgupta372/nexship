import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth':          'http://localhost:3000',
      '/orders':        'http://localhost:3000',
      '/tracking':      'http://localhost:3000',
      '/notifications': 'http://localhost:3000',
      '/analytics':     'http://localhost:3000',
    },
  },
});
