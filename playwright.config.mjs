import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests',
  testMatch: /e2e\.spec\.mjs/,
  timeout: 90000,
  retries: 1,
  workers: 2,
  reporter: [['list']],
  use: { baseURL: process.env.BASE_URL || 'https://vin-cc.github.io/dollar-filer/', trace: 'retain-on-failure' },
  projects: [
    { name: 'mobile-390', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'desktop-1440', use: { viewport: { width: 1440, height: 900 } } },
  ],
});
