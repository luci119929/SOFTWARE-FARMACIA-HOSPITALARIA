import type { Page } from '@playwright/test';

export const DEMO_PASSWORD = 'Medline2026!';

export async function login(page: Page, email: string) {
  await page.evaluate(() => localStorage.clear()).catch(() => {});
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', DEMO_PASSWORD);
  await page.click('button.btn-primary');
  await page.waitForURL('**/');
}
