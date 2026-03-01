import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
  resolve: {
    // Allow importing .ts files via .js extensions (Node ESM TypeScript pattern)
    extensionAlias: {
      '.js': ['.ts', '.js'],
    },
  },
});
