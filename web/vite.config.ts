import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [{ find: /^@\//, replacement: `${path.resolve(root, 'src')}/` }],
  },
  optimizeDeps: {
    include: [
      'graphology',
      'sigma',
      '@sigma/edge-curve',
      '@sigma/node-border',
      'graphology-layout-forceatlas2',
      '@tanstack/react-query',
      'vis-data',
      'vis-timeline',
    ],
  },
  build: {
    outDir: path.resolve(root, '../dist/web'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@phosphor-icons')) return 'phosphor';
          if (id.includes('@radix-ui') || id.includes('/radix-ui/')) return 'radix';
          if (
            id.includes('react-dom') ||
            id.includes('react-router') ||
            id.includes('/react/')
          ) {
            return 'react-vendor';
          }
        },
      },
    },
  },
});
