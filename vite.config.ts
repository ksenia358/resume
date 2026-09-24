import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // No local PHP: in `yarn dev` the contact form talks to the live backend on the hosting.
    proxy: {
      '/api': { target: 'https://aceventura.ru', changeOrigin: true },
    },
  },
});
