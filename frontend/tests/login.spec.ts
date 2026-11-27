import { test, expect } from '@playwright/test';
import { login } from './fixtures';

test('login with valid credentials', async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/.*dashboard.*/);
});
