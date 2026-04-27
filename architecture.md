# Arquitectura — Inventario Patrimonial (inv-web)

## Visión general

Sistema web moderno de inventario patrimonial con escaneo de códigos de barras, registro de bienes, búsqueda avanzada y gestión multi-usuario. Stack moderno: React 19 + Vite 6, Tailwind CSS v4, Supabase (PostgreSQL), Edge Functions.

## Estructura de directorios

```
inv-web/
├── web/                          # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.tsx         # Sidebar + header + navegación
│   │   │   ├── BienForm.tsx       # Formulario crear/editar bien
│   │   │   ├── BarcodeScanner.tsx # Escaneo de códigos
│   │   │   ├── DuplicateAlert.tsx # Alerta de duplicados
│   │   │   ├── AdminSigaPanel.tsx # Carga masiva Excel SIGA
│   │   │   ├── AdminUsuarios.tsx  # Gestión usuarios (admin)
│   │   │   ├── AIChatPanel.tsx    # Chat IA lateral
│   │   │   ├── QuickEditBienDialog.tsx # Edición rápida (1 campo)
│   │   │   └── ui/                # Componentes shadcn/ui
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── Scan.tsx           # Modal escaneo
│   │   │   ├── Registro.tsx       # Crear bien
│   │   │   ├── Search.tsx         # Búsqueda + filtros avanzados
│   │   │   ├── BienDetail.tsx     # Ver/editar/eliminar bien
│   │   │   ├── EditarBien.tsx     # Alias a BienForm en edit mode
│   │   │   ├── Security.tsx       # Gestión passkeys
│   │   │   ├── Trabajadores.tsx   # CRUD trabajadores
│   │   │   ├── Admin.tsx          # Panel admin
│   │   │   ├── SigaPJ.tsx         # Nueva: Consulta base SIGA
│   │   │   ├── Login.tsx
│   │   │   └── AuthCallback.tsx
│   │   ├── context/
│   │   │   ├── AuthContext.tsx    # Auth + perfil usuario
│   │   │   ├── SedeContext.tsx    # Sede activa
│   │   │   ├── CatalogContext.tsx # Trabajadores + ubicaciones (caché)
│   │   │   └── CameraContext.tsx  # Estado cámara
│   │   ├── hooks/
│   │   │   ├── useBarcodeScanner.ts
│   │   │   ├── useWebAuthn.ts
│   │   │   └── useAIChat.ts
│   │   ├── lib/
│   │   │   ├── supabaseClient.ts
│   │   │   ├── passkeysApi.ts
│   │   │   ├── adminUsersApi.ts
│   │   │   └── utils.ts (cn, etc.)
│   │   ├── types/
│   │   │   └── index.ts (AppRole, UserPasskey, etc.)
│   │   ├── App.tsx
│   │   ├── main.tsx (con Toaster de sonner)
│   │   └── index.css (con @theme inline para Tailwind v4)
│   ├── public/
│   └── vite.config.ts
├── supabase/
│   ├── functions/
│   │   ├── passkeys/        # WebAuthn registration + authentication
│   │   ├── admin-users/     # Invitación + gestión usuarios
│   │   └── ai-chat/         # Chat IA (Gemini API with billing, camelCase format)
│   └── migrations/ (o sql/)
├── sql/
│   ├── 001_auth_perfiles_rls.sql
│   ├── 002_admin_list_auth_users_rpc.sql
│   ├── 003_auth_user_id_by_email_rpc.sql
│   └── 004_acceso_estado.sql
├── CLAUDE.md         # Contexto para IA
├── architecture.md   # Este archivo
├── PRD.md           # Requerimientos de producto
├── design.md        # Especificación de diseño UI/UX
└── package.json
```

## Flujos principales

### 1. Autenticación y acceso

```
Usuario sin sesión
  ↓
/login (correo → OTP o passkey)
  ↓
Código válido + aprobación pendiente?
  ↓
AuthGuard redirige a /pending
  ↓
Admin aprueba en /admin → acceso_estado = 'activo'
  ↓
RLS permite lectura/escritura a datos del usuario
  ↓
Layout + navegación habilitada
```

**Componentes:** `AuthGuard`, `AuthCallback`, `Login`, `Security`

### 2. Registro de bien

```
Home → "Registrar bien"
  ↓
Scan (modal con cámara/BarcodeDetector)
  ↓
Código leído → Duplicado?
  ↓
SÍ: DuplicateAlert (Ver/Editar/Registrar otro)
NO: BienForm (create mode)
  ↓
Al escribir código patrimonial:
  - 500ms debounce → lookup en siga_bienes
  - Si existe → auto-rellena marca, modelo, etc.
  ↓
Validar + AlertDialog confirmación
  ↓
Insertar en bienes + registrar en bien_historial
  ↓
Redirigir a BienDetail
```

**Componentes:** `BarcodeScanModal`, `DuplicateAlert`, `BienForm`

### 3. Búsqueda avanzada

```
/search
  ↓
Desktop: todos los filtros visibles
Mobile: solo código, botón "Filtros avanzados" para expandir
  ↓
Filtros: código, tipo, trabajador, ubicación, marca, modelo, sed(es)
  ↓
Botón "Buscar" → query con ILIKE + paginación
  ↓
Mostrar resultados en tabla (desktop) o cards (mobile)
  ↓
Menú ⋮ por fila: Ver detalle, Editar estado/responsable/ubicación
  ↓
QuickEditBienDialog para ediciones de 1 campo
  ↓
Botón "Copiar JSON/CSV" → toast "Copiado" + Sonner
```

**Componentes:** `Search`, `QuickEditBienDialog`

### 4. Consulta base SIGA PJ

```
/siga-pj (nueva)
  ↓
Subtítulo muestra "Datos actualizados al [fecha]"
  (último updated_at o created_at de siga_bienes)
  ↓
3 filtros ILIKE: código, descripción, responsable
  ↓
Botón "Buscar" → query paginada (25/página)
  ↓
Tabla con: Código, Descripción, Marca, Modelo, Serie, Responsable, OC, Valor
  ↓
Navegación de páginas (Anterior/Siguiente)
```

**Componentes:** `SigaPJ` (nuevo)

### 5. Carga masiva SIGA

```
Admin → "Base SIGA PJ"
  ↓
Upload Excel (.xlsx)
  ↓
Detectar columnas automáticamente (COLUMN_MAP)
  ↓
Mapear a SigaRow (codigo_patrimonial, descripcion, etc.)
  ↓
Vista previa (primeras 5 filas)
  ↓
Botón "Confirmar carga" → AlertDialog con número de registros
  ↓
Upsert en batch (500 por vez) con updated_at = now()
  ↓
Mostrar progreso y resumen (exitosos/errores)
```

**Componentes:** `AdminSigaPanel`

### 6. Gestión de usuarios (admin)

```
/admin → "Usuarios del sistema"
  ↓
Input email + select rol → botón "Invitar"
  ↓
AlertDialog confirmación
  ↓
Edge Function admin-users: crear usuario en auth + perfil en estado 'pendiente'
  ↓
Tabla de usuarios: cambiar rol, aprobar/rechazar/suspender/reactivar
  ↓
Cada acción → AlertDialog con descripción específica
  ↓
RLS valida permisos vía is_session_active() + acceso_estado = 'activo'
```

**Componentes:** `AdminUsuarios` (refactorizado con ConfirmAction)

### 7. Seguridad (passkeys)

```
/security
  ↓
Listar passkeys registradas (dispositivo, fecha)
  ↓
Botón "Registrar passkey" (si soportado)
  ↓
WebAuthn en navegador
  ↓
Guardar en user_passkeys vía Edge Function passkeys
  ↓
Botón "Revocar" por passkey → AlertDialog
  ↓
Delete en user_passkeys
```

**Componentes:** `Security` (con AlertDialog)

## Tablas principales (Supabase)

| Tabla | Descripción | Campos clave |
|-------|-------------|--------------|
| `auth.users` | Usuarios de autenticación | id, email |
| `public.perfiles` | Perfil de usuario | id (fk auth), app_role, acceso_estado, nombre, activo |
| `public.bienes` | Inventario de bienes | id, codigo_patrimonial (índice), nombre_mueble_equipo, estado, id_trabajador, ubicacion, sede_id, eliminado_at |
| `public.bien_historial` | Auditoría de cambios | bien_id, campo, valor_antes, valor_despues, usuario_id, accion, fecha |
| `public.trabajadores` | Personal responsable | id, nombre, activo, sede_id |
| `public.ubicaciones` | Localizaciones | id, nombre, sede_id |
| `public.sedes` | Sedes/sucursales | id, nombre |
| `public.siga_bienes` | Catálogo SIGA (solo lectura) | codigo_patrimonial, descripcion, marca, modelo, serie, usuario, orden_compra, valor, updated_at, created_at |
| `public.user_passkeys` | WebAuthn credentials | id, user_id, credential_id, credential_public_key, device_name, created_at, last_used_at, revoked_at |

## Patrones de diseño

### Estados con AlertDialog
Patrón para acciones críticas (confirmar antes de ejecutar):
- Estado: `targetId` / `confirmAction` / `showDialog`
- Botón setea estado → AlertDialog abre
- Usuario confirma → ejecuta acción
- `onOpenChange` cierra con Escape/click fuera

**Ubicaciones:** `Security.tsx` (revocar passkey), `AdminUsuarios.tsx` (invite/role/acceso), `BienForm.tsx` (guardar en edit), `AdminSigaPanel.tsx` (confirmar carga), `Trabajadores.tsx` (crear/editar)

### Búsqueda silenciosa con debounce
Usado en `BienForm.tsx` para SIGA lookup:
- `useRef` para guardar timer
- `useEffect` con 500ms setTimeout
- Cleanup limpia timeout anterior
- Dependen intencionales omitidas para evitar loops

### Sidebar colapsable con persistencia
`Layout.tsx`:
- `sidebarCollapsed` state inicializado desde localStorage
- `useEffect` persiste cambios
- Contenido interno en div con `overflow-hidden` para no derramar durante transición
- Botón toggle con `position: absolute` para sobresalir

## Seguridad

- **RLS:** todas las tablas sensibles tienen políticas estrictas por rol + sesión activa
- **Auth:** OTP + passkeys, sin contraseñas
- **Aprobación:** nuevos usuarios en estado `pendiente` hasta admin apruebe
- **Soft delete:** `eliminado_at` en lugar de DELETE físico
- **Auditoría:** `bien_historial` registra cada cambio con usuario + timestamp

## Performance

- **Paginación:** búsquedas con `.range()` (25-100 items/página)
- **Caché:** `CatalogContext` almacena trabajadores + ubicaciones en memoria (se refrescan entre dispositivos con TTL corto)
- **Lazy load:** cámara solo activa al abrir modal
- **Batch:** carga masiva SIGA en bloques de 500 registros
- **Índices:** recomendado en `codigo_patrimonial` para duplicados

## Deploy

- **Frontend:** Vercel (rama `main` auto-deploy)
- **Edge Functions:** `supabase functions deploy` o MCP
- **Variables de entorno:**
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  - `VITE_TURNSTILE_SITE_KEY` (opcional, si CAPTCHA activo)
  - Secretos en Supabase: `GROQ_API_KEY` (para IA), `PASSKEY_EXTRA_HOSTS` (orígenes WebAuthn)

## Mejoras recientes (2026-04-23)

1. **Sidebar toggle desktop** — botón colapsa/expande, persistido en localStorage
2. **Filtros móvil colapsables** — solo código patrimonial visible, resto bajo "Filtros avanzados"
3. **Feedback copiar mejorado** — botón cambia a verde + check + toast
4. **Carga SIGA silenciosa** — auto-rellena campos al escribir código (500ms debounce)
5. **Página SIGA PJ** — nueva ruta `/siga-pj` con búsqueda paginada de catálogo
6. **Modales de confirmación** — AlertDialog en 6 flujos críticos
7. **Fecha de actualización SIGA** — en subtítulo, fallback a created_at o fecha actual
8. **Fixes Tailwind v4** — `@theme inline` en index.css, dark mode contraste mejorado
9. **Chat IA con Gemini 2.5 Flash** — Panel Sheet lateral (icono Bot) con Badge "Beta" usando Edge Function `ai-chat`, modelo `gemini-2.5-flash` (camelCase API, thinking deshabilitado), agentic loop máximo 5 iteraciones, 4 tools para consultas (buscar exacto, búsqueda filtrada, conteos, listar por responsable), deduplicación de thought parts, fallback sin tools si agota iteraciones
10. **Búsqueda con persistencia URL** — Filtros guardados en URL (`/search?codigo=X&...`), restauración al volver de detalle, refetch automático desde Supabase
11. **Fix paginación Search** — Reemplazado setTimeout stale closure por patrón setPendingSearch + useEffect, arregla bug donde página anterior se re-consultaba
12. **NombreSearchableInput refinado** — Solo busca si usuario tipea manualmente (userTypedRef), deduplicación por descripción, previene reapertura al seleccionar

## Fixes (2026-04-24)

1. **CORS en Edge Function admin-users**
   - **Problema:** Método PATCH fallaba con "Failed to send a request to the Edge Function" — preflight CORS del navegador rechazaba porque la función no declaraba `Access-Control-Allow-Methods`
   - **Solución:** Agregadas headers CORS en `supabase/functions/admin-users/index.ts`: `Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS` y `Access-Control-Max-Age: 86400`
   - **Impacto:** Flujo Aprobar/Rechazar/Suspender usuarios en `/admin` ahora funciona correctamente

2. **Error handling mejorado en AdminUsuarios**
   - **Problema:** Botones de acción genéricos: "No se pudo actualizar el estado de acceso." sin detalles del servidor
   - **Solución:** Mejorado catch en `executeRoleChange` y `executeAccesoChange` para incluir `e.message` en el error visible
   - **Impacto:** Usuarios ven errores reales (RLS, validación, permisos) ayudando a diagnóstico

3. **Chat IA acceso para consulta confirmado**
   - **Verificado:** Rol `consulta` ya tiene acceso sin restricción — Layout renderiza botón para todos los roles, `ai-chat` usa `service_role`
   - **Status:** Funcionando correctamente sin cambios necesarios

## Mejoras (2026-04-27)

1. **Rediseño BienDetail.tsx: layout 2 columnas en desktop**
   - **Desktop (lg+):** Grid de 2 columnas (`lg:grid-cols-2 lg:items-start`) — detalle a la izquierda, historial de cambios a la derecha. Contenedor ampliado a `lg:max-w-6xl`.
   - **Móvil:** una sola columna, orden natural: detalle completo, luego historial.
   - **Sección SIGA PJ colapsable en móvil:** botón con chevron rotatorio (cerrado por defecto en móvil, siempre visible en desktop con `lg:block`).
   - **Archivo:** `web/src/pages/BienDetail.tsx`

2. **QuickEditBienDialog: precarga estado actual al abrir**
   - **Problema:** Al abrir dialog de edición rápida, el campo no mostraba el valor actual (p. ej. "Regular" en Estado)
   - **Causa:** `useState` se inicializaba solo en el primer render; cuando `target` cambiaba, el estado local no se resincronizaba
   - **Solución:** Agregado `useEffect` que sincroniza `nuevoEstado`, `nuevoIdTrabajador` y `nuevoIdUbicacion` cada vez que `target` cambia
   - **Impacto:** Dialog precarga correctamente el valor actual de cada campo
   - **Archivo:** `web/src/components/QuickEditBienDialog.tsx`

