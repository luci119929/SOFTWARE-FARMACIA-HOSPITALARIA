import { expect, test } from '@playwright/test';
import { login } from './helpers';

// Cubre el flujo completo del Motor de Compra: generar una recomendación como
// orden en borrador, enviarla a aprobación, aprobarla y recibirla físicamente,
// cada paso con el rol al que el backend efectivamente lo autoriza.
test('a purchase order moves through DRAFT -> SUBMITTED -> APPROVED -> RECEIVED across the three roles that own each step', async ({
  page,
}) => {
  // 1. Compras genera una orden a partir de una recomendación activa.
  await login(page, 'compras@medline.hospital');
  await page.goto('/motor-compra');
  await expect(page.getByText('Recomendaciones activas')).toBeVisible();

  const firstRecommendation = page.locator('.grid-2 > .card').first();
  await expect(firstRecommendation).toBeVisible();
  // El nombre vive en un <div> hermano del Badge (que es un <span>), así que
  // el combinador de hijo directo evita capturar el texto "Reponer" del badge.
  const itemName = (await firstRecommendation.locator('.row.between > div').textContent())?.trim() ?? '';

  await firstRecommendation.getByRole('button', { name: 'Generar / consolidar orden' }).click();
  await expect(page.getByText(/orden de compra generada|consolidada/i)).toBeVisible();

  const ordersTable = page.locator('table.data').last();
  const newRow = ordersTable.locator('tr', { hasText: itemName }).first();
  await expect(newRow.getByText('Borrador')).toBeVisible();
  const code = (await newRow.locator('td').first().textContent())?.trim() ?? '';
  expect(code).toMatch(/^PO-/);

  // Enviar a aprobación.
  await newRow.getByRole('button', { name: 'Enviar a aprobación' }).click();
  await expect(page.getByText(`Orden ${code} enviada a aprobación.`)).toBeVisible();

  // 2. Jefe de Farmacia aprueba.
  await login(page, 'jefe@medline.hospital');
  await page.goto('/motor-compra');
  const rowAsChief = page.locator('table.data').last().locator('tr', { hasText: code });
  await rowAsChief.getByRole('button', { name: 'Aprobar' }).click();
  await expect(page.getByText(`Orden ${code} aprobada.`)).toBeVisible();

  // 3. Depósito recibe la mercadería y el stock/lote se actualizan de verdad.
  await login(page, 'deposito@medline.hospital');
  await page.goto('/motor-compra');
  const rowAsWarehouse = page.locator('table.data').last().locator('tr', { hasText: code });
  await rowAsWarehouse.getByRole('button', { name: 'Registrar recepción' }).click();

  const receiveForm = page.locator('form', { hasText: 'Confirmar recepción' });
  await receiveForm.locator('input[placeholder="Nº de lote"]').fill('E2E-LOTE-001');
  await receiveForm.locator('input[type="date"]').fill('2027-12-31');
  await receiveForm.locator('input[placeholder="Ubicación física"]').fill('E2E-Deposito');
  await receiveForm.getByRole('button', { name: /Confirmar recepción/ }).click();

  await expect(page.getByText(`Recepción registrada para la orden ${code}.`)).toBeVisible();
  const receivedRow = page.locator('table.data').last().locator('tr', { hasText: code });
  await expect(receivedRow.getByText('Recibida')).toBeVisible();
});
