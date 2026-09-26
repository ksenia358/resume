import { cpSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// The resume JSON lives in src for the frontend; resume.php fills the database from a copy next to it.
const resumeSeed: Plugin = {
  name: 'resume-seed',
  apply: 'build',
  closeBundle() {
    cpSync('src/data/content', 'dist/api/seed', { recursive: true });
  },
};

// Apache on the hosting redirects /king to /king/; the dev server would serve the resume there instead.
const kingSlashRedirect: Plugin = {
  name: 'king-slash-redirect',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === '/king' || req.url?.startsWith('/king?')) {
        res.writeHead(301, { Location: req.url.replace('/king', '/king/') });
        res.end();
        return;
      }
      next();
    });
  },
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), kingSlashRedirect, resumeSeed],
  build: {
    // Separate pages: the host serves /king/ from dist/king/index.html without any rewrites.
    rollupOptions: {
      input: {
        main: 'index.html',
        king: 'king/index.html',
      },
    },
  },
  server: {
    // No local PHP: in `yarn dev` the contact form talks to the live backend on the hosting.
    proxy: {
      '/api': { target: 'https://aceventura.ru', changeOrigin: true },
    },
  },
});
