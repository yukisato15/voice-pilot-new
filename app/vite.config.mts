import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(__dirname, 'renderer'),
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@renderer': path.resolve(__dirname, 'renderer'),
      '@store': path.resolve(__dirname, 'renderer/store'),
      '@components': path.resolve(__dirname, 'renderer/components'),
      '@styles': path.resolve(__dirname, 'styles')
    }
  }
});
