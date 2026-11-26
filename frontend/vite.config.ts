import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      // Multi-page build: dApp (index.html) + marketing landing (landing.html)
      input: {
        main: path.resolve(__dirname, 'index.html'),
        landing: path.resolve(__dirname, 'landing.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@sdk': path.resolve(__dirname, '../sdk/src'),
    },
  },
});
