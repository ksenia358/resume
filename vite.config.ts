import { cpSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

import { resumeDevApi } from './vite/resumeDevApi.ts';

// The resume JSON lives in src for the frontend; resume.php fills the database from a copy next to it.
const resumeSeed: Plugin = {
  name: 'resume-seed',
  apply: 'build',
  closeBundle() {
    cpSync('src/shared/data/content', 'dist/api/seed', { recursive: true });
  },
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), resumeSeed, resumeDevApi()],
  server: {
    // No local PHP: in `yarn dev` the contact form talks to the live backend on the hosting.
    proxy: {
      '/api': { target: 'https://aceventura.ru', changeOrigin: true },
    },
  },
});
