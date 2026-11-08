import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Loads apps/api/.env (DATABASE_URL, JWT_SECRET, seed credentials).
    setupFiles: ['dotenv/config'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
