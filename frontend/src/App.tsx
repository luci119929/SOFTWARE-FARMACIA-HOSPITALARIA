import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { InventoryPage } from './pages/InventoryPage';
import { MovementsPage } from './pages/MovementsPage';
import { AlertsPage } from './pages/AlertsPage';
import { PurchaseEnginePage } from './pages/PurchaseEnginePage';
import { SuppliersPage } from './pages/SuppliersPage';
import { ReturnsPage } from './pages/ReturnsPage';
import { AuditPage } from './pages/AuditPage';
import { UsersPage } from './pages/UsersPage';
import { P } from './rbac/permissions';
import type { ReactElement } from 'react';

// Ruta protegida: exige autenticación y (opcionalmente) permisos.
// Refuerza en cliente la política que el backend ya impone (defensa en
// profundidad). Los módulos sin permiso ni siquiera se enlazan en el menú.
function Guard({ anyOf, children }: { anyOf?: string[]; children: ReactElement }) {
  const { user, can } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (anyOf && anyOf.length > 0 && !can(...anyOf)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
        <div className="muted">Cargando MedLine…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/" element={<DashboardPage />} />
        <Route
          path="/inventario"
          element={
            <Guard anyOf={[P.INVENTORY_READ]}>
              <InventoryPage />
            </Guard>
          }
        />
        <Route
          path="/movimientos"
          element={
            <Guard anyOf={[P.MOVEMENTS_READ, P.MOVEMENTS_CREATE]}>
              <MovementsPage />
            </Guard>
          }
        />
        <Route
          path="/alertas"
          element={
            <Guard anyOf={[P.ALERTS_READ]}>
              <AlertsPage />
            </Guard>
          }
        />
        <Route
          path="/motor-compra"
          element={
            <Guard anyOf={[P.PURCHASING_READ, P.PURCHASING_MANAGE, P.PURCHASING_APPROVE, P.INVENTORY_SUPPLY]}>
              <PurchaseEnginePage />
            </Guard>
          }
        />
        <Route
          path="/devoluciones"
          element={
            <Guard anyOf={[P.RETURNS_READ]}>
              <ReturnsPage />
            </Guard>
          }
        />
        <Route
          path="/proveedores"
          element={
            <Guard anyOf={[P.SUPPLIERS_READ, P.SUPPLIERS_MANAGE]}>
              <SuppliersPage />
            </Guard>
          }
        />
        <Route
          path="/auditoria"
          element={
            <Guard anyOf={[P.AUDIT_READ]}>
              <AuditPage />
            </Guard>
          }
        />
        <Route
          path="/usuarios"
          element={
            <Guard anyOf={[P.USERS_READ]}>
              <UsersPage />
            </Guard>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
