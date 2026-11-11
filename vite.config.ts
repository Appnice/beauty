import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

const testDb = process.env.TEST_DATABASE_URL ?? 'postgres://beauty:beauty@127.0.0.1:55440/beauty_test';

export default defineConfig({
  plugins: [sveltekit()],
  server: { port: 8150, strictPort: true },
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
    env: {
      DATABASE_URL: testDb,
      TEST_DATABASE_URL: testDb,
      APP_SECRET: 'test-secret',
      PUBLIC_URL: 'http://localhost:8151',
      SMS_PROVIDER: 'log',
      SMS_ECHO: 'off',
      JOBS: 'off',
      SIGNUP_CODE: 'test-invite',
      SINGLE_SALON: 'off',
      DEMO_MANAGER_PASSWORD: 'demo1234',
      BEAUTY_QUIET: '1'
    }
  }
});
