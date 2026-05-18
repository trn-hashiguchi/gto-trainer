import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// GitHub Pagesでサブパス公開する場合は環境変数 VITE_BASE で渡す
// 例: VITE_BASE=/poker/ npm run build
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: { usePolling: true },
    // 社内ワークステーション（ホスト名 "ws" 等）からのアクセスを許可
    allowedHosts: true,
  },
});
