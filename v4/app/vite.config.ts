import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const v4Root = path.resolve(appRoot, '..');

export default defineConfig({
  // 相对 base：Tauri 自定义协议、GitHub Pages 子路径与离线静态包共用。
  base: './',
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    fs: {
      allow: [v4Root],
    },
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  resolve: {
    alias: [
      { find: '@core', replacement: path.resolve(v4Root, 'core') },
      { find: '@adapters', replacement: path.resolve(v4Root, 'adapters') },
      { find: '@tauri-apps/api', replacement: path.resolve(appRoot, 'node_modules/@tauri-apps/api') },
      { find: 'react/jsx-runtime', replacement: path.resolve(appRoot, 'node_modules/react/jsx-runtime.js') },
      { find: 'react-dom/client', replacement: path.resolve(appRoot, 'node_modules/react-dom/client.js') },
      { find: 'react-dom', replacement: path.resolve(appRoot, 'node_modules/react-dom') },
      { find: 'react', replacement: path.resolve(appRoot, 'node_modules/react') },
      { find: 'pixi.js', replacement: path.resolve(appRoot, 'node_modules/pixi.js') },
    ],
    dedupe: ['react', 'react-dom'],
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
  },
});
