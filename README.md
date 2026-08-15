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
│       ├── auth/          RBAC, JWT, hashing, middleware de permisos
│       ├── domain/        Motores: clasificación, inventario/FEFO, compra, alertas
│       ├── modules/       Rutas HTTP por módulo
│       ├── services/      Auditoría inmutable, analítica de consumo
│       ├── ws/            Servidor WebSocket (notificaciones en tiempo real)
│       ├── integrations/  Adaptador HIS (hoy sólo MockHisAdapter)
│       └── db/            Cliente Prisma
├── frontend/    SPA (React + Vite + TypeScript)
│   └── src/
│       ├── auth/        Contexto de sesión
│       ├── theme/       Modo claro/oscuro persistente
│       ├── rbac/        Catálogo de navegación y permisos (UI)
│       ├── components/  Layout dinámico, iconografía propia, UI
│       ├── hooks/       Hooks reutilizables (debounce, notificaciones en tiempo real)
│       ├── utils/       Export a PDF (jsPDF)
│       └── pages/       Login, Panel, Inventario, Motor de Compra, Historia Clínica, etc.
└── e2e/         Tests end-to-end (Playwright) sobre los flujos críticos
```

## Stack

| Capa      | Tecnología                                                        |
| --------- | ------------------------------------------------------------------ |
| Backend   | Node 18+, Express, TypeScript, Prisma ORM                         |
| Base datos| SQLite (desarrollo) · PostgreSQL (producción)                     |
| Auth      | JWT + bcrypt, permisos por rol (RBAC)                              |
| Frontend  | React 18, Vite, React Router, CSS propio (sin UI kits), Recharts, jsPDF |
| Tiempo real | WebSocket (`ws`) sobre el mismo JWT que la API REST              |
| Docs API  | OpenAPI 3 servido con Swagger UI (`/api/docs`)                    |
| Tests     | Vitest (unitarios de dominio) · Playwright (E2E de flujos críticos)|

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
`http://localhost:5173`. La documentación interactiva de la API (Swagger UI)
queda disponible en `http://localhost:4000/api/docs` (spec cruda en
`/api/docs.json`).

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
npm run test                   # tests unitarios del dominio (Vitest, backend)
npm run db:seed --workspace backend   # re-sembrar datos de demo
npm run db:reset --workspace backend  # reiniciar la base (¡borra datos!)
```

### Tests end-to-end (Playwright)

```bash
cd e2e
npm install
npx playwright test            # resetea+siembra la DB y levanta ambos servidores
```

La suite (8 specs) cubre RBAC de navegación (incluida la regresión de Depósito
viendo Motor de Compra), el ciclo completo de una orden de compra
(`DRAFT → SUBMITTED → APPROVED → RECEIVED` a través de los tres roles que lo
autorizan), el flujo de devoluciones (registrar → procesar), historia clínica
(crear paciente → registrar entrada → editarla → confirmar que la versión
anterior quedó archivada) y notificaciones en tiempo real de punta a punta
(dos usuarios en dos contextos de navegador separados: uno registra un
movimiento, el otro lo recibe en vivo por WebSocket sin recargar). Requiere
`backend/.env` ya configurado (ver arriba) y usa el Chromium preinstalado del
entorno remoto (`PLAYWRIGHT_CHROMIUM_PATH` para sobreescribirlo en otro
entorno).

## Verificación funcional realizada

- ✅ Login + emisión de JWT con el set de permisos del rol.
- ✅ RBAC: rutas protegidas devuelven `401` sin token y `403` sin permiso.
- ✅ Motor de Compra: cálculo de CDP, SS, Punto de Pedido y cantidad recomendada
  a partir del **Stock Útil** (excluyendo lo próximo a vencer).
- ✅ Consolidación antiduplicidad de órdenes de compra (sección 9.3).
- ✅ Navegación dinámica por rol (módulos no permitidos omitidos del DOM).
- ✅ Modo claro / oscuro persistente.
- ✅ Devoluciones: RESTOCK reingresa a stock (lote + movimiento reales).
- ✅ Órdenes de compra: ciclo completo `DRAFT → SUBMITTED → APPROVED → RECEIVED`,
  con recepción parcial y over-receipt rechazado.
- ✅ Búsqueda de texto libre en Movimientos y Auditoría.
- ✅ Export a PDF de auditoría y de órdenes de compra (verificado con PDFs
  reales generados en un flujo E2E).
- ✅ Historia clínica: crear paciente, registrar entrada, editarla — la
  versión anterior queda archivada íntegra (no sólo un diff) y es consultable.
- ✅ Notificaciones en tiempo real: verificado con dos usuarios en dos
  navegadores distintos — el evento llega al segundo sin recargar la página,
  filtrado por el permiso del recurso.
- ✅ Adaptador HIS simulado: `/integrations/his/sync` sincroniza un paciente y
  una prescripción demo de punta a punta (visibles luego en Historia Clínica).
- ✅ 44 tests unitarios de dominio + 8 tests E2E de flujos críticos, todos en verde.

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
- **Fase 4 (calidad y observabilidad)** agregó:
  - **Búsqueda de texto libre** en Movimientos y Auditoría (`?q=`, multi-campo).
  - **Gráficos** (Recharts) en el Panel: distribución de inventario por
    prioridad, alertas por severidad y órdenes de compra por estado —
    activados por el permiso del recurso subyacente, no sólo `analytics:read`.
  - **Export a PDF** (jsPDF): reporte de auditoría filtrado y documento formal
    por orden de compra.
  - **Tests unitarios** (Vitest) de todo `backend/src/domain/` (clasificación,
    FEFO/Stock Útil, Motor de Compra, alertas, devoluciones) — 44 tests.
  - **Tests E2E** (Playwright, paquete `e2e/`) sobre RBAC de navegación, el
    ciclo completo de una orden de compra y el flujo de devoluciones.
  - **Documentación OpenAPI/Swagger** de toda la API en `/api/docs`.

- **Fase 5 (tiempo real, historia clínica, integración HIS)** agregó:
  - **WebSocket** (`backend/src/ws/server.ts`, montado en `/ws`) para
    notificaciones en tiempo real, autenticado con el mismo JWT que la API
    REST. Cada evento se filtra por el permiso del recurso que representa
    antes de enviarse — un socket sólo recibe lo que su usuario también
    podría leer por REST. Eventos emitidos hoy: nuevo movimiento, cambios de
    estado de una orden de compra (enviada/aprobada/rechazada/recibida),
    devolución procesada/rechazada, y entrada de historia clínica
    creada/editada. En el frontend, `useNotifications` + `NotificationBell`
    (campanita en la barra superior) reconectan automáticamente si se corta
    la conexión.
  - **Historia Clínica** orientada a farmacia (`Patient` +
    `ClinicalHistoryEntry`, nueva pantalla `/historia-clinica`): registro de
    pacientes y entradas (diagnóstico, prescripción, nota, actualización de
    alergias). No es un EHR generalista — eso lo sigue llevando el HIS del
    hospital. **Versionado real**: cada edición archiva primero el estado
    completo anterior en `ClinicalHistoryVersion` (no un diff) y lo deja
    consultable desde la propia entrada.
  - **Integración HIS**: interfaz `HisAdapter`
    (`backend/src/integrations/his/HisAdapter.ts`) con un
    `MockHisAdapter` como única implementación — no hay un HIS real
    configurado todavía. Expone `checkStatus`, `syncPatients`,
    `syncPrescriptions` y `pushDispenseEvent`; se opera desde
    `/integraciones` (sólo Administrador) o vía
    `POST /api/integrations/his/sync`. Reemplazar por un adaptador real
    (HL7/FHIR/REST) no requiere tocar quien lo consume.

Quedan pendientes, sin bloquear lo anterior: integración interhospitalaria
(sección 10), integración de cadena de frío por hardware, EOQ con costos
(modelo de Wilson) y capas de IA para pronóstico de demanda. El diseño modular
permite incorporar todo esto sin reescribir el núcleo.
