import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        'dist',
        '**/*.d.ts',
        '**/tests/**',
        '**/infrastructure/**',
      ],
    },
    alias: {
      '@turkish-logistics/shared': path.resolve(__dirname, './packages/shared/src'),
      '@turkish-logistics/parser': path.resolve(__dirname, './packages/parser/src'),
      '@turkish-logistics/database': path.resolve(__dirname, './packages/database/src'),
    },
  },
});
