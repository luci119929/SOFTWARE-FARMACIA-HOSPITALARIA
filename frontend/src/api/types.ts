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

export type PoStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrder {
  id: string;
  code: string;
  status: PoStatus;
  supplier: { id: string; name: string } | null;
  createdBy: { id: string; fullName: string } | null;
  approvedBy: { id: string; fullName: string } | null;
  rejectedBy: { id: string; fullName: string } | null;
  rejectionReason: string | null;
  createdAt: string;
  approvedAt: string | null;
  receivedAt: string | null;
  lines: {
    id: string;
    item: { id: string; name: string };
    recommendedQty: number;
    orderedQty: number;
    receivedQty: number;
    rationale: string | null;
  }[];
}

export interface Supplier {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  taxId: string | null;
  paymentTerms: string | null;
  notes: string | null;
  leadTimeDays: number;
  isActive: boolean;
}

export interface SupplierPurchaseHistory {
  supplierId: string;
  totalOrders: number;
  totalUnitsOrdered: number;
  countByStatus: Record<string, number>;
  nominalLeadTimeDays: number;
  averageActualLeadTimeDays: number | null;
}

export type ReturnReason = 'EXPIRED' | 'DAMAGED' | 'UNUSED' | 'WRONG_DISPENSE' | 'RECALL' | 'OTHER';
export type ReturnDisposition = 'RESTOCK' | 'DISCARD' | 'RETURN_TO_SUPPLIER';
export type ReturnStatus = 'PENDING' | 'PROCESSED' | 'REJECTED';

export interface StockReturn {
  id: string;
  code: string;
  quantity: number;
  reason: ReturnReason;
  disposition: ReturnDisposition | null;
  status: ReturnStatus;
  sourceLocation: string | null;
  note: string | null;
  createdAt: string;
  processedAt: string | null;
  item: { id: string; name: string };
  batch: { id: string; batchNumber: string } | null;
  requestedBy: { id: string; fullName: string } | null;
  processedBy: { id: string; fullName: string } | null;
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

export type PatientSex = 'M' | 'F' | 'X';

export interface Patient {
  id: string;
  mrn: string;
  fullName: string;
  dateOfBirth: string;
  sex: PatientSex;
  allergies: string | null;
  notes: string | null;
  entries?: ClinicalHistoryEntry[];
}

export type ClinicalEntryType = 'DIAGNOSIS' | 'PRESCRIPTION' | 'NOTE' | 'ALLERGY_UPDATE';

export interface ClinicalHistoryEntry {
  id: string;
  patientId: string;
  entryType: ClinicalEntryType;
  title: string;
  description: string;
  relatedItem: { id: string; name: string } | null;
  version: number;
  createdBy: { id: string; fullName: string } | null;
  updatedBy: { id: string; fullName: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicalHistoryVersion {
  id: string;
  version: number;
  entryType: ClinicalEntryType;
  title: string;
  description: string;
  changedBy: { id: string; fullName: string };
  changedAt: string;
}

export interface UserRow {
  id: string;
  email: string;
  fullName: string;
  role: { key: string; name: string };
  isActive: boolean;
  lastLoginAt: string | null;
}
