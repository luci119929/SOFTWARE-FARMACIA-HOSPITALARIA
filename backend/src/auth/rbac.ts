// -----------------------------------------------------------------------------
// RBAC — Fuente de verdad de Roles, Permisos y la Matriz Rol → Permiso.
// Corresponde a las secciones 2 y 3 de la especificación.
// El seed de la base de datos se genera a partir de estas definiciones y el
// frontend renderiza la navegación a partir del set de permisos del usuario.
// -----------------------------------------------------------------------------

export const ROLES = {
  ADMIN: 'ADMIN',
  PHARMACY_CHIEF: 'PHARMACY_CHIEF',
  PHARMACIST: 'PHARMACIST',
  WAREHOUSE: 'WAREHOUSE',
  PURCHASING: 'PURCHASING',
  AUDITOR: 'AUDITOR',
} as const;

export type RoleKey = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<RoleKey, string> = {
  ADMIN: 'Administrador',
  PHARMACY_CHIEF: 'Jefe de Farmacia',
  PHARMACIST: 'Farmacéutico',
  WAREHOUSE: 'Personal de Depósito / Inventario',
  PURCHASING: 'Compras / Abastecimiento',
  AUDITOR: 'Auditor',
};

// Permisos con formato "modulo:accion".
export const PERMISSIONS = {
  // Sistema / administración
  SYSTEM_CONFIGURE: 'system:configure',
  INTEGRATIONS_MANAGE: 'integrations:manage',
  // Usuarios y permisos
  USERS_CREATE: 'users:create',
  USERS_READ: 'users:read',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',
  PERMISSIONS_ASSIGN: 'permissions:assign',
  // Inventario
  INVENTORY_READ: 'inventory:read',
  INVENTORY_MANAGE: 'inventory:manage',
  INVENTORY_SUPPLY: 'inventory:supply',
  LOCATIONS_MANAGE: 'locations:manage',
  // Movimientos
  MOVEMENTS_CREATE: 'movements:create',
  MOVEMENTS_READ: 'movements:read',
  // Alertas
  ALERTS_READ: 'alerts:read',
  // Análisis
  ANALYTICS_READ: 'analytics:read',
  // Motor de compra / abastecimiento
  PURCHASING_READ: 'purchasing:read',
  PURCHASING_MANAGE: 'purchasing:manage',
  PURCHASING_APPROVE: 'purchasing:approve',
  SUPPLIERS_MANAGE: 'suppliers:manage',
  // Auditoría (solo lectura)
  AUDIT_READ: 'audit:read',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  'system:configure': 'Configuración global del sistema',
  'integrations:manage': 'Gestión de integraciones externas (API / CSV)',
  'users:create': 'Crear usuarios',
  'users:read': 'Consultar usuarios',
  'users:update': 'Actualizar usuarios',
  'users:delete': 'Eliminar usuarios',
  'permissions:assign': 'Asignar roles y permisos',
  'inventory:read': 'Consultar inventario',
  'inventory:manage': 'Gestión operativa del inventario',
  'inventory:supply': 'Gestión de abastecimiento / stock',
  'locations:manage': 'Mapeo de ubicaciones físicas',
  'movements:create': 'Registrar movimientos de stock',
  'movements:read': 'Consultar el libro de movimientos',
  'alerts:read': 'Monitorear alertas',
  'analytics:read': 'Ver análisis y reportes',
  'purchasing:read': 'Revisar el Motor de Compra',
  'purchasing:manage': 'Gestionar órdenes de compra',
  'purchasing:approve': 'Aprobar órdenes de compra',
  'suppliers:manage': 'Gestionar proveedores',
  'audit:read': 'Acceso de solo lectura al registro de auditoría',
};

// Matriz Rol → Permisos (sección 3).
export const ROLE_PERMISSIONS: Record<RoleKey, PermissionKey[]> = {
  ADMIN: [
    PERMISSIONS.SYSTEM_CONFIGURE,
    PERMISSIONS.INTEGRATIONS_MANAGE,
    PERMISSIONS.USERS_CREATE,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.USERS_DELETE,
    PERMISSIONS.PERMISSIONS_ASSIGN,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.ANALYTICS_READ,
  ],
  PHARMACY_CHIEF: [
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_SUPPLY,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.MOVEMENTS_READ,
    PERMISSIONS.ALERTS_READ,
    PERMISSIONS.PURCHASING_READ,
    PERMISSIONS.PURCHASING_APPROVE,
  ],
  PHARMACIST: [
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_MANAGE,
    PERMISSIONS.MOVEMENTS_CREATE,
    PERMISSIONS.MOVEMENTS_READ,
    PERMISSIONS.ALERTS_READ,
  ],
  WAREHOUSE: [
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.MOVEMENTS_CREATE,
    PERMISSIONS.MOVEMENTS_READ,
    PERMISSIONS.LOCATIONS_MANAGE,
  ],
  PURCHASING: [
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.PURCHASING_READ,
    PERMISSIONS.PURCHASING_MANAGE,
    PERMISSIONS.SUPPLIERS_MANAGE,
    PERMISSIONS.ANALYTICS_READ,
  ],
  AUDITOR: [
    // Estrictamente solo lectura
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.MOVEMENTS_READ,
  ],
};

// Todos los permisos con su módulo (para el seed de la tabla Permission).
export const ALL_PERMISSIONS: { key: PermissionKey; module: string; description: string }[] =
  Object.values(PERMISSIONS).map((key) => ({
    key,
    module: key.split(':')[0],
    description: PERMISSION_DESCRIPTIONS[key],
  }));
