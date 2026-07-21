# MedLine — Arquitectura (Fase 1)

Este documento traza cómo la especificación técnica y funcional se materializa en
el código. Cada sección referencia la parte correspondiente del código fuente.

## Visión general

MedLine sigue una arquitectura **modular por dominios** con separación estricta
entre:

- **Capa de dominio** (`backend/src/domain/`): lógica de negocio pura, sin
  dependencias de framework ni base de datos (clasificación, FEFO, motor de
  compra, alertas). Es determinista y fácilmente testeable.
- **Capa de aplicación** (`backend/src/modules/`, `services/`): orquesta el
  dominio, persiste con Prisma y expone HTTP.
- **Capa de presentación** (`frontend/`): SPA que consume la API y renderiza la
  interfaz según los permisos del usuario.

Los datos fluyen de forma **event-driven**: cada cambio de stock genera un evento
en el libro de movimientos, del que se derivan la analítica de consumo, las
alertas y las decisiones del Motor de Compra.

```
 Movimiento (evento) ──► Libro de movimientos ──► Analítica de consumo (CDP, σ)
                                │                          │
                                ▼                          ▼
                         Ajuste de stock            Motor de Compra ──► Recomendación / Orden
                                │                          ▲
                                ▼                          │
                          Stock Útil (FEFO) ───────────────┘
                                │
                                ▼
                             Alertas
```

## Mapa especificación → código

| Sección de la spec                          | Implementación |
| ------------------------------------------- | -------------- |
| 2–3. Autenticación y RBAC                   | `backend/src/auth/rbac.ts` (matriz rol→permiso), `auth.routes.ts`, `middleware.ts`, `jwt.ts` |
| 4. Esquema de inventario y trazabilidad     | `prisma/schema.prisma` (modelos `Item`, `Batch`, `Supplier`) |
| 5. Registro de movimientos (ledger)         | `prisma/schema.prisma` (`Movement`), `modules/movements.routes.ts` |
| 6. Clasificación ABC/VEN + prioridad        | `domain/classification.ts` |
| 7. FEFO y Stock Útil                        | `domain/inventory.ts` |
| 8. Alertas automatizadas                    | `domain/alerts.ts`, `modules/alerts.routes.ts` |
| 9. Motor de Compra Inteligente              | `domain/purchasing.ts`, `modules/purchasing.routes.ts` |
| 9.3 Consolidación antiduplicidad            | `modules/purchasing.routes.ts` (`POST /purchasing/orders`) |
| 9.4 Restricciones de cadena de frío         | `domain/purchasing.ts` (`splitDeliveryByCapacity`) |
| 12. Auditoría inmutable (append-only)       | `services/audit.ts`, `modules/audit.routes.ts` (solo `GET`/`INSERT`) |
| 13. UI dinámica por rol                     | `frontend/src/rbac/navigation.tsx`, `components/Layout.tsx`, `App.tsx` |
| 14. Diseño (paleta médica, claro/oscuro)    | `frontend/src/styles/tokens.css`, `theme/ThemeContext.tsx` |

## RBAC (secciones 2–3)

La **fuente de verdad** es `backend/src/auth/rbac.ts`: define roles, permisos con
formato `modulo:accion` y la matriz `ROLE_PERMISSIONS`. El seed crea las tablas
`Role`, `Permission` y `RolePermission` a partir de ella.

Flujo de autenticación:

1. `POST /api/auth/login` valida credenciales (bcrypt).
2. Se resuelve el rol del usuario y se cargan sus permisos.
3. Se emite un JWT que embebe el set de permisos.
4. El frontend guarda la sesión y **renderiza dinámicamente** el menú a partir de
   `visibleModules(permissions)` — los módulos no autorizados no se enlazan ni se
   montan como ruta.

La autorización es de **doble capa**: el backend la impone en cada endpoint con
`requirePermission(...)` (autoridad real); el frontend la refleja para no mostrar
lo que no corresponde. La UI nunca es la única barrera.

## Motor de Compra (sección 9)

`domain/purchasing.ts` implementa las variables y fórmulas:

- **CDP** = media móvil del consumo diario (derivado de los movimientos `EXIT`).
- **SS** (Stock de Seguridad) = `Z · σ_demanda · √TE · peso_VEN`. El peso VEN
  amplifica la reserva para artículos **Vitales** (tolerancia cero a quiebres).
- **PP / ROP** = `CDP · TE + SS`. Activación: `SI Stock_Útil ≤ PP → recomendar`.
- **Cantidad recomendada** ≈ cobertura objetivo, acotada por MOQ y capacidad de
  almacenamiento (aproximación de EOQ para Fase 1).
- **Cadena de frío**: si la cantidad supera la capacidad disponible, se divide en
  entrega principal + entregas parciales programadas.

El motor observa el **Stock Útil**, no el total: el stock que vence dentro de la
ventana de riesgo se considera "en riesgo" y se excluye del cálculo de
reposición, previniendo faltantes operativos.

**Consolidación antiduplicidad (9.3):** al generar una recomendación, el sistema
busca una orden **abierta** para el mismo proveedor; si existe una línea para el
ítem, la actualiza; si no, la agrega; si no hay orden abierta, crea una nueva.
Esto evita órdenes duplicadas para un mismo artículo en el día.

## Auditoría inmutable (sección 12)

`services/audit.ts` sólo expone `recordAudit` (INSERT). No hay endpoints ni
métodos de actualización/borrado sobre `AuditLog`. Cada acción sensible (login,
creación de movimientos, órdenes, aprobaciones, CRUD de usuarios) registra
`{ userId, actionType, module, entity, previousValue → newValue, timestamp }`.

## Decisiones de diseño

- **SQLite en desarrollo** para arranque sin configuración; el `datasource` de
  Prisma se cambia a PostgreSQL en producción sin tocar la lógica. Los "enums" se
  modelan como `String` validados en `domain/enums.ts` para portabilidad.
- **Sin librerías de componentes** en el frontend (requisito de la sección 14):
  sistema de diseño propio con tokens CSS, iconografía SVG inline y tematización
  clara/oscura mediante `data-theme` en la raíz.
- **Dominio sin efectos secundarios**: toda la matemática del negocio vive en
  funciones puras, lo que facilita las pruebas y la futura sustitución por
  modelos de IA.

## Modelo de datos (resumen)

```
Role 1─* RolePermission *─1 Permission
Role 1─* User
Supplier 1─* Item 1─* Batch
Item 1─* Movement *─1 User
Item 1─* Alert
Supplier 1─* PurchaseOrder 1─* PurchaseOrderLine *─1 Item
User 1─* AuditLog   (append-only)
```

Ver `backend/prisma/schema.prisma` para el esquema completo con campos y
restricciones (p. ej. unicidad `(itemId, batchNumber)` para lotes y
`(purchaseOrderId, itemId)` para líneas de orden).
