import { chromium, Browser, Page } from '@playwright/test';

export const TEST_EMAIL = 'pg1959655@gmail.com';
export const TEST_PASSWORD = 'aamishkhan1122';

/**
 * Log in to the application and return a logged‑in page.
 */
export async function login(page: Page): Promise<void> {
  await page.goto('http://localhost:3000/login');
  await page.fill('#email', TEST_EMAIL);
  await page.fill('#password', TEST_PASSWORD);
  await Promise.all([
    page.waitForURL('**/dashboard**'),
    page.click('button:has-text("Sign In")'),
  ]);
}

/**
 * Helper to generate a random string for test data.
 */
export function randomString(length = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}
