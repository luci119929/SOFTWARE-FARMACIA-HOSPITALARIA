import { PrismaClient } from '@prisma/client';

// Instancia única compartida (evita agotar conexiones en desarrollo con HMR).
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
