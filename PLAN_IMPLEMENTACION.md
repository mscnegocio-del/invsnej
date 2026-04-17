# Plan de implementación por fases (v2)

Sistema de inventario web con escaneo de barras, validación de duplicados, CRUD, búsqueda y exportación flexible.

**Última revisión del documento:** abril 2026

---

## Estado actual (resumen ejecutivo)

✅ **Fases 0–16**: Completadas en línea con el código (app en producción / Vercel).

🎨 **Fase 17 (shadcn/ui + temas dark mode)**: **implementado** — componentes UI modernos, dark mode/light mode, Lucide icons, react-hook-form + zod, validación tipada.

✅ **Mejoras posteriores a la Fase 15** (también implementadas):
- Alerta de duplicado cuando el bien existe en **otra sede** (`Scan` + `DuplicateAlert` con nombre de sede de origen).
- `DuplicateAlert` y vistas relacionadas: **ubicación** antigua guardada como ID numérico se **resuelve a nombre** desde el catálogo.
- **Agregar responsable** desde el buscable (`TrabajadorSearchableSelect`): insert en `trabajadores`, nombre en mayúsculas, `reload()` del catálogo.
- **Historial de cambios** (`bien_historial`): registro al editar estado, responsable y ubicación; listado en `BienDetail`.
- **Nombre del bien con autocompletado** desde `siga_bienes.descripcion` (`NombreSearchableInput` + debounce).
- Modal de escaneo: input manual duplicado **oculto** en modal (`BarcodeScanModal` / `hideManualInput`).
- Carga Excel SIGA: columna **usuario**, barra de progreso y mensaje de éxito en `Admin`.
- Catálogo maestro (`CatalogContext`): **TTL 1 minuto** (no 15) para ver cambios más rápido entre dispositivos.

🔄 **Fase 16 (autenticación y seguridad)**: **implementado en app + backend** — login con **OTP por correo** (`/login`), **passkeys/WebAuthn** (Edge Function `passkeys`, páginas `Login` y `Security`, `passkeysApi` / `useWebAuthn`), RPC `auth_user_id_by_email`, tablas `user_passkeys` y `auth_webauthn_challenges`, `AuthGuard` / `RoleGuard` / `AuthenticatedShell`. **Pendiente mejora continua**: RLS exhaustivo alineado a roles, rate limiting/lockout robustos, auditoría de accesos y MFA admin si aplica.

### Estado histórico (Fase 12)

- ✅ Cambio de ZXing a **Quagga2** como fallback de escaneo
- ✅ Flujo de **Scan**: input de código + icono cámara (modal)
- ✅ **Cámara**: solo activa en modal, se libera al cerrar (ahorro batería)
- ✅ **Copiar para compartir**: texto legible formateado para WhatsApp/Telegram
- ✅ **Exportación**: CSV, JSON, descarga todo en bloques 1000 (incluye columna **sede** y campos SIGA cuando aplica)
- ✅ **Ubicación**: se guarda nombre (no ID), se resuelven IDs antiguos en UI y exportaciones
- ✅ **Estado**: incluido en exportaciones y visualización
- ✅ **Responsable**: nombre resuelto en UI y exportaciones
- ✅ **Input manual**: opción "Escribir manualmente" en `BarcodeScanner` (fuera del modal de cámara)

---

## Fase 12: Mejoras y estabilización (Completado)

| # | Tarea | Descripción | Estado |
|---|-------|-------------|--------|
| 12.1 | Quagga2 integrado | Fallback cuando BarcodeDetector no soportado | ✅ Completado |
| 12.2 | Modal de escaneo | Cámara solo activa dentro del modal | ✅ Completado |
| 12.3 | Input manual de código | Opción "Escribir manualmente" en BarcodeScanner | ✅ Completado |
| 12.4 | Copiar texto inteligente | Formato legible para WhatsApp/Telegram | ✅ Completado |
| 12.5 | Exportación completa | Bloques 1000, CSV, JSON, descarga todo | ✅ Completado |
| 12.6 | Ubicación normalizada | Guardar nombre, resolver IDs antiguos | ✅ Completado |
| 12.7 | Estado en exportaciones | Incluir en CSV, JSON, copiar | ✅ Completado |
| 12.8 | Responsable resuelto | Nombre en UI y exportaciones | ✅ Completado |

**Salida**: App estable con 1900+ bienes, exportación flexible, flujo optimizado.

---

## Fase 13: Optimizaciones y extensiones futuras (propuesto)

| # | Tarea | Descripción | Prioridad | Nota (marzo 2026) |
|---|-------|-------------|-----------|-------------------|
| 13.1 | Offline-first | Service worker + sync cuando hay conexión | Media | Pendiente |
| 13.2 | Soft delete | Marcar `eliminado_at` en lugar de DELETE | Media | Pendiente |
| 13.3 | Auditoría | Log de cambios (quién, cuándo, qué) | Baja | **Parcial:** tabla `bien_historial` para cambios de estado, responsable y ubicación en edición; no cubre aún todas las entidades ni login |
| 13.4 | Roles y permisos | Restricciones por usuario en Supabase RLS | Baja | **Parcial:** roles en app (`RoleGuard`); RLS en BD debe alinearse con Fase 16 |
| 13.5 | Importación masiva | CSV upload para registrar múltiples bienes | Baja | Pendiente |
| 13.6 | Etiquetas de código | Generar e imprimir etiquetas con códigos | Baja | Pendiente |
| 13.7 | Estadísticas | Dashboard de bienes por estado, ubicación, etc. | Baja | Pendiente |
| 13.8 | Modo oscuro | Tema dark mode configurable | Baja | Pendiente |

---

## Fase 14: Multi-sede (NUEVO)

Permite realizar inventario en múltiples sedes. Cada bien queda asociado a una sede. La app recuerda la sede activa en el dispositivo (localStorage) y la muestra siempre en el header.

### 14.0 — SQL: Base de datos

Ejecutar en Supabase SQL Editor:

```sql
-- 1. Tabla de sedes
CREATE TABLE IF NOT EXISTS sedes (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  codigo TEXT UNIQUE -- ej: "SEDE-HYO", "SEDE-LIM"
);

-- 2. Insertar sedes iniciales (ajustar según corresponda)
INSERT INTO sedes (nombre, codigo) VALUES
  ('Sede Huancayo', 'SEDE-HYO'),
  ('Sede Lima', 'SEDE-LIM');
-- Agregar más según necesidad

-- 3. Columna sede_id en bienes
ALTER TABLE bienes ADD COLUMN IF NOT EXISTS sede_id INTEGER REFERENCES sedes(id);

-- 4. Índice para filtrado por sede
CREATE INDEX IF NOT EXISTS idx_bienes_sede_id ON bienes(sede_id);

-- 5. (Opcional) Asignar sede a bienes existentes si todos son de una sede inicial
-- UPDATE bienes SET sede_id = 1 WHERE sede_id IS NULL;
```

### 14.1 — SedeContext

Crear `src/context/SedeContext.tsx`:

- Lee `sede_activa` de localStorage al montar
- Expone: `sedeActiva` (`{ id, nombre, codigo } | null`), `cambiarSede()`, `loading`
- Si no hay sede en localStorage → `sedeActiva = null` → app muestra `SedeSelector`
- Al seleccionar sede → guarda en localStorage + actualiza estado

```typescript
// Forma del contexto
interface SedeContextType {
  sedeActiva: { id: number; nombre: string; codigo: string } | null
  cambiarSede: (sede: { id: number; nombre: string; codigo: string }) => void
  limpiarSede: () => void
  loading: boolean
}
```

### 14.2 — SedeSelector (pantalla de selección)

Crear `src/pages/SedeSelector.tsx`:

- Pantalla completa que aparece cuando `sedeActiva === null`
- Carga lista de sedes desde Supabase (`SELECT id, nombre, codigo FROM sedes ORDER BY nombre`)
- Lista de sedes con botón seleccionar
- Al seleccionar → guarda en `SedeContext` → navega a Home
- No tiene botón "atrás" (obligatorio seleccionar sede para continuar)

```
┌─────────────────────────────┐
│                             │
│   📍 Selecciona tu sede     │
│                             │
│   ┌─────────────────────┐   │
│   │ Sede Huancayo       │   │
│   └─────────────────────┘   │
│   ┌─────────────────────┐   │
│   │ Sede Lima           │   │
│   └─────────────────────┘   │
│                             │
└─────────────────────────────┘
```

### 14.3 — Barra superior con sede activa

Implementado en `src/components/Layout.tsx` (no existe `Header.tsx` separado):

- Barra superior en el layout de la app (cuando ya hay sede y sesión)
- Muestra sede activa + botón **Cambiar** → limpia sede y vuelve a `SedeSelector`

```
┌─────────────────────────────────────┐
│ 📍 Sede Huancayo          [Cambiar] │
└─────────────────────────────────────┘
```

### 14.4 — BienForm: guardar sede_id

Modificar `src/components/BienForm.tsx`:

- Al hacer `.insert(bien)` incluir `sede_id: sedeActiva.id`
- Al hacer `.update(bien)` NO sobreescribir `sede_id` (mantener el original)

### 14.5 — Search: filtrar por sede activa

Modificar `src/pages/Search.tsx`:

- Agregar `.eq('sede_id', sedeActiva.id)` al query de búsqueda por defecto
- Agregar toggle/checkbox "Buscar en todas las sedes" para cuando se necesite ver inventario global
- Exportación: incluir columna `sede` en CSV/JSON

### 14.6 — CatalogContext: incluir sedes

Modificar `src/context/CatalogContext.tsx`:

- Agregar carga de `sedes` con cache en localStorage
- **TTL actual del catálogo: 1 minuto** (ajustable; antes se documentaba 15 min)
- Exponer `sedes[]` y `reload()` para uso en filtros y visualización

### Flujo completo Fase 14

```
Abre la app
    │
    ▼
¿localStorage tiene sede_activa?
    ├── No ──► SedeSelector → selecciona → guarda → Home
    └── Sí ──► Home (con header mostrando sede)

Registrar bien
    └── BienForm.insert() incluye sede_id automáticamente

Buscar bienes
    └── Query filtra por sede_id activa por defecto
    └── Toggle "todas las sedes" disponible

Cambiar sede
    └── Header botón [Cambiar] → limpiar localStorage → SedeSelector
```

### Checklist Fase 14

- [x] SQL ejecutado en Supabase (tabla sedes + columna sede_id + índice)
- [x] Sedes iniciales insertadas en BD
- [x] `SedeContext` creado; flujo post-login en `AuthenticatedShell` (muestra `SedeSelector` si no hay sede)
- [x] `SedeSelector` muestra lista y guarda selección
- [x] `Layout` muestra sede activa y botón Cambiar
- [x] `BienForm` guarda `sede_id` al crear
- [x] `Search` filtra por sede activa; toggle "todas las sedes"
- [x] Exportación CSV/JSON incluye columna sede (también en descarga completa vía `buildCsv`)
- [x] Build sin errores

---

## Fase 15: Base de conocimiento SIGA PJ (NUEVO)

Permite cargar el Excel del SIGA PJ como base de referencia. Al escanear un código, el formulario se prerellena automáticamente con marca, modelo, serie, orden de compra y valor. El Excel se puede volver a cargar para actualizar registros nuevos.

### 15.0 — SQL: Base de datos

Ejecutar en Supabase SQL Editor:

```sql
-- 1. Tabla base de conocimiento SIGA
CREATE TABLE IF NOT EXISTS siga_bienes (
  id SERIAL PRIMARY KEY,
  codigo_patrimonial TEXT UNIQUE NOT NULL,  -- clave de cruce con bienes
  descripcion TEXT,
  usuario TEXT,
  marca TEXT,
  modelo TEXT,
  serie TEXT,
  orden_compra TEXT,
  valor NUMERIC,
  fecha_carga TIMESTAMPTZ DEFAULT NOW(),
  fecha_actualizacion TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Índice para búsqueda rápida por código
CREATE INDEX IF NOT EXISTS idx_siga_codigo ON siga_bienes(codigo_patrimonial);

-- 3. Nuevas columnas en bienes (datos enriquecidos desde SIGA)
ALTER TABLE bienes ADD COLUMN IF NOT EXISTS marca TEXT;
ALTER TABLE bienes ADD COLUMN IF NOT EXISTS modelo TEXT;
ALTER TABLE bienes ADD COLUMN IF NOT EXISTS serie TEXT;
ALTER TABLE bienes ADD COLUMN IF NOT EXISTS orden_compra TEXT;
ALTER TABLE bienes ADD COLUMN IF NOT EXISTS valor NUMERIC;
```

### 15.1 — Página Admin: cargar Excel SIGA

Crear `src/pages/Admin.tsx` (accesible desde Home o menú):

**Funcionalidad de carga:**
- Input file acepta `.xlsx` y `.xls`
- Usa **SheetJS** (ya disponible en el proyecto) para parsear
- Mapeo de columnas del Excel a campos de `siga_bienes`:

```typescript
// Mapeo esperado de columnas del Excel SIGA PJ
// Incluye USUARIO; ajustar sinónimos según el Excel real
const COLUMN_MAP = {
  codigo_patrimonial: ['CÓDIGO', 'CODIGO', 'COD_PATRIMONIAL', 'CÓDIGO PATRIMONIAL'],
  descripcion:        ['DESCRIPCIÓN', 'DESCRIPCION', 'NOMBRE'],
  usuario:            ['USUARIO', 'USER'],
  marca:              ['MARCA'],
  modelo:             ['MODELO'],
  serie:              ['N° SERIE', 'SERIE', 'NRO SERIE'],
  orden_compra:       ['ORDEN DE COMPRA', 'OC', 'N° OC'],
  valor:              ['VALOR', 'VALOR ACTUAL', 'COSTO'],
}
```

- Preview de primeras 5 filas antes de confirmar carga
- Carga en bloques de 500 con upsert (actualiza si ya existe por `codigo_patrimonial`)
- Barra de progreso durante carga
- Resumen al finalizar: `X registros nuevos, Y actualizados, Z con error`

```
┌─────────────────────────────────────┐
│  📂 Cargar base SIGA PJ             │
│                                     │
│  [Seleccionar archivo Excel]        │
│                                     │
│  Vista previa (5 filas):            │
│  ┌────────┬──────┬───────┬───────┐  │
│  │ Código │Marca │Modelo │ Valor │  │
│  ├────────┼──────┼───────┼───────┤  │
│  │ 001... │ HP   │ 840   │ 3500  │  │
│  └────────┴──────┴───────┴───────┘  │
│                                     │
│  [Cancelar]    [Confirmar carga]    │
│                                     │
│  ████████░░░░  450/1200 registros   │
└─────────────────────────────────────┘
```

### 15.2 — Consulta SIGA al escanear

Modificar `src/pages/Scan.tsx` y `src/components/BienForm.tsx`:

Al presionar "Continuar" con un código:

```
Query duplicado en bienes (ya existe)
        │
        ├── Existe ──► DuplicateAlert (sin cambios)
        │
        └── No existe ──► consultar siga_bienes
                          .select('marca,modelo,serie,orden_compra,valor,descripcion')
                          .eq('codigo_patrimonial', codigo)
                          .maybeSingle()
                                │
                                ├── Encontrado ──► BienForm con campos SIGA prellenados
                                │                  (editables, usuario puede modificar)
                                │
                                └── No encontrado ──► BienForm vacío normal
```

### 15.3 — BienForm: campos SIGA

Modificar `src/components/BienForm.tsx`:

- Agregar sección "Datos del bien (SIGA)" con campos:
  - Marca
  - Modelo
  - N° Serie
  - Orden de Compra
  - Valor
- Si vienen prellenados desde SIGA → mostrar con indicador visual `🔍 Desde SIGA`
- Todos editables antes de guardar
- Al guardar → persisten en `bienes` (no solo en `siga_bienes`)

### 15.4 — BienDetail y exportaciones

Modificar `src/components/BienDetail.tsx`:
- Mostrar campos marca, modelo, serie, orden_compra, valor si existen

Modificar exportaciones en `src/pages/Search.tsx`:
- CSV: agregar columnas marca, modelo, serie, orden_compra, valor
- JSON: incluir campos si no son null
- Copiar para chat: incluir si existen (ej: `Marca: HP | Modelo: 840 G3`)

### Flujo completo Fase 15

```
Admin sube Excel SIGA
    └── SheetJS parsea → preview → confirmar
    └── Upsert en bloques 500 → siga_bienes
    └── Resumen: N nuevos, M actualizados

Usuario escanea código
    └── No duplicado → busca en siga_bienes
        ├── Encontrado → BienForm prellenado (marca, modelo, serie, OC, valor)
        └── No encontrado → BienForm vacío

Usuario guarda bien
    └── bienes.insert() incluye: marca, modelo, serie, orden_compra, valor, sede_id

Exportación
    └── CSV/JSON incluye todos los campos enriquecidos
```

### Checklist Fase 15

- [x] SQL ejecutado (tabla siga_bienes + columnas en bienes)
- [x] Página Admin protegida por rol admin (`/admin`)
- [x] SheetJS parsea Excel correctamente
- [x] Mapeo de columnas (incl. usuario) según Excel SIGA
- [x] Preview antes de confirmar
- [x] Carga en bloques con barra de progreso y mensaje de éxito/error
- [x] Al escanear: consulta `siga_bienes` y prerellena vía query params / formulario
- [x] Indicador visual "Desde SIGA" en campos prellenados
- [x] `BienDetail` muestra bloque SIGA y sede cuando aplica
- [x] Exportaciones incluyen columnas SIGA y sede
- [x] Opcional operativo: SQL de backfill `bienes` desde `siga_bienes` para marca/modelo/serie/valor/OC donde faltaban datos
- [x] Build sin errores

---

## Fase 16: Autenticación y seguridad externa (abril 2026, sin dominio propio) (NUEVO)

Fortalece la seguridad de acceso usando Supabase Auth y controles en aplicación/API, considerando un entorno donde no se dispone de dominio propio para correo corporativo ni configuración avanzada de autenticación federada.

**Estado en código (abril 2026):** desplegado en producción: **OTP por correo** (`/login`, `signInWithOtp` / `verifyOtp`), **passkeys/WebAuthn** (Edge Function `passkeys`, `passkeysApi`, `useWebAuthn`, `/security`), tablas `user_passkeys` y `auth_webauthn_challenges`, RPC `auth_user_id_by_email`, `AuthGuard` / `RoleGuard` / `AuthenticatedShell`, `/auth/callback` para redirects de Auth. Pendiente mejora continua: rate limit/lockout robustos, auditoría de autenticación exhaustiva, reautenticación fuerte admin.

### 16.1 — Fase mínima: acceso por correo + RLS (obligatoria)

| Estado | # | Tarea | Descripción | Prioridad |
|---|---|-------|-------------|-----------|
| [x] | 16.1.1 | Habilitar acceso por correo (OTP) | Flujo principal: código OTP por correo en `Login.tsx`; magic link queda como vía legacy en callback si el proyecto lo mantiene en plantillas | Alta |
| [ ] | 16.1.2 | Restringir altas públicas | Desactivar sign-up abierto y permitir solo usuarios autorizados por admin | Alta |
| [x] | 16.1.3 | RLS en tablas críticas | Aplicar políticas RLS en `bienes`, `trabajadores`, `ubicaciones`, `sedes`, `siga_bienes` | Alta |
| [~] | 16.1.4 | Roles base en metadata | Existen roles en `perfiles` y guards en frontend; falta cerrar estrategia final de `app_role` en metadata/claims alineada con RLS | Alta |
| [x] | 16.1.5 | Guard de sesión en frontend | Redirigir a login cuando no hay sesión válida y proteger rutas sensibles (`Admin`, edición, eliminación) | Alta |
| [~] | 16.1.6 | Auditoría mínima de acceso | Existe `bien_historial` para cambios funcionales; falta auditoría específica de autenticación y accesos | Media |

### 16.2 — Fase intermedia: hardening operativo y cuentas privilegiadas

| Estado | # | Tarea | Descripción | Prioridad |
|---|---|-------|-------------|-----------|
| [ ] | 16.2.1 | Refuerzo para cuentas admin | Exigir reautenticación fuerte para `app_role=admin` (passkey preferente; MFA adicional si se mantiene necesario) | Alta |
| [ ] | 16.2.2 | Rate limiting de acceso por correo | Limitar solicitudes de OTP/códigos y reintentos por IP y por email (ej. ventana de 15 min) | Alta |
| [ ] | 16.2.3 | Lockout temporal | Bloquear temporalmente cuenta/IP tras N intentos fallidos consecutivos | Alta |
| [ ] | 16.2.4 | Alertas de seguridad | Notificar intentos sospechosos y bloqueos (email admin / panel) | Media |
| [ ] | 16.2.5 | Hardening de sesiones | Reducir TTL de sesión en admin y forzar reautenticación para acciones críticas | Media |

### 16.3 — Fase avanzada: passkeys/WebAuthn como acceso preferente

| Estado | # | Tarea | Descripción | Prioridad |
|---|---|-------|-------------|-----------|
| [x] | 16.3.1 | Habilitar passkeys progresivo | Tras sesión OTP, registro de passkey vía Edge `passkeys`; login con «Continuar con passkey» | Media |
| [x] | 16.3.2 | Flujo híbrido de fallback | Passkey primero cuando aplica; si no hay credencial o falla → OTP por correo | Alta |
| [x] | 16.3.3 | Gestión de credenciales | `/security`: listar, registrar otra, revocar passkeys | Media |
| [~] | 16.3.4 | Política por rol | Requerir acceso fuerte para `admin` (passkey preferente) — evaluar según riesgo operativo | Media |

### Criterios de aceptación (Fase 16)

- [x] Usuario sin sesión no puede leer inventario por API: RLS activa y políticas `auth.uid() IS NOT NULL` + `is_session_active()` en tablas críticas (`bienes`, `trabajadores`, `ubicaciones`, `sedes`, `siga_bienes`, `bien_historial`)
- [x] Usuario `operador` no accede a funciones admin en frontend: ruta `/admin` protegida por `RoleGuard` (rol `admin`)
- [x] El acceso por correo funciona (`/login` + OTP); passkeys en producción con fallback OTP
- [ ] Cuentas admin requieren acceso reforzado y no pueden omitir la política definida para reautenticación fuerte
- [ ] Rate limit y lockout bloquean ataques de fuerza bruta (verificado con pruebas controladas)
- [~] Eventos de seguridad: existe `bien_historial` para cambios de bienes; pendiente auditoría completa de autenticación (login fallido, lockout, etc.)
- [x] Passkeys/WebAuthn: Edge `passkeys`, enrolamiento y login verificados en producción; fallback OTP

### Verificación MCP (abril 2026)

Consultas ejecutadas en Supabase vía MCP para validar estado real de Fase 16:

- `pg_tables`: RLS (`rowsecurity=true`) confirmada en `bienes`, `trabajadores`, `ubicaciones`, `sedes`, `siga_bienes`, `bien_historial`.
- `pg_policies`: políticas activas por tabla/operación, incluyendo:
  - `bienes_select_activos` con `auth.uid() IS NOT NULL` e `is_session_active()`.
  - `bienes_insert_oper` / `bienes_update_oper` con `is_operador_o_admin()`.
  - `siga_bienes_insert` / `siga_bienes_update` con `is_admin()`.
- `pg_proc`: funciones `is_admin`, `is_operador_o_admin`, `is_session_active` existen en esquema `public`.
- `auth.users`: actualmente no hay evidencia de `app_role` en `raw_user_meta_data` ni en `raw_app_meta_data` (0 de 1 usuarios con `app_role`), por lo que la estrategia de roles debe seguir revisándose entre frontend/claims/RLS.

### Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación recomendada |
|--------|---------|------------------------|
| Entrega tardía del correo (OTP/enlace) por proveedor | Alto (bloqueo operativo) | Proveedor transaccional confiable, reintento, expiración razonable, canal alterno controlado para cuentas críticas |
| Configuración RLS incompleta | Crítico (fuga o manipulación de datos) | Pruebas por rol, revisión de políticas SQL, validación en staging antes de producción |
| Fricción operativa en el primer enrolamiento de passkeys | Medio | Mantener **OTP** como primer acceso/fallback, guiar el alta por dispositivo y desplegar gradualmente |
| Falsos positivos en rate limit/lockout | Medio | Umbrales progresivos, whitelist operativa por sede/IP confiable, canal de desbloqueo |
| Soporte desigual de passkeys en dispositivos antiguos | Medio | Mantener fallback por **OTP** y despliegue gradual por grupos piloto |
| Dependencia de servicios externos (Auth/email) | Alto | Monitoreo, alertas, runbook de contingencia y cuentas break-glass controladas |

---

---

## Fase 17: shadcn/ui + Tema oscuro/claro (NUEVO - abril 2026)

Modernización de la interfaz visual con componentes composables, soporte de tema oscuro/claro y validación de formularios tipada.

### 17.0 — Dependencias instaladas

```json
{
  "@radix-ui/*": "UI primitives (dialog, select, dropdown-menu, tabs, table, etc.)",
  "class-variance-authority": "Utilidad para variantes de componentes",
  "clsx": "Utilidad para condicionales CSS",
  "cmdk": "Comando/combobox para búsquedas (searchable selects)",
  "lucide-react": "Iconografía moderna",
  "next-themes": "Soporte dark mode/light mode con localStorage",
  "react-hook-form": "Gestión de formularios",
  "sonner": "Toast notifications (opcional, instalado)",
  "tailwind-merge": "Merge intelligent de clases Tailwind",
  "zod": "Validación de esquemas tipada"
}
```

### 17.1 — Estructura de componentes UI

Carpeta `web/src/components/ui/` con componentes base (auto-generados por `shadcn-ui`):

```
ui/
├── alert-dialog.tsx          # AlertDialog (confirmaciones)
├── alert.tsx                 # Alert (mensajes)
├── avatar.tsx                # Avatar (fotos de usuario)
├── badge.tsx                 # Badge (etiquetas)
├── button.tsx                # Button (base con variantes)
├── card.tsx                  # Card (contenedores)
├── command.tsx               # Command (combobox, búsqueda)
├── dialog.tsx                # Dialog (modales)
├── dropdown-menu.tsx         # DropdownMenu (menús)
├── form.tsx                  # Form (integración react-hook-form)
├── input.tsx                 # Input (campos texto)
├── label.tsx                 # Label (etiquetas)
├── popover.tsx               # Popover (popovers)
├── progress.tsx              # Progress (barra progreso)
├── scroll-area.tsx           # ScrollArea (área scrolleable)
├── select.tsx                # Select (dropdown select)
├── separator.tsx             # Separator (líneas divisoras)
├── sheet.tsx                 # Sheet (side panel)
├── skeleton.tsx              # Skeleton (loading placeholder)
├── switch.tsx                # Switch (toggle)
├── table.tsx                 # Table (tablas)
├── tabs.tsx                  # Tabs (pestaña)
├── textarea.tsx              # Textarea (áreas texto)
└── tooltip.tsx               # Tooltip (tooltips)
```

### 17.2 — Archivo de configuración `components.json`

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "zinc",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

### 17.3 — Tema oscuro/claro con `next-themes`

**En `web/src/main.tsx`:**
- Wrapping de `<App>` con `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>`
- Persiste preferencia en localStorage: `theme` key

**En `web/src/components/Layout.tsx`:**
- Componente `ThemeToggle` con botón `<Button variant="ghost" size="icon">` + icono Lucide (Sun/Moon)
- Usa hook `useTheme()` para cambiar entre `'light'` y `'dark'`

**En `web/src/index.css`:**
- CSS variables para colores (light y dark) usando Tailwind CSS 4
- Clases `.light` y `.dark` automáticas

**Uso en componentes:**
```tsx
<div className="bg-white dark:bg-slate-900">
  Contenido que cambia de color con el tema
</div>
```

### 17.4 — Modernización de componentes

**Componentes afectados (reescribir con shadcn/ui):**

| Componente | Cambios |
|-----------|---------|
| **Layout** | Button (variant, size, icon), Separator, tema toggle |
| **Home** | Card (CardContent), Badge para contador passkeys |
| **Login** | Form (react-hook-form), Input, Button, AlertDialog para errores |
| **BienForm** | Form (react-hook-form), Input, Select, Tabs, Button, Card |
| **BienDetail** | Card, Tabs, Table, AlertDialog (delete), Badge (estado) |
| **Search** | Card (filtros), Table (resultados), Button (acciones) |
| **DuplicateAlert** | AlertDialog (shadcn), Badge, Button |
| **Admin** | Card, Input, Button, Progress (carga Excel), Table (usuarios) |
| **Security** | Card, Table (passkeys), AlertDialog (revocar), Button, Dialog (nueva passkey) |
| **BarcodeScanModal** | Dialog (shadcn), Button |
| **BarcodeScanner** | Button (variantes), fallback para input manual |

### 17.5 — Validación de formularios: react-hook-form + zod

**Ejemplo en `BienForm`:**

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const bienSchema = z.object({
  codigo_patrimonial: z.string().min(1, 'Código requerido'),
  nombre_mueble_equipo: z.string().min(1, 'Nombre requerido'),
  estado: z.enum(['Nuevo', 'Bueno', 'Regular', 'Malo', 'Muy malo']),
  // ... más campos
})

type BienFormData = z.infer<typeof bienSchema>

export function BienForm() {
  const form = useForm<BienFormData>({
    resolver: zodResolver(bienSchema),
    defaultValues: { /* ... */ }
  })

  function onSubmit(data: BienFormData) {
    // Guardar en Supabase
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="codigo_patrimonial"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Código patrimonial</FormLabel>
              <FormControl>
                <Input placeholder="Ej: 001234567" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Guardar</Button>
      </form>
    </Form>
  )
}
```

### 17.6 — Utilidad `cn()` para clases dinámicas

En `web/src/lib/utils.ts`:

```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Uso:**

```tsx
<Button className={cn('px-4 py-2', isActive && 'bg-blue-500')}>
  Click me
</Button>
```

### 17.7 — Lucide Icons integrados

**Importar desde `lucide-react`:**

```tsx
import { Home, ScanLine, Search, Users, Shield, LogOut, Sun, Moon } from 'lucide-react'

// Usar con tamaño
<Home className="h-4 w-4" />
<ScanLine className="h-6 w-6 text-blue-500" />
```

**Icons comúnmente usados en este proyecto:**
- `Home`, `ScanLine`, `Search` — navegación
- `Users`, `Shield` — admin
- `LogOut` — cerrar sesión
- `Sun`, `Moon` — tema toggle
- `ChevronLeft`, `ChevronRight` — navegación
- `RefreshCw` — recargar
- `Trash2`, `Edit` — acciones
- `Download`, `Copy`, `FileText` — exportación
- `AlertCircle`, `CheckCircle` — estado

### Flujo de cambios Fase 17

```
1. Agregar dependencias shadcn/ui (@radix-ui/*, tailwind-merge, etc.)
2. Ejecutar `npx shadcn-ui@latest init` → genera components.json y estructura ui/
3. Instalar componentes individuales según necesidad (dialog, form, table, etc.)
4. Configurar next-themes en main.tsx y layout
5. Reescribir componentes existentes usando shadcn/ui base
6. Validación de formularios con react-hook-form + zod
7. Tests visuales en móvil (light mode + dark mode)
8. Build sin errores

```

### Checklist Fase 17

- [x] Dependencias shadcn/ui instaladas
- [x] Componentes UI generados en `web/src/components/ui/`
- [x] `components.json` configurado
- [x] `next-themes` integrado en `main.tsx`
- [x] `ThemeToggle` en `Layout.tsx` (botón Sun/Moon)
- [x] Componentes rediseñados: `Home`, `Layout`, `BienForm`, `Search`, `BienDetail`, `Admin`, `Login`, `Security`
- [x] Validación: react-hook-form + zod en formularios
- [x] Lucide icons integrados
- [x] Dark mode funcional (CSS variables)
- [x] Responsive mobile-first con Tailwind 4
- [x] Build sin errores
- [x] PWA instalable
- [x] Tests visuales: light/dark mode en producción

---

## Resumen de arquitectura actualizada

### Stack
- React 19 + Vite 6
- **Tailwind CSS 4** + **shadcn/ui** (componentes composables)
- **Lucide React** (iconografía)
- **next-themes** (dark mode/light mode)
- **react-hook-form** + **zod** (validación)
- Supabase
- **Quagga2** (escáner fallback)
- BarcodeDetector (nativo)
- **SheetJS** (parseo Excel SIGA)
- PWA con service workers
- Deploy: Vercel

### Características principales
1. **Escaneo flexible**: cámara solo cuando se abre modal (batería)
2. **Input manual**: opción integrada de escribir código
3. **Validación de duplicados**: con UI clara
4. **CRUD completo**: Create, Read, Update, Delete
5. **Multi-sede**: selección persistente, header con sede activa, filtrado automático
6. **Base de conocimiento SIGA**: prerelleno automático desde Excel PJ
7. **Búsqueda filtrada**: código, responsable, ubicación, sede
8. **Exportación flexible**: copiar, JSON, CSV con todos los campos enriquecidos
9. **Normalización de datos**: ubicaciones y responsables resueltos en UI/exportación
10. **Cache de datos maestros**: trabajadores, ubicaciones y sedes con **TTL 1 min** y `reload()` manual
11. **Historial de cambios** en ficha de bien (`bien_historial`) para estado, responsable y ubicación
12. **Autocompletado de nombre** desde `siga_bienes` al registrar (`NombreSearchableInput`)
13. **🎨 Interfaz moderna:** shadcn/ui + Tailwind CSS 4 + Lucide icons
14. **🌙 Dark mode/Light mode:** tema persistente en localStorage (next-themes)
15. **✅ Validación tipada:** react-hook-form + zod en todos los formularios
16. **♿ Accesibilidad:** componentes shadcn/ui con ARIA, keyboard navigation

### Base de datos
- 1900+ registros de bienes (orden de magnitud)
- Índices en: codigo_patrimonial, id_trabajador, ubicacion, sede_id
- Tabla `sedes`: catálogo de sedes
- Tabla `siga_bienes`: base de conocimiento SIGA PJ (carga masiva vía Admin)
- Tabla `bien_historial`: historial de cambios en campos clave del bien
- Modelo: `ubicacion` como texto (nombre); registros antiguos pueden tener ID como string hasta normalizar

### Estructura de archivos relevantes (actualizada - Fase 17)

```
web/src/
├── components/
│   ├── ui/                             # ← shadcn/ui components
│   │   ├── button.tsx, input.tsx, card.tsx
│   │   ├── dialog.tsx, alert-dialog.tsx, form.tsx
│   │   ├── table.tsx, select.tsx, tabs.tsx
│   │   ├── badge.tsx, progress.tsx, separator.tsx
│   │   └── ... (20+ componentes)
│   ├── Layout.tsx              # Barra navegación + sede + theme toggle
│   ├── AuthGuard.tsx           # Sesión requerida
│   ├── AuthenticatedShell.tsx  # SedeSelector si no hay sede
│   ├── RoleGuard.tsx           # admin / operador / consulta
│   ├── BienForm.tsx            # ← react-hook-form + zod
│   ├── BienDetail.tsx          # ← Card, Tabs, Table (shadcn/ui)
│   ├── DuplicateAlert.tsx      # ← AlertDialog, Badge (shadcn/ui)
│   ├── NombreSearchableInput.tsx  # ← Command/Combobox
│   ├── BarcodeScanModal.tsx    # ← Dialog (shadcn/ui)
│   ├── BarcodeScanner.tsx
│   └── TrabajadorSearchableSelect.tsx # ← Popover + Command (shadcn/ui)
├── pages/
│   ├── Login.tsx / AuthCallback.tsx    # ← Form, AlertDialog
│   ├── SedeSelector.tsx
│   ├── Admin.tsx                       # ← Card, Progress, Table
│   ├── Scan.tsx / Search.tsx           # ← Card, Button, Table
│   ├── Security.tsx                    # ← Table, AlertDialog, Dialog
│   └── ...
├── context/
│   ├── AuthContext.tsx
│   ├── SedeContext.tsx
│   └── CatalogContext.tsx
├── hooks/
│   └── useWebAuthn.ts
├── lib/
│   └── utils.ts                # ← cn() para clases dinámicas
├── index.css                   # ← CSS variables (light/dark mode)
├── main.tsx                    # ← ThemeProvider
└── App.tsx                     # ← Rutas + guards
```

**Nota:** `components.json` en raíz configura los alias (`@/components`, `@/ui`, etc.)

---

## Checklist de validación (Fase 12)

- ✅ Escaneo con Quagga2 activo
- ✅ Modal cierra y libera cámara
- ✅ Input manual de código funciona
- ✅ Copiar genera formato legible
- ✅ Exportación CSV incluye estado
- ✅ Exportación JSON normaliza ubicaciones
- ✅ Descarga todo en bloques 1000
- ✅ Responsables resueltos correctamente
- ✅ Ubicaciones antiguas (ID) se convierten a nombres
- ✅ Build sin errores
- ✅ PWA instalable
- ✅ Mobile-first responsive

---

## Notas de mantenimiento

### Datos heredados
Si hay bienes con `ubicacion` como número (ID), el código resuelve automáticamente con:
```javascript
const findUbicacionNombre = (ubicacionRaw) => {
  if (!ubicacionRaw) return null
  const asNumber = Number(ubicacionRaw)
  if (!Number.isNaN(asNumber)) {
    const byId = ubicaciones.find((u) => u.id === asNumber)
    return byId?.nombre ?? ubicacionRaw
  }
  return ubicacionRaw
}
```

### Bienes existentes sin sede_id
Los bienes registrados antes de la Fase 14 tendrán `sede_id = NULL`. Opciones:
1. Asignarlos manualmente a la sede original vía SQL
2. Mostrarlos en búsqueda "todas las sedes" solamente
3. Asignar masivamente si todos eran de una sola sede:
```sql
UPDATE bienes SET sede_id = 1 WHERE sede_id IS NULL;
-- Cambiar "1" por el id real de la sede original
```

### Columnas SIGA en el Excel real
Los nombres de columnas pueden variar: mantener actualizado el `COLUMN_MAP` en `web/src/pages/Admin.tsx` (incluye variante **USUARIO**).

### Backfill de ubicaciones (opcional)
Si se desea normalizar toda la BD a nombres:
```sql
UPDATE bienes 
SET ubicacion = u.nombre 
FROM ubicaciones u 
WHERE CAST(bienes.ubicacion AS INTEGER) = u.id;
```

### Rendimiento esperado
- Búsqueda de duplicado: < 200ms (índice)
- Búsqueda con filtros: < 1s (paginación)
- Exportación 1000 registros: < 3s (bloqueado)
- Consulta SIGA al escanear: < 300ms (índice en codigo_patrimonial)
- Carga Excel SIGA 5000 registros: < 30s (bloques 500)