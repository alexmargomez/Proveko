import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@proveko/shared-kernel': path.resolve(__dirname, './libs/shared-kernel/src/index.ts'),
      '@proveko/crypto-vault': path.resolve(__dirname, './libs/crypto-vault/src/index.ts'),
      '@proveko/service-guard': path.resolve(__dirname, './libs/service-guard/src/index.ts'),
      '@proveko/tenant-db-resolver': path.resolve(__dirname, './libs/tenant-db-resolver/src/index.ts'),
      '@proveko/event-bus': path.resolve(__dirname, './libs/event-bus/src/index.ts'),
      '@proveko/rules-engine': path.resolve(__dirname, './libs/rules-engine/src/index.ts'),
      '@proveko/ui-kit': path.resolve(__dirname, './libs/ui-kit/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['libs/**/*.spec.ts', 'apps/**/*.spec.ts'],
  },
});
