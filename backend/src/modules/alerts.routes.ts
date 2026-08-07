import { Router } from 'express';
import { prisma } from '../db/prisma';
import { authenticate, requirePermission } from '../auth/middleware';
import { PERMISSIONS } from '../auth/rbac';
import { BUSINESS_CONFIG } from '../config/constants';
import { computeUsefulStock } from '../domain/inventory';
import { evaluateStockAlerts } from '../domain/alerts';
import { getDailyConsumption } from '../services/analytics';

export const alertsRouter = Router();

alertsRouter.use(authenticate);

// GET /alerts — evaluación en tiempo real de alertas sobre el catálogo.
alertsRouter.get(
  '/',
  requirePermission(PERMISSIONS.ALERTS_READ),
  async (_req, res) => {
    const items = await prisma.item.findMany({ include: { batches: true } });

    const alerts = [];
    for (const item of items) {
      const stock = computeUsefulStock(item.batches, BUSINESS_CONFIG.expiryRiskWindowDays);
      const history = await getDailyConsumption(
        item.id,
        BUSINESS_CONFIG.consumptionHistoryDays
      );
      const todayConsumption = history[history.length - 1] ?? 0;

      const candidates = evaluateStockAlerts({
        itemId: item.id,
        itemName: item.name,
        currentStock: stock.totalStock,
        minimumThreshold: item.minimumThreshold,
        daysToNearestExpiry: stock.daysToNearestExpiry,
        expiryWindowDays: BUSINESS_CONFIG.expiryAlertWindowDays,
        dailyConsumptionHistory: history.slice(0, -1),
        todayConsumption,
      });
      alerts.push(...candidates);
    }

    const order = { CRITICAL: 0, WARNING: 1, INFO: 2 } as const;
    alerts.sort((a, b) => order[a.severity] - order[b.severity]);
    return res.json({ alerts });
  }
);
