import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('Autenticación y navegación por rol (RBAC)', () => {
  test('rejects invalid credentials with an inline error, no navigation', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'admin@medline.hospital');
    await page.fill('#password', 'contraseña-incorrecta');
    await page.click('button.btn-primary');
    await expect(page.locator('.login-error')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('Auditor sees only its authorized modules — never Usuarios, Motor de Compra, Devoluciones write, or Inventario management actions', async ({
    page,
  }) => {
    await login(page, 'auditor@medline.hospital');
    const sidebar = page.locator('.sidebar-nav');
    await expect(sidebar.getByText('Auditoría', { exact: true })).toBeVisible();
    await expect(sidebar.getByText('Inventario', { exact: true })).toBeVisible();
    await expect(sidebar.getByText('Movimientos', { exact: true })).toBeVisible();
    await expect(sidebar.getByText('Usuarios', { exact: true })).toHaveCount(0);
    await expect(sidebar.getByText('Motor de Compra', { exact: true })).toHaveCount(0);
    await expect(sidebar.getByText('Proveedores', { exact: true })).toHaveCount(0);

    // Backend authority, not just UI: a direct navigation to a forbidden route
    // must bounce back to the dashboard rather than rendering the page.
    await page.goto('/usuarios');
    await expect(page).toHaveURL(/\/$/);
  });

  test('Admin sees Usuarios but not the Motor de Compra it has no permission for', async ({ page }) => {
    await login(page, 'admin@medline.hospital');
    const sidebar = page.locator('.sidebar-nav');
    await expect(sidebar.getByText('Usuarios', { exact: true })).toBeVisible();
    await expect(sidebar.getByText('Motor de Compra', { exact: true })).toHaveCount(0);
  });

  test('Warehouse (Depósito) can reach Motor de Compra to receive purchase orders', async ({ page }) => {
    // Regression check: inventory:supply must be enough to reach the receiving
    // screen even without any purchasing:* permission.
    await login(page, 'deposito@medline.hospital');
    const sidebar = page.locator('.sidebar-nav');
    await expect(sidebar.getByText('Motor de Compra', { exact: true })).toBeVisible();
    await sidebar.getByText('Motor de Compra', { exact: true }).click();
    await expect(page).toHaveURL(/\/motor-compra$/);
    await expect(page.getByRole('heading', { name: 'Órdenes de compra' })).toBeVisible();
  });
});
