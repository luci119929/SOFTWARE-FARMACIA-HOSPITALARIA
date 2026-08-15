import { expect, test } from '@playwright/test';
import { login } from './helpers';

// Cubre logística inversa de punta a punta: registrar una devolución y
// procesarla con disposición RESTOCK, verificando que quede reflejada como
// tal en el historial (el ajuste real de stock ya está cubierto por los
// tests unitarios del dominio en backend/src/domain/__tests__).
test('a pharmacist registers a return and processes it back into stock', async ({ page }) => {
  await login(page, 'farmaceutico@medline.hospital');
  await page.goto('/devoluciones');

  await page.selectOption('select', { index: 1 }); // primer medicamento del catálogo
  await page.locator('input[type="number"]').fill('3');
  await page.getByRole('button', { name: 'Registrar devolución' }).click();
  await expect(page.getByText('Devolución registrada como pendiente.')).toBeVisible();

  const historyTable = page.locator('table.data');
  const pendingRow = historyTable.locator('tr', { hasText: 'Pendiente' }).first();
  await expect(pendingRow).toBeVisible();
  const code = (await pendingRow.locator('td').first().textContent())?.trim() ?? '';
  expect(code).toMatch(/^RET-/);

  await pendingRow.getByRole('button', { name: 'Procesar' }).click();
  const processForm = page.locator('.card', { hasText: 'Procesar devolución' });
  await processForm.locator('input').nth(0).fill('E2E-RET-LOTE');
  await processForm.locator('input[type="date"]').fill('2027-10-31');
  await processForm.locator('input').nth(2).fill('E2E-Ubicacion');
  await processForm.getByRole('button', { name: 'Confirmar' }).click();

  await expect(page.getByText('Devolución procesada.')).toBeVisible();
  const processedRow = page.locator('table.data').locator('tr', { hasText: code });
  await expect(processedRow.getByText('Reingresar a stock')).toBeVisible();
});
