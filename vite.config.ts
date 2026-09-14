import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Project-site base path. GitHub Pages serves this repo at
// /artificial-intelligence-ecosystem/, so every asset URL needs the prefix.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/artificial-intelligence-ecosystem/',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
});
