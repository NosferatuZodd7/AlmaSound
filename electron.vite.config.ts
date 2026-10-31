import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    build: { lib: { entry: resolve('electron/main.ts') } },
  },
  preload: {
    // Sandboxed preloads must be CommonJS.
    build: { lib: { entry: resolve('electron/preload.ts') }, rolldownOptions: { output: { format: 'cjs', entryFileNames: '[name].cjs' } } },
  },
  renderer: {
    root: 'src',
    plugins: [react()],
    build: { rolldownOptions: { input: resolve('src/index.html') } },
  },
});
