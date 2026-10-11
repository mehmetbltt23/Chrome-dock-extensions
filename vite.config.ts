import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        options: new URL('./options.html', import.meta.url).pathname,
        newtab: new URL('./newtab.html', import.meta.url).pathname,
        'service-worker': new URL('./src/background/service-worker.ts', import.meta.url).pathname,
        'web-dock': new URL('./src/content/web-dock.ts', import.meta.url).pathname,
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
