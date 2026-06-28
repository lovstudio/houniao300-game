import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { lovinspPlugin } from 'lovinsp';
import pkg from './package.json';

// https://vitejs.dev/config/
// base: local dev keeps /ai-town; the Vercel production build sets VITE_BASE=/ for the
// dedicated domain (houniao300-game.lovstudio.ai). lovinsp is dev-only (never shipped).
export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE ?? '/ai-town',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [...(command === 'serve' ? [lovinspPlugin({ bundler: 'vite' })] : []), react()],
  server: {
    // 监听 0.0.0.0，允许同一局域网的手机用本机 IP 访问（http://<电脑IP>:5173/ai-town/）。
    host: true,
    allowedHosts: ['ai-town-your-app-name.fly.dev', 'localhost', '127.0.0.1'],
  },
}));
