import { expect, test } from '@playwright/test';
import { login } from './helpers';

// Cubre historia clínica de punta a punta: crear paciente, registrar una
// entrada dentro de la sección "Antecedentes médicos relevantes", editarla
// (lo que debe versionar el estado anterior) y confirmar que la versión
// archivada es visible.
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
  // el encabezado de la ficha — nos quedamos con el último en el DOM).
  await expect(page.getByText('Paciente E2E').last()).toBeVisible();
  await expect(page.getByText(`MRN: ${mrn}`)).toBeVisible();

  const backgroundSection = page.locator('.card', { hasText: 'Antecedentes médicos relevantes' });
  await backgroundSection.getByRole('button', { name: 'Agregar' }).click();

  const entryForm = page.locator('form').filter({ hasText: 'Título' });
  await entryForm.locator('input').fill('Consulta inicial');
  await entryForm.locator('textarea').fill('Descripción original de la consulta.');
  await entryForm.getByRole('button', { name: 'Registrar entrada' }).click();
  await expect(page.getByText('Entrada registrada.')).toBeVisible();

  await expect(backgroundSection.getByText('Consulta inicial')).toBeVisible();
  await expect(backgroundSection.getByText('v1')).toBeVisible();

  await backgroundSection.getByRole('button', { name: 'Editar' }).click();
  const editForm = page.locator('form').filter({ hasText: 'Título' });
  await editForm.locator('textarea').fill('Descripción corregida tras revisión.');
  await editForm.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Entrada actualizada (versión anterior archivada).')).toBeVisible();

  await expect(backgroundSection.getByText('v2')).toBeVisible();
  await expect(backgroundSection.getByText('Descripción corregida tras revisión.')).toBeVisible();

  await backgroundSection.getByRole('button', { name: 'Ver versiones' }).click();
  await expect(backgroundSection.getByText('Descripción original de la consulta.')).toBeVisible();
});

// Cubre los campos clínicos nuevos: peso/altura del paciente y
// dosis/frecuencia/inicio de una prescripción, tal como los pide la ficha.
test('records a prescription with dose, frequency and start date under Medicamentos actuales', async ({ page }) => {
  await login(page, 'farmaceutico@medline.hospital');
  await page.goto('/historia-clinica');

  // Rosa Martínez viene sembrada con datos de demo.
  await page.locator('table.data tr', { hasText: 'Rosa Martínez' }).click();
  await expect(page.getByText('MRN: HC-000123')).toBeVisible();
  await expect(page.getByText('Peso:')).toBeVisible();

  const medsSection = page.locator('.card', { hasText: 'Medicamentos actuales' });
  await medsSection.getByRole('button', { name: 'Agregar' }).click();

  const entryForm = page.locator('form').filter({ hasText: 'Título' });
  await entryForm.locator('select').first().selectOption('PRESCRIPTION');
  await entryForm.locator('input').nth(0).fill('Atorvastatina 20mg');
  await entryForm.locator('textarea').fill('Vía oral, con la cena.');
  await entryForm.locator('input[placeholder="p.ej. 50 mg"]').fill('20 mg');
  await entryForm.locator('input[placeholder="p.ej. 1 vez al día"]').fill('1 vez al día');
  await entryForm.getByRole('button', { name: 'Registrar entrada' }).click();
  await expect(page.getByText('Entrada registrada.')).toBeVisible();

  await expect(medsSection.getByText('Atorvastatina 20mg')).toBeVisible();
  await expect(medsSection.getByText('20 mg · 1 vez al día')).toBeVisible();
});
