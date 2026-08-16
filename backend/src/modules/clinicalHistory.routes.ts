import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { authenticate, requirePermission } from '../auth/middleware';
import { PERMISSIONS } from '../auth/rbac';
import { CLINICAL_ENTRY_TYPES, PATIENT_SEX } from '../domain/enums';
import { recordAudit, auditContext } from '../services/audit';
import { broadcast } from '../ws/server';

export const patientsRouter = Router();

patientsRouter.use(authenticate);

const userSelect = { select: { id: true, fullName: true } } as const;
const entryInclude = {
  relatedItem: { select: { id: true, name: true } },
  createdBy: userSelect,
  updatedBy: userSelect,
} as const;

// GET /patients — listado, con búsqueda opcional por nombre o Nº de historia clínica.
patientsRouter.get(
  '/',
  requirePermission(PERMISSIONS.PATIENTS_READ),
  async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : undefined;
    const patients = await prisma.patient.findMany({
      where: q
        ? { OR: [{ fullName: { contains: q } }, { mrn: { contains: q } }] }
        : undefined,
      orderBy: { fullName: 'asc' },
      take: 200,
    });
    return res.json({ patients });
  }
);

// GET /patients/:id — detalle con la historia clínica completa (entradas actuales).
patientsRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.PATIENTS_READ),
  async (req, res) => {
    const patient = await prisma.patient.findUnique({
      where: { id: req.params.id },
      include: {
        entries: { include: entryInclude, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });
    return res.json({ patient });
  }
);

const patientSchema = z.object({
  mrn: z.string().min(1),
  fullName: z.string().min(1),
  dateOfBirth: z.coerce.date(),
  sex: z.enum(PATIENT_SEX),
  weightKg: z.number().positive().nullable().optional(),
  heightM: z.number().positive().nullable().optional(),
  allergies: z.string().optional(),
  notes: z.string().optional(),
});

// POST /patients — crear paciente.
patientsRouter.post(
  '/',
  requirePermission(PERMISSIONS.PATIENTS_MANAGE),
  async (req, res) => {
    const parsed = patientSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
    }
    const existing = await prisma.patient.findUnique({ where: { mrn: parsed.data.mrn } });
    if (existing) return res.status(409).json({ error: 'Ya existe un paciente con ese Nº de historia clínica' });

    const patient = await prisma.patient.create({ data: parsed.data });
    await recordAudit({
      ...auditContext(req),
      actionType: 'CREATE',
      module: 'patients',
      entity: 'Patient',
      entityId: patient.id,
      newValue: patient,
    });
    return res.status(201).json({ patient });
  }
);

// PATCH /patients/:id — actualizar datos del paciente.
patientsRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.PATIENTS_MANAGE),
  async (req, res) => {
    const parsed = patientSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
    }
    const before = await prisma.patient.findUnique({ where: { id: req.params.id } });
    if (!before) return res.status(404).json({ error: 'Paciente no encontrado' });

    const patient = await prisma.patient.update({ where: { id: req.params.id }, data: parsed.data });
    await recordAudit({
      ...auditContext(req),
      actionType: 'UPDATE',
      module: 'patients',
      entity: 'Patient',
      entityId: patient.id,
      previousValue: before,
      newValue: parsed.data,
    });
    return res.json({ patient });
  }
);

const entrySchema = z.object({
  entryType: z.enum(CLINICAL_ENTRY_TYPES),
  title: z.string().min(1),
  description: z.string().min(1),
  relatedItemId: z.string().min(1).nullable().optional(),
  // Sólo tienen sentido cuando entryType=PRESCRIPTION.
  dose: z.string().nullable().optional(),
  frequency: z.string().nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
});

// POST /patients/:id/entries — registrar una entrada de historia clínica.
patientsRouter.post(
  '/:id/entries',
  requirePermission(PERMISSIONS.CLINICAL_HISTORY_CREATE),
  async (req, res) => {
    const parsed = entrySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
    }
    const patient = await prisma.patient.findUnique({ where: { id: req.params.id } });
    if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });

    if (parsed.data.relatedItemId) {
      const item = await prisma.item.findUnique({ where: { id: parsed.data.relatedItemId } });
      if (!item) return res.status(400).json({ error: 'Medicamento relacionado inválido' });
    }

    const entry = await prisma.clinicalHistoryEntry.create({
      data: { ...parsed.data, patientId: patient.id, createdById: req.auth!.userId },
      include: entryInclude,
    });
    await recordAudit({
      ...auditContext(req),
      actionType: 'CREATE',
      module: 'clinical_history',
      entity: 'ClinicalHistoryEntry',
      entityId: entry.id,
      newValue: entry,
    });
    broadcast('clinical_history.entry_created', PERMISSIONS.CLINICAL_HISTORY_READ, {
      patientId: patient.id,
      patientName: patient.fullName,
      entryTitle: entry.title,
    });
    return res.status(201).json({ entry });
  }
);

// PATCH /patients/entries/:entryId — editar una entrada, versionando el
// estado anterior antes de sobreescribir (ver ClinicalHistoryVersion).
patientsRouter.patch(
  '/entries/:entryId',
  requirePermission(PERMISSIONS.CLINICAL_HISTORY_UPDATE),
  async (req, res) => {
    const parsed = entrySchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
    }
    const before = await prisma.clinicalHistoryEntry.findUnique({ where: { id: req.params.entryId } });
    if (!before) return res.status(404).json({ error: 'Entrada no encontrada' });

    if (parsed.data.relatedItemId) {
      const item = await prisma.item.findUnique({ where: { id: parsed.data.relatedItemId } });
      if (!item) return res.status(400).json({ error: 'Medicamento relacionado inválido' });
    }

    const entry = await prisma.$transaction(async (tx) => {
      await tx.clinicalHistoryVersion.create({
        data: {
          entryId: before.id,
          version: before.version,
          entryType: before.entryType,
          title: before.title,
          description: before.description,
          relatedItemId: before.relatedItemId,
          dose: before.dose,
          frequency: before.frequency,
          startDate: before.startDate,
          changedById: req.auth!.userId,
        },
      });
      return tx.clinicalHistoryEntry.update({
        where: { id: before.id },
        data: { ...parsed.data, version: before.version + 1, updatedById: req.auth!.userId },
        include: entryInclude,
      });
    });

    await recordAudit({
      ...auditContext(req),
      actionType: 'UPDATE',
      module: 'clinical_history',
      entity: 'ClinicalHistoryEntry',
      entityId: entry.id,
      previousValue: { version: before.version, title: before.title, description: before.description },
      newValue: { version: entry.version, title: entry.title, description: entry.description },
    });
    broadcast('clinical_history.entry_updated', PERMISSIONS.CLINICAL_HISTORY_READ, {
      patientId: entry.patientId,
      entryTitle: entry.title,
      version: entry.version,
    });
    return res.json({ entry });
  }
);

// GET /patients/entries/:entryId/versions — historial completo de versiones previas.
patientsRouter.get(
  '/entries/:entryId/versions',
  requirePermission(PERMISSIONS.CLINICAL_HISTORY_READ),
  async (req, res) => {
    const entry = await prisma.clinicalHistoryEntry.findUnique({ where: { id: req.params.entryId } });
    if (!entry) return res.status(404).json({ error: 'Entrada no encontrada' });

    const versions = await prisma.clinicalHistoryVersion.findMany({
      where: { entryId: req.params.entryId },
      include: { changedBy: userSelect },
      orderBy: { version: 'desc' },
    });
    return res.json({ currentVersion: entry.version, versions });
  }
);
