import { expect, test } from '@playwright/test';
import { login } from './helpers';

// Cubre historia clínica de punta a punta: crear paciente, registrar una
// entrada, editarla (lo que debe versionar el estado anterior) y confirmar
// que la versión archivada es visible.
test('a pharmacist creates a patient, records an entry, edits it, and the prior version is preserved', async ({
  page,
}) => {
  await login(page, 'farmaceutico@medline.hospital');
  await page.goto('/historia-clinica');

  await page.getByRole('button', { name: 'Nuevo paciente' }).click();
  const mrn = `E2E-${Date.now()}`;
  const patientForm = page.locator('form').filter({ hasText: 'Nº de historia clínica' });
  await patientForm.locator('input').nth(0).fill(mrn);
  await patientForm.locator('input').nth(1).fill('Paciente E2E');
  await patientForm.locator('input[type="date"]').fill('1990-05-20');
  await patientForm.getByRole('button', { name: 'Crear paciente' }).click();
  await expect(page.getByText('Paciente creado.')).toBeVisible();

  // Al crearlo queda seleccionado automáticamente (aparece en la lista Y en
  // el panel de detalle a la derecha — nos quedamos con el último en el DOM).
  await expect(page.getByText('Paciente E2E').last()).toBeVisible();

  await page.getByRole('button', { name: 'Nueva entrada' }).click();
  const entryForm = page.locator('form').filter({ hasText: 'Título' });
  await entryForm.locator('input').fill('Consulta inicial');
  await entryForm.locator('textarea').fill('Descripción original de la consulta.');
  await entryForm.getByRole('button', { name: 'Registrar entrada' }).click();
  await expect(page.getByText('Entrada registrada.')).toBeVisible();

  const entryCard = page.locator('.card', { hasText: 'Consulta inicial' }).last();
  await expect(entryCard.getByText('v1')).toBeVisible();

  await entryCard.getByRole('button', { name: 'Editar' }).click();
  const editForm = page.locator('form').filter({ hasText: 'Título' });
  await editForm.locator('textarea').fill('Descripción corregida tras revisión.');
  await editForm.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Entrada actualizada (versión anterior archivada).')).toBeVisible();

  const updatedCard = page.locator('.card', { hasText: 'Consulta inicial' }).last();
  await expect(updatedCard.getByText('v2')).toBeVisible();
  await expect(updatedCard.getByText('Descripción corregida tras revisión.')).toBeVisible();

  await updatedCard.getByRole('button', { name: 'Ver versiones' }).click();
  await expect(updatedCard.getByText('Descripción original de la consulta.')).toBeVisible();
});
