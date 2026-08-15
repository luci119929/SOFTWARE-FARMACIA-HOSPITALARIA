import type { ComponentType } from 'react';
import { P } from './permissions';
import {
  IconDashboard,
  IconInventory,
  IconMovements,
  IconAlert,
  IconEngine,
  IconTruck,
  IconAudit,
  IconUsers,
  IconReturn,
  IconClipboard,
  IconPlug,
} from '../components/icons';

export interface NavModule {
  key: string;
  path: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
  /** El módulo se muestra si el usuario tiene AL MENOS UNO de estos permisos. */
  anyOf: string[];
  /** El dashboard es visible para todos los usuarios autenticados. */
  always?: boolean;
}

// Catálogo de módulos (sección 13). El menú lateral se renderiza a partir de
// esta lista, filtrando por los permisos del usuario. Los módulos no permitidos
// se omiten por completo del DOM (no se renderiza su ruta ni su enlace).
export const NAV_MODULES: NavModule[] = [
  {
    key: 'dashboard',
    path: '/',
    label: 'Panel',
    icon: IconDashboard,
    anyOf: [],
    always: true,
  },
  {
    key: 'inventory',
    path: '/inventario',
    label: 'Inventario',
    icon: IconInventory,
    anyOf: [P.INVENTORY_READ],
  },
  {
    key: 'movements',
    path: '/movimientos',
    label: 'Movimientos',
    icon: IconMovements,
    anyOf: [P.MOVEMENTS_READ, P.MOVEMENTS_CREATE],
  },
  {
    key: 'alerts',
    path: '/alertas',
    label: 'Alertas',
    icon: IconAlert,
    anyOf: [P.ALERTS_READ],
  },
  {
    key: 'purchasing',
    path: '/motor-compra',
    label: 'Motor de Compra',
    icon: IconEngine,
    anyOf: [P.PURCHASING_READ, P.PURCHASING_MANAGE, P.PURCHASING_APPROVE, P.INVENTORY_SUPPLY],
  },
  {
    key: 'returns',
    path: '/devoluciones',
    label: 'Devoluciones',
    icon: IconReturn,
    anyOf: [P.RETURNS_READ],
  },
  {
    key: 'suppliers',
    path: '/proveedores',
    label: 'Proveedores',
    icon: IconTruck,
    anyOf: [P.SUPPLIERS_READ, P.SUPPLIERS_MANAGE],
  },
  {
    key: 'clinical-history',
    path: '/historia-clinica',
    label: 'Historia Clínica',
    icon: IconClipboard,
    anyOf: [P.PATIENTS_READ, P.CLINICAL_HISTORY_READ],
  },
  {
    key: 'audit',
    path: '/auditoria',
    label: 'Auditoría',
    icon: IconAudit,
    anyOf: [P.AUDIT_READ],
  },
  {
    key: 'users',
    path: '/usuarios',
    label: 'Usuarios',
    icon: IconUsers,
    anyOf: [P.USERS_READ],
  },
  {
    key: 'integrations',
    path: '/integraciones',
    label: 'Integraciones',
    icon: IconPlug,
    anyOf: [P.INTEGRATIONS_MANAGE],
  },
];

export function visibleModules(permissions: string[]): NavModule[] {
  return NAV_MODULES.filter(
    (m) => m.always || m.anyOf.some((p) => permissions.includes(p))
  );
}
