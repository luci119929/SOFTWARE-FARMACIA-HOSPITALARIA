# MedLine — Middleware de Gestión de Farmacia Hospitalaria

**Fase 1: Arquitectura Base y Prototipo.**

MedLine es un middleware para centralizar, analizar y optimizar la
administración de medicamentos en farmacias hospitalarias. Esta primera fase
establece una **base estructural sólida, segura y escalable**: arquitectura del
sistema, esquemas de base de datos, control de acceso basado en roles (RBAC),
enrutamiento dinámico y prototipos de las pantallas centrales (Inventario, Motor
de Compra Inteligente y Registro de Auditoría).

> El objetivo de esta etapa **no** es el producto final, sino un cimiento modular
> sobre el que iterar e incorporar funcionalidades de IA más complejas en fases
> posteriores. Ver [`ARCHITECTURE.md`](./ARCHITECTURE.md) para el detalle.

---

## Arquitectura del repositorio (monorepo)

```
medline/
├── backend/     API REST (Node + Express + TypeScript + Prisma)
│   ├── prisma/  Esquema de datos y seed de demostración
│   └── src/
│       ├── auth/      RBAC, JWT, hashing, middleware de permisos
│       ├── domain/    Motores: clasificación, inventario/FEFO, compra, alertas
│       ├── modules/   Rutas HTTP por módulo
│       ├── services/  Auditoría inmutable, analítica de consumo
│       └── db/        Cliente Prisma
└── frontend/    SPA (React + Vite + TypeScript)
    └── src/
        ├── auth/        Contexto de sesión
        ├── theme/       Modo claro/oscuro persistente
        ├── rbac/        Catálogo de navegación y permisos (UI)
        ├── components/  Layout dinámico, iconografía propia, UI
        └── pages/       Login, Panel, Inventario, Motor de Compra, etc.
```

## Stack

| Capa      | Tecnología                                             |
| --------- | ------------------------------------------------------ |
| Backend   | Node 18+, Express, TypeScript, Prisma ORM              |
| Base datos| SQLite (desarrollo) · PostgreSQL (producción)          |
| Auth      | JWT + bcrypt, permisos por rol (RBAC)                  |
| Frontend  | React 18, Vite, React Router, CSS propio (sin UI kits) |

## Puesta en marcha

Requisitos: Node.js ≥ 18.

```bash
# 1. Instalar dependencias (workspaces)
npm install

# 2. Backend: configurar entorno y base de datos + seed
cd backend
cp .env.example .env
npm run db:setup          # migra la base y siembra datos de demo
npm run dev               # API en http://localhost:4000

# 3. Frontend (en otra terminal)
cd frontend
npm run dev               # SPA en http://localhost:5173
```

El frontend hace proxy de `/api` al backend, así que basta con abrir
`http://localhost:5173`.

## Usuarios de demostración

Todos con la contraseña **`Medline2026!`**. Cada rol ve **solo** los módulos que
sus permisos autorizan (la navegación se renderiza dinámicamente).

| Rol                | Correo                          |
| ------------------ | ------------------------------- |
| Administrador      | `admin@medline.hospital`        |
| Jefe de Farmacia   | `jefe@medline.hospital`         |
| Farmacéutico       | `farmaceutico@medline.hospital` |
| Depósito/Inventario| `deposito@medline.hospital`     |
| Compras            | `compras@medline.hospital`      |
| Auditor            | `auditor@medline.hospital`      |

## Scripts útiles

```bash
npm run typecheck              # typecheck de backend + frontend
npm run build                  # build de producción de ambos
npm run db:seed --workspace backend   # re-sembrar datos de demo
npm run db:reset --workspace backend  # reiniciar la base (¡borra datos!)
```

## Verificación funcional realizada

- ✅ Login + emisión de JWT con el set de permisos del rol.
- ✅ RBAC: rutas protegidas devuelven `401` sin token y `403` sin permiso.
- ✅ Motor de Compra: cálculo de CDP, SS, Punto de Pedido y cantidad recomendada
  a partir del **Stock Útil** (excluyendo lo próximo a vencer).
- ✅ Consolidación antiduplicidad de órdenes de compra (sección 9.3).
- ✅ Navegación dinámica por rol (módulos no permitidos omitidos del DOM).
- ✅ Modo claro / oscuro persistente.

## Estado y próximos pasos

- **Fase 1** cubrió la base estructural: RBAC, inventario/FEFO, Motor de Compra,
  auditoría y las pantallas centrales.
- **Fase 2 (backend)** agregó devoluciones/logística inversa (sección 11),
  el flujo de aprobación formal de órdenes de compra
  (`DRAFT → SUBMITTED → APPROVED/REJECTED → RECEIVED`, con `CANCELLED` desde
  cualquier estado no terminal), recepción física de mercadería (crea/actualiza
  lotes y movimientos `ENTRY` reales) y gestión completa de proveedores
  (CRUD + historial de compras por proveedor).
- **Fase 3 (frontend)** puso al día la SPA con todo lo anterior: pantalla de
  **Devoluciones** (registrar, procesar con disposición RESTOCK/DISCARD/
  RETURN_TO_SUPPLIER, o rechazar), **Proveedores** con alta/edición/baja e
  historial de compras por proveedor, y el **Motor de Compra** ahora soporta
  el ciclo de vida completo de una orden (enviar a aprobación, aprobar,
  rechazar con motivo, registrar recepción parcial/total por lote). También se
  corrigió el gate de navegación de "Motor de Compra" para incluir al rol de
  Depósito (`inventory:supply`), que antes no podía llegar a la pantalla desde
  la que recibe mercadería.

Las siguientes fases previstas incluyen: integración interhospitalaria
(sección 10), integración de cadena de frío por hardware, EOQ con costos
(modelo de Wilson) y capas de IA para pronóstico de demanda. El diseño modular
permite incorporarlas sin reescribir el núcleo.
