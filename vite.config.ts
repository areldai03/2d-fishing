import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  server: { port: 4173 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
