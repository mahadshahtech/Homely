import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import express from 'express';
import { defineConfig, type Plugin } from 'vite';
import { apiRouter } from './server/api.ts';

function homelyApiPlugin(): Plugin {
  const app = express();
  app.use(express.json());
  app.use(apiRouter);

  return {
    name: 'homely-api-plugin',
    configureServer(server) {
      server.middlewares.use('/api', (req, res, next) => {
        app(req as any, res as any, next);
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), homelyApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
