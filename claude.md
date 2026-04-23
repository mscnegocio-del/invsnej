# Claude - Contexto del proyecto inv-web

## ¿Qué es este proyecto?

App web de inventario patrimonial para móvil. Permite escanear códigos de barras, registrar bienes en Supabase, validar duplicados y realizar CRUD completo (crear, leer, editar, eliminar).

**Código de la app:** carpeta `web/` (Vite + React). El repo puede tener scripts y SQL en la raíz.

## Stack

- React 19 + Vite 6 (`web/`)
- Tailwind CSS 4 + **shadcn/ui** (componentes composables)
- **Lucide React** — iconografía moderna (integrada con shadcn/ui)
- **next-themes** — soporte dark mode / light mode
- Supabase (`@supabase/supabase-js`)
- **Edge Functions (Supabase):** `passkeys` (WebAuthn/passkeys + `@simplewebauthn/server`), `admin-users` (admin)
- **@simplewebauthn/browser** en el cliente (`useWebAuthn`, `Login`, `Security`)
- **@marsidev/react-turnstile** — CAPTCHA en `/login` si `VITE_TURNSTILE_SITE_KEY` está definida y CAPTCHA está activo en Supabase Auth
- **Quagga2** para fallback de escaneo (cuando BarcodeDetector no está disponible)
- BarcodeDetector API (nativa en navegadores soportados)
- **SheetJS** (`xlsx`) — parseo de Excel SIGA para carga masiva
- **react-hook-form** + **zod** — validación de formularios
- Deploy frontend: **Vercel**
- PWA con service workers

## Base de datos (Supabase)

- **Proyecto**: inventario (ID: `hegtvsuscaaifqqhbbxq`)
- **Tablas principales**: bienes, trabajadores, ubicaciones; multi-sede (`sedes`, `bienes.sede_id`); catálogo SIGA (`siga_bienes`); historial (`bien_historial`)
- **Passkeys (auth):** `user_passkeys`, `auth_webauthn_challenges`
- **bienes.codigo_patrimonial**: identificador del barcode. Usar para validar duplicados.
- **bienes.ubicacion**: texto (nombre de ubicación, no ID)
- **bienes.estado**: Nuevo, Bueno, Regular, Malo, Muy malo
- **Recomendado**: índice en `codigo_patrimonial` para búsquedas rápidas.

### SQL en repo (`sql/`)

- `001_auth_perfiles_rls.sql` — perfiles/roles y RLS
- `002_admin_list_auth_users_rpc.sql` — RPC para admin (listado usuarios sin `listUsers` roto)
- `003_auth_user_id_by_email_rpc.sql` — RPC `public.auth_user_id_by_email` (solo `service_role`) para la Edge `passkeys` (buscar usuario por email sin `auth.admin.listUsers`)
- `004_acceso_estado.sql` — columna `perfiles.acceso_estado` (`pendiente` | `activo` | `rechazado`); RLS vía `is_session_active()` solo con `acceso_estado = 'activo'` y `activo = true`; nuevos usuarios en `pendiente` hasta que un admin apruebe

## Autenticación (implementado)

- **Altas:** desactivar **Allow new users to sign up** en Supabase (solo usuarios existentes / invitados). El cliente usa `signInWithOtp` con **`shouldCreateUser: false`**.
- **Aprobación:** invitación (`admin-users` POST) deja el perfil en **`pendiente`**; el admin **Aprueba** / **Rechaza** / **Suspende** / **Reactiva** en `/admin`. Sin aprobación, `AuthGuard` muestra mensaje de pendiente y no hay acceso a datos (RLS).
- **Login (`/login`):** correo → **código OTP** (`signInWithOtp` + `verifyOtp` tipo `email`) con **CAPTCHA Turnstile** si hay `VITE_TURNSTILE_SITE_KEY`. Opción **Continuar con passkey** si el dispositivo soporta WebAuthn y hay passkeys registradas.
- **Passkeys:** registro y uso vía Edge Function `passkeys` (`start_registration` / `finish_registration` con sesión; `start_authentication` / `finish_authentication` con email + origen). Tras WebAuthn en login, la función crea sesión con `generateLink` + `verifyOtp` (correo canónico desde `auth.users`).
- **Seguridad (`/security`):** listar passkeys, registrar otra, revocar (requiere sesión).
- **Callback:** `/auth/callback` para redirects de Auth (p. ej. enlaces mágicos legacy).
- **Guards:** `AuthGuard`, `RoleGuard` (admin / operador / consulta), `AuthenticatedShell`.

### Auth (Supabase Dashboard)

- **Site URL** y **Redirect URLs** deben incluir la URL de producción/preview y `…/auth/callback`.
- **User signups:** desactivados (solo invitación / usuarios ya creados).
- **CAPTCHA:** Authentication → Bot and Abuse Protection → activar protección, elegir **Turnstile** (o hCaptcha), pegar **secret** del proveedor. En el front, variable **`VITE_TURNSTILE_SITE_KEY`** (site key pública). Dominios permitidos en Cloudflare deben incluir producción y `localhost` para desarrollo.
- Edge `passkeys`: **`verify_jwt: false`** (la función valida sesión con anon + JWT en rutas autenticadas; login por passkey no lleva sesión al inicio).

### Orígenes permitidos (Passkeys)

La función valida `Origin` / `rpID`: hosts por defecto incluyen `invsnej.vercel.app`, `www.invsnej.vercel.app`, `localhost`, `127.0.0.1`, cualquier **`*.vercel.app`**, y lista extra por secreto **`PASSKEY_EXTRA_HOSTS`** (hosts separados por comas). Dominio propio no `*.vercel.app`: añadir en `PASSKEY_EXTRA_HOSTS`.

### Detalle técnico (@simplewebauthn/server v13)

- En **`generateAuthenticationOptions`**, `allowCredentials[].id` debe ser **string base64url** (el `credential_id` guardado). No usar `isoBase64URL.toBuffer()` ahí (provoca `input.replace is not a function` en `isBase64URL`).

### Checklist de seguridad (pendientes / revisión)

- **RLS estricto** en todas las tablas sensibles; alinear con roles de la app.
- **CORS** producción: dominios oficiales de la app.
- **Auditoría** y **rate limiting** en endpoints sensibles (mejora continua).

## Reglas de negocio clave

1. **Duplicados**: Antes de crear, consultar si `codigo_patrimonial` existe. Si existe → alerta con opciones Ver detalle / Editar / Registrar otro.
2. **Estado**: Solo valores: Nuevo, Bueno, Regular, Malo, Muy malo. Incluye en exportaciones.
3. **Responsable**: FK a `trabajadores.id`. Se resuelve nombre en visualización y exportación.
4. **Ubicación**: texto en bienes. Se resuelve desde catálogo si vienen como ID antiguos.
5. **Delete**: Preferir soft delete (`eliminado_at`) sobre DELETE físico.
6. **Cámara**: Solo activa cuando se abre modal de escaneo, se libera al cerrar (ahorro de batería).

## Estructura esperada (`web/src/`)

```
web/src/
├── components/
│   ├── BarcodeScanner.tsx, BarcodeScanModal.tsx, DuplicateAlert.tsx
│   ├── BienForm.tsx, BienDetail.tsx (componentes)
│   ├── TrabajadorSearchableSelect.tsx, UbicacionSelect.tsx, Layout.tsx
│   ├── AuthGuard.tsx, AuthCallback.tsx, AuthenticatedShell.tsx, RoleGuard.tsx
│   └── ...
├── pages/
│   ├── Home.tsx, Scan.tsx, Registro.tsx, Search.tsx
│   ├── BienDetail.tsx, EditarBien.tsx, Admin.tsx
│   ├── Login.tsx, AuthCallback.tsx, Security.tsx
│   └── ...
├── lib/
│   ├── supabaseClient.ts
│   ├── passkeysApi.ts       # invoke Edge passkeys
│   └── adminUsersApi.ts
├── context/
│   ├── AuthContext.tsx, CameraContext.tsx, CatalogContext.tsx, SedeContext.tsx
├── hooks/
│   ├── useBarcodeScanner.ts, useWebAuthn.ts
│   └── ...
└── App.tsx
```

## Flujo principal (inventario)

1. **Home** → "Registrar bien" o "Buscar"
2. **Scan** → código → duplicado o `Registro` con `BienForm`
3. **Búsqueda** → filtros + exportación
4. **Detalle** → Ver / Editar / Eliminar

## Flujo de acceso

1. **`/login`:** correo → CAPTCHA (si aplica) → enviar código → introducir OTP (`shouldCreateUser: false`); o **Continuar con passkey** (mismo correo).
2. **Invitación** → usuario en **pendiente** hasta aprobación en `/admin`.
3. **Sesión aprobada** → navegación con `Layout`; **Seguridad** para gestionar passkeys.

## Rendimiento (1900+ registros)

- Duplicados: índice + `.maybeSingle()`
- Selectores: cache en `CatalogContext` (TTL corto para refresco entre dispositivos)
- Búsqueda/listado: paginación `.range(...)`
- Exportación completa: bloques de 1000 (límite Supabase)
- Cámara: solo en modal

## Exportación y compartibilidad

- Copiar para compartir, JSON, CSV, bloques 1000 en exportación masiva

## Componentes UI (shadcn/ui)

- **Componentes base:** `Button`, `Input`, `Select`, `Card`, `Dialog`, `AlertDialog`, `Tabs`, `Table`, `Popover`
- **Ubicación:** `web/src/components/ui/` — importar desde `@/components/ui`
- **Iconos:** Lucide React (`lucide-react`) — ej. `<Home className="h-4 w-4" />`
- **Temas:** light/dark vía `next-themes` + `useTheme()` hook
- **Configuración:** `web/components.json` — alias, tailwind, icons

## Convenciones

- Componentes funcionales + hooks + **shadcn/ui**
- Usar `cn()` (de `@/lib/utils`) para combinar clases Tailwind dinámicamente
- **Form handling:** react-hook-form + zod (en `BienForm`, `Login`, etc.)
- **Variantes UI:** usar `variant` y `size` en componentes shadcn/ui (ej. `<Button variant="ghost" size="icon">`)
- Variables de entorno: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, opcional `VITE_TURNSTILE_SITE_KEY` (requerida si CAPTCHA está activo en el proyecto Supabase)
- Idioma de la UI: español
- Input de ubicación: nombre (string), no ID, resolviendo desde catálogo
- **Dark mode:** tema se persiste en localStorage vía next-themes; aplicar `dark:` en CSS cuando sea necesario

## Fixes y mejoras recientes (2026-04-17)

### Tailwind CSS v4 — @theme inline
- **Problema:** Tailwind CSS v4 requiere `@theme` para que clases como `bg-popover`, `bg-background`, `bg-card` resuelvan variables CSS. Sin él, componentes como Dialog, Popover, DropdownMenu, Select tenían fondos transparentes.
- **Solución:** Agregado bloque `@theme inline` en `web/src/index.css` que mapea todas las variables CSS (`--background`, `--popover`, `--card`, `--foreground`, etc.) como colores de Tailwind.
- **Archivos:** `web/src/index.css` (línea 3-30)
- **Impacto:** Todos los componentes UI que usan utilidades de color Tailwind ahora funcionan correctamente en light/dark mode.

### Dialog y AlertDialog — mejor contraste en dark mode
- **Cambio:** `bg-background` → `bg-card` en `DialogContent` y `AlertDialogContent`
- **Razón:** En dark mode, `--background: oklch(0.145 0)` (casi negro) se confunde visualmente con el overlay `bg-black/60`. `--card: oklch(0.205 0)` es ligeramente más claro y más distinguible.
- **Archivos:** `web/src/components/ui/dialog.tsx` (línea 35), `web/src/components/ui/alert-dialog.tsx` (línea 34)

### Button variant en Trabajadores — mejor contraste
- **Cambio:** `variant="ghost"` → `variant="outline"` en botón "Cancelar" del diálogo de edición de trabajadores
- **Razón:** `ghost` puede ser muy claro en light mode. `outline` tiene borde visible que mejora el contraste.
- **Archivo:** `web/src/pages/Trabajadores.tsx` (línea 350)

### Quick Edit Dialog en Search
- **Feature:** Menú ⋮ (DropdownMenu) en cada fila/card de resultados de búsqueda con opciones: Ver detalle, Editar estado, Editar responsable, Editar ubicación.
- **Componente nuevo:** `web/src/components/QuickEditBienDialog.tsx` — dialog modal para editar 1 campo de un bien.
- **Integración:** `web/src/pages/Search.tsx` — estado `quickEdit`, callback `handleQuickEditSaved`, renderizado de dialog y menús ⋮ en desktop (tabla) y móvil (cards).
- **Persistencia:** Actualiza Supabase, registra en `bien_historial` (campo, valor_antes, valor_despues, usuario), y actualiza el item local sin recargar.

### TrabajadorSearchableSelect — popover collision avoidance
- **Configuración:** `PopoverContent` con `z-50`, `align="start"`, `sideOffset={8}`, `avoidCollisions={true}` para evitar que se superponga con otros campos en filtros (especialmente en móvil).
- **Archivo:** `web/src/components/TrabajadorSearchableSelect.tsx` (línea 116)

### Chat IA — Asistente de inventario (2026-04-17, actualizado 2026-04-23)

- **Feature:** Panel lateral derecho (Sheet) con chat IA para consultas de bienes en lenguaje natural.
- **Modelo:** `llama-3.1-8b-instant` vía Groq API (cambio de 70b para optimizar tokens en Groq Free).
- **Arquitectura:** Frontend → Supabase Edge Function `ai-chat` → Groq API → consultas Supabase service_role.
- **Archivos:**
  - `supabase/functions/ai-chat/index.ts` — Edge Function con agentic loop (tool use), MAX_ITERACIONES = 4
  - `web/src/hooks/useAIChat.ts` — hook, historial en memoria (se pierde al cerrar/recargar)
  - `web/src/components/AIChatPanel.tsx` — panel Sheet lado derecho
  - `web/src/components/Layout.tsx` — icono Bot en header móvil, bottom nav (item "IA") y sidebar desktop
- **Variable de entorno requerida en Supabase Secrets:** `GROQ_API_KEY=gsk_...`
- **Tools disponibles:** `buscar_bien_por_codigo`, `buscar_bienes`, `contar_bienes`, `listar_bienes_por_responsable`
- **Solo lectura:** el asistente no puede editar ni crear bienes.
- **Historial:** solo durante la sesión/ventana abierta; se pierde al recargar.
- **Acceso:** todos los roles (admin, operador, consulta) pueden usar el chat.

**Mejoras (2026-04-23):**
- Modelo downgraded de 70b a 8b-instant: ~6x menos tokens por pregunta (3K vs 19.4K) → mejor para Groq Free
- MAX_ITERACIONES reducido de 5 a 4: menos llamadas a Groq por pregunta compleja
- SYSTEM_PROMPT mejorado: mantiene contexto de responsables en preguntas de seguimiento, evita confusión entre diferentes trabajadores
- Comportamiento: Si el usuario pregunta por "Milton" y luego "¿cuántas computadoras?", el asistente asume que se refiere a Milton (contexto histórico)
- Si hay ambigüedad real, el asistente pregunta aclaración antes de responder

### Mejoras UX/funcionales — 2026-04-22

#### Sidebar desktop toggle
- **Feature:** Botón circular en el borde del sidebar colapsa/expande a modo icono (w-14) o completo (w-64).
- **Estado:** `sidebarCollapsed` en `Layout.tsx`, persistido en `localStorage('sidebar_collapsed')`.
- **Contenido principal:** margin-left dinámico `md:ml-14` / `md:ml-64` con `transition-all duration-200`.
- **Pitfall:** `overflow-hidden` en `<aside>` recorta el botón toggle que sobresale con `-right-3`. Solución: quitar `overflow-hidden` del `<aside>` y envolverlo en un `<div className="flex flex-col flex-1 overflow-hidden min-h-0">` interno que contiene logo/nav/footer, dejando el botón fuera de ese div.
- **Archivo:** `web/src/components/Layout.tsx`

#### Filtros móvil colapsables en Search
- **Feature:** En móvil solo aparece el campo "Código patrimonial". Botón "Filtros avanzados" despliega el resto con contador de filtros activos.
- **Implementación:** Estado `showAdvancedFilters`, clase `hidden lg:block` para visibilidad desktop siempre activa.
- **Archivo:** `web/src/pages/Search.tsx`

#### Feedback visual al copiar (Search)
- **Cambio:** Botón Copiar cambia a ícono ✓ verde + "Copiado" mientras `copied=true`; añade `toast.success('Copiado al portapapeles')` via Sonner.
- **Archivo:** `web/src/pages/Search.tsx`

#### Carga SIGA silenciosa por código patrimonial (BienForm)
- **Feature:** Al escribir en el campo `codigo_patrimonial` en modo `create`, después de 500ms hace lookup exacto en `siga_bienes`. Si existe, rellena automáticamente marca, modelo, serie, OC y valor (solo campos vacíos).
- **No muestra lista:** carga silenciosa y automática, sin popup de sugerencias.
- **Archivo:** `web/src/components/BienForm.tsx` — `useEffect` con `sigaLookupRef` (debounce ref).

#### Página SIGA PJ
- **Feature:** Nueva ruta `/siga-pj` con búsqueda paginada (25/página) de la tabla `siga_bienes`.
- **Filtros:** código patrimonial (ILIKE), descripción (ILIKE), responsable/usuario (ILIKE). Búsqueda bajo demanda (botón Buscar, no auto-search).
- **Tabla:** scroll horizontal en móvil. Columnas: Código, Descripción, Marca, Modelo, Serie, Responsable, OC, Valor.
- **Fecha de actualización:** `useEffect` al montar consulta primer registro de `siga_bienes` con fallback a `created_at` o fecha actual. Se muestra en el subtítulo ("Datos actualizados al [fecha]"), no por fila. Implementación: `.select('*').limit(1).maybeSingle()` con `const fecha = (data.updated_at || data.created_at || new Date().toISOString())`.
- **`updated_at` en carga masiva:** `AdminSigaPanel.tsx` inyecta `updated_at: new Date().toISOString()` en cada fila del batch antes del upsert. `COLUMN_MAP` usa `Record<Exclude<keyof SigaRow, 'updated_at'>, string[]>` para excluir el campo (se inyecta en código, no viene del Excel).
- **Acceso:** todos los roles (admin, operador, consulta) — solo AuthGuard, sin RoleGuard adicional.
- **Archivo nuevo:** `web/src/pages/SigaPJ.tsx`
- **Ruta:** `web/src/App.tsx` — `<Route path="/siga-pj" element={<SigaPJ />} />`
- **Sidebar:** entrada "SIGA PJ" con icono `Database` en `navItemsAll` para los 3 roles. Bottom nav móvil se actualiza automáticamente.

#### Modales de confirmación (AlertDialog shadcn/ui)
Patrón: estado `target/confirmAction/showDialog` → botón setea estado → AlertDialog abre → usuario confirma → se ejecuta la acción. El AlertDialog usa `onOpenChange` para cerrar con Escape o click fuera.

- **Security.tsx** — `revokeTarget: string | null` controla el dialog antes de revocar passkey. El return usa Fragment `<>` para tener `<div>` + `<AlertDialog>` como hermanos.
- **AdminUsuarios.tsx** — tipo `ConfirmAction` unificado para: invite, role, acceso. Función `getConfirmTexts()` fuera del componente genera título/descripción/label/isDestructive por tipo. Handlers separados en `request*` (abre dialog) y `execute*` (ejecuta acción).
- **BienForm.tsx** — `showSaveConfirm: boolean`, solo en modo `edit`. `handleSubmit` refactorizado en `runValidation()` + `executeSubmit()` + `handleSubmit(event)`.
- **AdminSigaPanel.tsx** — `showConfirmDialog: boolean` antes de `handleConfirmar()`. La descripción incluye `allRows.length` para informar cuántos registros se actualizarán.
- **Trabajadores.tsx** — `showSaveConfirm: boolean`. `handleSave` llama `setShowSaveConfirm(true)` en vez de `ejecutarGuardado()` directo. El flujo con conflicto de sede (`sedeWarn`) sigue directo a `ejecutarGuardado` desde `confirmarSedeWarn` (usuario ya confirmó la advertencia). Añadido `AlertDialogDescription` al import.

#### Pitfall corregido — Security.tsx JSX
- `AlertDialog` quedó fuera del `<div>` principal. Solución: envolver el return en Fragment `<>` para que `<div>` y `<AlertDialog>` sean hermanos válidos sin un parent extra.

## Documentación externa

- **architecture.md** — Estructura de directorios, flujos principales, tablas BD, patrones de diseño, performance, seguridad
- **PRD.md** — Requerimientos funcionales y no funcionales, criterios de aceptación, métricas de éxito
- **design.md** — Paleta de colores, tipografía, componentes UI, responsive, accesibilidad, ejemplos de pantallas

## Deploy

- **Frontend:** Vercel (proyecto `web/` o monorepo según configuración).
- **Edge Functions:** `supabase functions deploy` o MCP Supabase `deploy_edge_function` (p. ej. `passkeys`, `admin-users`, `ai-chat`).
- **Variables de entorno:**
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  - `VITE_TURNSTILE_SITE_KEY` (opcional, si CAPTCHA activo en Supabase Auth)
  - En Supabase Secrets: `GROQ_API_KEY` (para Edge Function ai-chat), `PASSKEY_EXTRA_HOSTS` (hosts adicionales para WebAuthn)

## Sprint completado (2026-04-23)

**14 mejoras implementadas:**
1. ✅ Sidebar toggle desktop (colapsable, persistido)
2. ✅ Filtros móvil colapsables con contador
3. ✅ Feedback copiar mejorado (botón verde + toast)
4. ✅ Carga SIGA silenciosa por código (500ms debounce)
5. ✅ Página SIGA PJ (búsqueda paginada)
6. ✅ Entrada SIGA en sidebar para todos los roles
7. ✅ AlertDialog revocar passkey
8. ✅ AlertDialogs en gestión usuarios (invite/role/acceso)
9. ✅ AlertDialog guardar bien (edit mode)
10. ✅ AlertDialog carga masiva SIGA
11. ✅ AlertDialogs crear/editar trabajador
12. ✅ Chat IA Groq: Edge Function deployada con agentic loop
13. ✅ Optimización Chat IA: modelo 8b-instant, MAX_ITERACIONES = 4
14. ✅ Contexto en Chat IA: SYSTEM_PROMPT mejorado para mantener referencias a trabajadores

**Fixes Tailwind v4:**
- `@theme inline` en index.css para resolución de colores
- Contraste mejorado en Dialog/AlertDialog (`bg-card`)
- Button "Cancelar" en Trabajadores: `outline` en lugar de `ghost`

**Errores resueltos:**
- TypeScript: `Record<Exclude<keyof SigaRow, 'updated_at'>, string[]>` en COLUMN_MAP
- Security.tsx: Fragment `<>` para múltiples root JSX elements
- Layout.tsx: `overflow-hidden` movido a div interior para mostrar botón toggle
- Chat IA: Problema de confusión de contexto entre trabajadores (Milton vs Yaranga) → resuelto con mejoras en SYSTEM_PROMPT

**Chat IA — Groq optimizado (2026-04-23):**
- ✅ Deployada en Supabase usando Groq (llama-3.1-8b-instant)
- ✅ Agentic loop con **3 iteraciones máximas** (reducido de 4 → ~25% menos llamadas)
- ✅ `max_tokens: 800` (reducido de 1024 → menos tokens de salida facturados)
- ✅ Historial truncado a últimos 8 mensajes (evita que conversaciones largas inflen el costo)
- ✅ Mantiene contexto en conversaciones multi-turno
- ✅ 4 tools disponibles: buscar exacto, búsqueda filtrada, conteos, listar por responsable
- ✅ Ahorro estimado: ~33% menos tokens vs versión anterior
- ⚠️ Requiere `GROQ_API_KEY` en Supabase Secrets
- ℹ️ El prompt caching (Anthropic) no está disponible en Groq — no es aplicable

**Cambios CLAUDE.md:**
- Actualizado con todos los patrones implementados
- Detalles técnicos de cada mejora
- Fixes y pitfalls conocidos
- Status y configuración del Chat IA
