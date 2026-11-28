import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    passWithNoTests: true,
    // base.test.ts reads the stylesheet's rules; other CSS stays stubbed.
    css: { include: [/theme\/base\.css/] },
  },
});
