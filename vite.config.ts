import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative assets support both username.github.io/repo/ and custom domains.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    watch: { ignored: ['**/.verification/**', '**/.npm-cache/**'] },
  },
});
