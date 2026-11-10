import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      PGLITE_DIR: '.data/vitest-pglite',
      COLLECTOR_ENABLED: 'false',
      MONITOR_SCHEDULER_ENABLED: 'false',
      AUTO_BOOTSTRAP: 'false',
      ADMIN_API_TOKEN: '',
      WEBHOOK_SECRET: 'vitest-webhook-secret',
      CREDENTIAL_ENCRYPTION_KEY: 'vitest-encryption-key-32-characters-long',
    },
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
