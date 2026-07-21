import type { NextFunction, Request, Response } from 'express';
import { verifyToken, type TokenPayload } from './jwt';

// Extiende Request con el usuario autenticado.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: TokenPayload;
    }
  }
}

/** Verifica el JWT del header Authorization: Bearer <token>. */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  const token = header.slice('Bearer '.length);
  try {
    req.auth = verifyToken(token);
    return next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

/** Exige que el usuario tenga AL MENOS UNO de los permisos indicados. */
export function requirePermission(...anyOf: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    const granted = req.auth.permissions ?? [];
    const ok = anyOf.some((p) => granted.includes(p));
    if (!ok) {
      return res.status(403).json({
        error: 'Permisos insuficientes',
        required: anyOf,
      });
    }
    return next();
  };
}
