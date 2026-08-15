-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mrn" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "dateOfBirth" DATETIME NOT NULL,
    "sex" TEXT NOT NULL,
    "allergies" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ClinicalHistoryEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "relatedItemId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClinicalHistoryEntry_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClinicalHistoryEntry_relatedItemId_fkey" FOREIGN KEY ("relatedItemId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ClinicalHistoryEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClinicalHistoryEntry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClinicalHistoryVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "entryType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "relatedItemId" TEXT,
    "changedById" TEXT NOT NULL,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClinicalHistoryVersion_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ClinicalHistoryEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClinicalHistoryVersion_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Patient_mrn_key" ON "Patient"("mrn");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalHistoryVersion_entryId_version_key" ON "ClinicalHistoryVersion"("entryId", "version");
