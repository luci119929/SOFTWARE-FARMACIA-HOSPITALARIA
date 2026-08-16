-- AlterTable
ALTER TABLE "ClinicalHistoryEntry" ADD COLUMN "dose" TEXT;
ALTER TABLE "ClinicalHistoryEntry" ADD COLUMN "frequency" TEXT;
ALTER TABLE "ClinicalHistoryEntry" ADD COLUMN "startDate" DATETIME;

-- AlterTable
ALTER TABLE "ClinicalHistoryVersion" ADD COLUMN "dose" TEXT;
ALTER TABLE "ClinicalHistoryVersion" ADD COLUMN "frequency" TEXT;
ALTER TABLE "ClinicalHistoryVersion" ADD COLUMN "startDate" DATETIME;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN "heightM" REAL;
ALTER TABLE "Patient" ADD COLUMN "weightKg" REAL;
