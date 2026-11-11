// make e2e: the built app (node build) on 8151 with a fresh database, a fake ntfy server on 8159.
// One worker: the specs share one database and some need exact counts (each resets what it needs).
import { defineConfig, devices } from '@playwright/test';

const DB = process.env.E2E_DATABASE_URL ?? 'postgres://beauty:beauty@127.0.0.1:55440/beauty_e2e';
export const E2E_ENV = {
  PORT: '8151',
  HOST: '127.0.0.1',
  ORIGIN: 'http://localhost:8151',
  DATABASE_URL: DB,
  APP_SECRET: 'e2e-secret-not-for-production',
  PUBLIC_URL: 'https://beauty.appnice.dev',
  SMS_PROVIDER: 'log',
  SMS_ECHO: 'on',
  SIGNUP_CODE: '',
  SINGLE_SALON: 'off',
  ADMIN_PASSWORD: 'e2e-admin-haslo',
  ADMIN_PHONE: '+48500900900',
  ADMIN_NOTIFY_URL: 'http://127.0.0.1:8159/beauty-admin',
  SMS_MONTHLY_LIMIT: '300',
  JOBS: 'on',
  BEAUTY_QUIET: '1'
};

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8151',
    locale: 'pl-PL',
    timezoneId: 'Europe/Warsaw',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    headless: true
  },
  webServer: [
    {
      command: 'node tests/e2e/fake-notify.ts',
      url: 'http://127.0.0.1:8159/received',
      reuseExistingServer: false
    },
    {
      command: 'node build',
      url: 'http://127.0.0.1:8151/health',
      reuseExistingServer: false,
      env: { ...E2E_ENV, DATABASE_URL: DB },
      timeout: 60_000
    }
  ]
});
