import { execSync } from 'node:child_process';
import path from 'node:path';

// Deja la base de datos en el estado exacto del seed antes de correr la suite,
// para que las aserciones (conteos, nombres de ítems demo) sean deterministas.
// Requiere backend/.env ya configurado (ver README: `cp .env.example .env`).
export default function globalSetup() {
  const repoRoot = path.resolve(__dirname, '..');
  execSync('npm run db:reset --workspace backend', { cwd: repoRoot, stdio: 'inherit' });
}
