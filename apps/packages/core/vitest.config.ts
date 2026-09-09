import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Les tests vivent à côté du code qu'ils couvrent ; `dist/` ne contient que du build.
    include: ['src/**/*.test.ts'],
  },
});
