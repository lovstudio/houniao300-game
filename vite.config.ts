import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { lovinspPlugin } from 'lovinsp';

// https://vitejs.dev/config/
// base: local dev keeps /ai-town; the Vercel production build sets VITE_BASE=/ for the
// dedicated domain (houniao300-game.lovstudio.ai). lovinsp is dev-only (never shipped).
export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE ?? '/ai-town',
  plugins: [...(command === 'serve' ? [lovinspPlugin({ bundler: 'vite' })] : []), react()],
  server: {
    allowedHosts: ['ai-town-your-app-name.fly.dev', 'localhost', '127.0.0.1'],
  },
}));
