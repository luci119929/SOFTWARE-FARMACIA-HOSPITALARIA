// -----------------------------------------------------------------------------
// Adaptador simulado: no habla con ningún HIS real. Sirve para demostrar que
// la costura (HisAdapter) funciona de punta a punta — status, sync entrante,
// push saliente — con datos claramente etiquetados como simulados, listos
// para reemplazar por un adaptador real (HL7/FHIR/REST) sin tocar quien lo
// consume (routes/integrations.routes.ts).
// -----------------------------------------------------------------------------
import { prisma } from '../../db/prisma';
import type { DispenseEvent, HisAdapter, HisStatus } from './HisAdapter';

const SIMULATED_LATENCY_MS = 120;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockHisAdapter implements HisAdapter {
  readonly name = 'MockHisAdapter (simulado — sin HIS real configurado)';

  async checkStatus(): Promise<HisStatus> {
    await sleep(SIMULATED_LATENCY_MS);
    return {
      connected: true,
      latencyMs: SIMULATED_LATENCY_MS,
      details:
        'Adaptador simulado: siempre responde OK. Configurar un adaptador real ' +
        '(implementando HisAdapter) para conectar el HIS del hospital.',
    };
  }

  async syncPatients(): Promise<{ synced: number; details: string }> {
    await sleep(SIMULATED_LATENCY_MS);
    const patient = await prisma.patient.upsert({
      where: { mrn: 'HIS-SIM-0001' },
      create: {
        mrn: 'HIS-SIM-0001',
        fullName: 'Paciente Simulado (HIS Mock)',
        dateOfBirth: new Date('1980-01-01'),
        sex: 'X',
        notes: 'Importado (simulado) desde MockHisAdapter — no es un paciente real.',
      },
      update: {
        notes: `Re-sincronizado (simulado) el ${new Date().toISOString()}.`,
      },
    });
    return { synced: 1, details: `Paciente demo sincronizado: ${patient.mrn}.` };
  }

  async syncPrescriptions(): Promise<{ synced: number; details: string }> {
    await sleep(SIMULATED_LATENCY_MS);
    const patient = await prisma.patient.findUnique({ where: { mrn: 'HIS-SIM-0001' } });
    if (!patient) {
      return { synced: 0, details: 'Ejecutar syncPatients primero (no hay paciente simulado aún).' };
    }
    const admin = await prisma.user.findFirst({ where: { role: { key: 'ADMIN' } } });
    if (!admin) {
      return { synced: 0, details: 'No hay un usuario administrador para atribuir la entrada.' };
    }
    const existing = await prisma.clinicalHistoryEntry.findFirst({
      where: { patientId: patient.id, title: 'Prescripción simulada (HIS Mock)' },
    });
    if (existing) {
      return { synced: 0, details: 'La prescripción simulada ya existe (no se duplica).' };
    }
    await prisma.clinicalHistoryEntry.create({
      data: {
        patientId: patient.id,
        entryType: 'PRESCRIPTION',
        title: 'Prescripción simulada (HIS Mock)',
        description: 'Entrada de ejemplo generada por MockHisAdapter.syncPrescriptions().',
        createdById: admin.id,
      },
    });
    return { synced: 1, details: 'Prescripción demo registrada en la historia clínica del paciente simulado.' };
  }

  async pushDispenseEvent(event: DispenseEvent): Promise<{ acknowledged: boolean }> {
    await sleep(SIMULATED_LATENCY_MS);
    // Un HIS real recibiría esto por su API (HL7 RDS, FHIR MedicationDispense, etc.).
    // eslint-disable-next-line no-console
    console.log('[MockHisAdapter] pushDispenseEvent (simulado):', event);
    return { acknowledged: true };
  }
}

export const hisAdapter: HisAdapter = new MockHisAdapter();
