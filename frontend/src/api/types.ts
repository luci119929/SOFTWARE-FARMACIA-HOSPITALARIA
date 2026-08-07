// Tipos compartidos del contrato de la API.

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: { key: string; name: string };
  permissions: string[];
}

export interface UsefulStock {
  totalStock: number;
  usefulStock: number;
  atRiskStock: number;
  nearestExpiry: string | null;
  daysToNearestExpiry: number | null;
}

export interface Priority {
  score: number;
  band: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface InventoryItem {
  id: string;
  name: string;
  activeIngredient: string;
  manufacturer: string;
  presentation: string;
  concentration: string;
  therapeuticCategory: string;
  abcClassification: string;
  venClassification: string;
  storageCondition: string;
  minimumThreshold: number;
  supplier: { id: string; name: string } | null;
  stock: UsefulStock;
  priority: Priority;
  batchCount: number;
}

export interface Recommendation {
  itemId: string;
  itemName: string;
  triggered: boolean;
  averageDailyConsumption: number;
  safetyStock: number;
  reorderPoint: number;
  usefulStock: number;
  recommendedQty: number;
  delivery: { mainDelivery: number; scheduledDeliveries: number[] };
  rationale: string;
  supplierId: string | null;
}

export interface PurchaseOrder {
  id: string;
  code: string;
  status: string;
  supplier: { id: string; name: string } | null;
  createdBy: { id: string; fullName: string } | null;
  approvedBy: { id: string; fullName: string } | null;
  createdAt: string;
  approvedAt: string | null;
  lines: {
    id: string;
    item: { id: string; name: string };
    recommendedQty: number;
    orderedQty: number;
    rationale: string | null;
  }[];
}

export interface Movement {
  id: string;
  timestamp: string;
  quantityDelta: number;
  movementType: string;
  sourceLocation: string | null;
  destinationLocation: string | null;
  item: { id: string; name: string };
  user: { id: string; fullName: string };
}

export interface AlertItem {
  itemId: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  actionType: string;
  module: string;
  entity: string | null;
  entityId: string | null;
  previousValue: string | null;
  newValue: string | null;
  user: { id: string; fullName: string; email: string } | null;
}

export interface UserRow {
  id: string;
  email: string;
  fullName: string;
  role: { key: string; name: string };
  isActive: boolean;
  lastLoginAt: string | null;
}
