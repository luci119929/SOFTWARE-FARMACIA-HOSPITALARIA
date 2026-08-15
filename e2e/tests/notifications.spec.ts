import { expect, test } from '@playwright/test';
import { login } from './helpers';

// Prueba el canal WebSocket de punta a punta con DOS usuarios reales en DOS
// contextos de navegador separados: uno dispara un movimiento de stock, el
// otro debe recibir la notificación en vivo sin recargar la página.
test('a movement registered by one user shows up live in another user notification bell', async ({ browser }) => {
  const pharmacistContext = await browser.newContext();
  const chiefContext = await browser.newContext();
  const pharmacistPage = await pharmacistContext.newPage();
  const chiefPage = await chiefContext.newPage();

  try {
    await login(chiefPage, 'jefe@medline.hospital');
    await login(pharmacistPage, 'farmaceutico@medline.hospital');

    // El jefe se queda en el Panel con la campanita conectada.
    await chiefPage.goto('/');
    await chiefPage.getByLabel('Notificaciones').waitFor({ state: 'visible' });

    // El farmacéutico registra un movimiento desde otra sesión.
    await pharmacistPage.goto('/movimientos');
    await pharmacistPage.selectOption('select', { index: 1 });
    await pharmacistPage.fill('input[type="number"]', '2');
    await pharmacistPage.getByRole('button', { name: 'Registrar' }).click();
    await expect(pharmacistPage.getByText('Movimiento registrado.')).toBeVisible();

    // Debe llegar en vivo del lado del jefe (sin recargar) — abrimos la
    // campanita y esperamos a que aparezca la notificación.
    await chiefPage.getByLabel('Notificaciones').click();
    await expect(chiefPage.getByText('Movimiento registrado:')).toBeVisible({ timeout: 10_000 });
  } finally {
    await pharmacistContext.close();
    await chiefContext.close();
  }
});
