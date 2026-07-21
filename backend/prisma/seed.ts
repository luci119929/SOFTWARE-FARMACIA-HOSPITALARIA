// -----------------------------------------------------------------------------
// Seed de MedLine — datos de demostración para la Fase 1.
// Crea permisos, roles (con su matriz), usuarios demo, proveedores, ítems con
// lotes y un histórico de movimientos que alimenta el Motor de Compra y alertas.
// -----------------------------------------------------------------------------
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/passwords';
import {
  ALL_PERMISSIONS,
  ROLES,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  type RoleKey,
} from '../src/auth/rbac';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Medline2026!';

async function main() {
  console.log('Sembrando MedLine…');

  // 1. Permisos ---------------------------------------------------------------
  for (const p of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      create: { key: p.key, module: p.module, description: p.description },
      update: { module: p.module, description: p.description },
    });
  }
  const permByKey = new Map(
    (await prisma.permission.findMany()).map((p) => [p.key, p.id])
  );

  // 2. Roles + matriz de permisos --------------------------------------------
  const roleIdByKey = new Map<string, string>();
  for (const key of Object.values(ROLES)) {
    const role = await prisma.role.upsert({
      where: { key },
      create: { key, name: ROLE_LABELS[key as RoleKey] },
      update: { name: ROLE_LABELS[key as RoleKey] },
    });
    roleIdByKey.set(key, role.id);

    // Re-sincronizar permisos del rol.
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    for (const permKey of ROLE_PERMISSIONS[key as RoleKey]) {
      const permId = permByKey.get(permKey);
      if (permId) {
        await prisma.rolePermission.create({
          data: { roleId: role.id, permissionId: permId },
        });
      }
    }
  }

  // 3. Usuarios demo (uno por rol) -------------------------------------------
  const demoUsers: { email: string; fullName: string; role: RoleKey }[] = [
    { email: 'admin@medline.hospital', fullName: 'Ada Administradora', role: 'ADMIN' },
    { email: 'jefe@medline.hospital', fullName: 'Julio Jefe de Farmacia', role: 'PHARMACY_CHIEF' },
    { email: 'farmaceutico@medline.hospital', fullName: 'Fabiana Farmacéutica', role: 'PHARMACIST' },
    { email: 'deposito@medline.hospital', fullName: 'Diego Depósito', role: 'WAREHOUSE' },
    { email: 'compras@medline.hospital', fullName: 'Carmen Compras', role: 'PURCHASING' },
    { email: 'auditor@medline.hospital', fullName: 'Aurora Auditora', role: 'AUDITOR' },
  ];
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const userIdByRole = new Map<string, string>();
  for (const u of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: {
        email: u.email,
        fullName: u.fullName,
        passwordHash,
        roleId: roleIdByKey.get(u.role)!,
      },
      update: { fullName: u.fullName, roleId: roleIdByKey.get(u.role)! },
    });
    userIdByRole.set(u.role, user.id);
  }

  // 4. Proveedores ------------------------------------------------------------
  const supplierA = await prisma.supplier.upsert({
    where: { id: 'seed-supplier-a' },
    create: {
      id: 'seed-supplier-a',
      name: 'Droguería Central S.A.',
      contactEmail: 'ventas@drogueriacentral.com',
      leadTimeDays: 5,
    },
    update: {},
  });
  const supplierB = await prisma.supplier.upsert({
    where: { id: 'seed-supplier-b' },
    create: {
      id: 'seed-supplier-b',
      name: 'BioFrío Distribuciones',
      contactEmail: 'pedidos@biofrio.com',
      leadTimeDays: 10,
    },
    update: {},
  });

  // 5. Ítems + lotes ----------------------------------------------------------
  const today = new Date();
  const addDays = (d: number) => {
    const x = new Date(today);
    x.setDate(x.getDate() + d);
    return x;
  };

  type ItemSeed = {
    id: string;
    name: string;
    activeIngredient: string;
    manufacturer: string;
    presentation: string;
    concentration: string;
    therapeuticCategory: string;
    abc: string;
    ven: string;
    storage: string;
    minimumThreshold: number;
    maxStorageCapacity: number;
    moq: number;
    supplierId: string;
    batches: { batchNumber: string; expiresInDays: number; qty: number; location: string }[];
  };

  const items: ItemSeed[] = [
    {
      id: 'seed-item-adrenalina',
      name: 'Adrenalina 1mg/mL',
      activeIngredient: 'Epinefrina',
      manufacturer: 'Laboratorios Vitalis',
      presentation: 'Ampolla 1 mL',
      concentration: '1 mg/mL',
      therapeuticCategory: 'Emergencias / Reanimación',
      abc: 'A',
      ven: 'V',
      storage: 'REFRIGERATED',
      minimumThreshold: 50,
      maxStorageCapacity: 400,
      moq: 50,
      supplierId: supplierB.id,
      batches: [
        { batchNumber: 'ADR-2401', expiresInDays: 15, qty: 60, location: 'Heladera H1-A' },
        { batchNumber: 'ADR-2402', expiresInDays: 220, qty: 20, location: 'Heladera H1-A' },
      ],
    },
    {
      id: 'seed-item-insulina',
      name: 'Insulina NPH 100UI/mL',
      activeIngredient: 'Insulina humana isófana',
      manufacturer: 'Farma Endo',
      presentation: 'Vial 10 mL',
      concentration: '100 UI/mL',
      therapeuticCategory: 'Endocrinología',
      abc: 'A',
      ven: 'V',
      storage: 'REFRIGERATED',
      minimumThreshold: 40,
      maxStorageCapacity: 250,
      moq: 25,
      supplierId: supplierB.id,
      batches: [
        { batchNumber: 'INS-5501', expiresInDays: 90, qty: 45, location: 'Heladera H2-B' },
      ],
    },
    {
      id: 'seed-item-paracetamol',
      name: 'Paracetamol 500mg',
      activeIngredient: 'Paracetamol',
      manufacturer: 'Genéricos del Sur',
      presentation: 'Comprimido',
      concentration: '500 mg',
      therapeuticCategory: 'Analgésicos',
      abc: 'C',
      ven: 'E',
      storage: 'AMBIENT',
      minimumThreshold: 500,
      maxStorageCapacity: 5000,
      moq: 500,
      supplierId: supplierA.id,
      batches: [
        { batchNumber: 'PAR-1001', expiresInDays: 400, qty: 3200, location: 'Estante A-12' },
      ],
    },
    {
      id: 'seed-item-omeprazol',
      name: 'Omeprazol 40mg',
      activeIngredient: 'Omeprazol',
      manufacturer: 'Genéricos del Sur',
      presentation: 'Vial liofilizado',
      concentration: '40 mg',
      therapeuticCategory: 'Gastroenterología',
      abc: 'B',
      ven: 'E',
      storage: 'AMBIENT',
      minimumThreshold: 120,
      maxStorageCapacity: 1000,
      moq: 100,
      supplierId: supplierA.id,
      batches: [
        { batchNumber: 'OME-3001', expiresInDays: 25, qty: 80, location: 'Estante B-04' },
        { batchNumber: 'OME-3002', expiresInDays: 300, qty: 40, location: 'Estante B-04' },
      ],
    },
    {
      id: 'seed-item-vitaminac',
      name: 'Vitamina C 500mg',
      activeIngredient: 'Ácido ascórbico',
      manufacturer: 'NutriPharma',
      presentation: 'Comprimido efervescente',
      concentration: '500 mg',
      therapeuticCategory: 'Suplementos',
      abc: 'C',
      ven: 'N',
      storage: 'AMBIENT',
      minimumThreshold: 100,
      maxStorageCapacity: 2000,
      moq: 200,
      supplierId: supplierA.id,
      batches: [
        { batchNumber: 'VIT-9001', expiresInDays: 500, qty: 1500, location: 'Estante C-20' },
      ],
    },
  ];

  for (const it of items) {
    await prisma.item.upsert({
      where: { id: it.id },
      create: {
        id: it.id,
        name: it.name,
        activeIngredient: it.activeIngredient,
        manufacturer: it.manufacturer,
        presentation: it.presentation,
        concentration: it.concentration,
        therapeuticCategory: it.therapeuticCategory,
        abcClassification: it.abc,
        venClassification: it.ven,
        storageCondition: it.storage,
        minimumThreshold: it.minimumThreshold,
        maxStorageCapacity: it.maxStorageCapacity,
        moq: it.moq,
        supplierId: it.supplierId,
      },
      update: {},
    });
    for (const b of it.batches) {
      await prisma.batch.upsert({
        where: { itemId_batchNumber: { itemId: it.id, batchNumber: b.batchNumber } },
        create: {
          itemId: it.id,
          batchNumber: b.batchNumber,
          expirationDate: addDays(b.expiresInDays),
          availableQty: b.qty,
          physicalLocation: b.location,
        },
        update: { availableQty: b.qty, expirationDate: addDays(b.expiresInDays) },
      });
    }
  }

  // 6. Histórico de movimientos (consumo diario) -----------------------------
  // Solo sembramos si no hay movimientos previos, para no duplicar.
  const existingMovements = await prisma.movement.count();
  if (existingMovements === 0) {
    const pharmacistId = userIdByRole.get('PHARMACIST')!;
    // Perfiles de consumo diario aproximado por ítem (unidades/día).
    const consumptionProfile: Record<string, number> = {
      'seed-item-adrenalina': 6,
      'seed-item-insulina': 4,
      'seed-item-paracetamol': 90,
      'seed-item-omeprazol': 10,
      'seed-item-vitaminac': 25,
    };
    const movementData = [];
    for (let dayAgo = 29; dayAgo >= 0; dayAgo--) {
      const ts = addDays(-dayAgo);
      for (const [itemId, base] of Object.entries(consumptionProfile)) {
        // Variación pseudoaleatoria determinista.
        const jitter = ((dayAgo * 7 + itemId.length) % 5) - 2;
        const qty = Math.max(0, base + jitter);
        if (qty === 0) continue;
        movementData.push({
          timestamp: ts,
          userId: pharmacistId,
          itemId,
          quantityDelta: -qty,
          movementType: 'EXIT',
          sourceLocation: 'Farmacia Central',
          destinationLocation: 'Piso / Servicio',
          note: 'Consumo simulado (seed)',
        });
      }
    }
    await prisma.movement.createMany({ data: movementData });
    console.log(`  ${movementData.length} movimientos de consumo sembrados.`);
  }

  console.log('Seed completado.');
  console.log(`Usuarios demo (contraseña: ${DEMO_PASSWORD}):`);
  demoUsers.forEach((u) => console.log(`  - ${u.email} (${ROLE_LABELS[u.role]})`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
