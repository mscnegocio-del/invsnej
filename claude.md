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

### Chat IA — Asistente de inventario (2026-04-17, actualizado 2026-04-24, Gemini 2.5 Flash)

- **Feature:** Panel lateral derecho (Sheet) con chat IA para consultas de bienes en lenguaje natural.
- **Modelo:** `gemini-2.5-flash` vía Google Gemini API con billing (requiere cuenta con billing activo).
- **Arquitectura:** Frontend → Supabase Edge Function `ai-chat` → Gemini API → consultas Supabase service_role.
- **Archivos:**
  - `supabase/functions/ai-chat/index.ts` — Edge Function con camelCase (Gemini API format), retry logic (exponential backoff), MAX_ITERACIONES = 5 (soporta multi-turn tool calls), maxOutputTokens = 500, thinkingConfig deshabilitado (optimiza tokens)
  - `web/src/hooks/useAIChat.ts` — hook, historial en memoria (se pierde al cerrar/recargar)
  - `web/src/components/AIChatPanel.tsx` — panel Sheet lado derecho, Badge "Beta", AlertDialog confirmación antes de limpiar
  - `web/src/components/Layout.tsx` — icono Bot en header móvil, bottom nav (item "IA") y sidebar desktop, Badge "Beta"
- **Variable de entorno requerida en Supabase Secrets:** `GEMINI_API_KEY=...` (requiere plan con billing/quota)
- **Tools disponibles:** `buscar_bien_por_codigo`, `buscar_bienes`, `contar_bienes`, `listar_bienes_por_responsable`
- **Solo lectura:** el asistente no puede editar ni crear bienes.
- **Historial:** solo durante la sesión/ventana abierta; se pierde al recargar.
- **Acceso:** todos los roles (admin, operador, consulta) pueden usar el chat.

**Mejoras técnicas (2026-04-24):**
- Cambio a `gemini-2.5-flash` (único modelo disponible para billing; 1.5 deprecado)
- camelCase en API: `functionCall`, `functionResponse`, `functionDeclarations`, `systemInstruction`, `thinkingConfig`
- `thinkingConfig: { thinkingBudget: 0 }` para deshabilitar thinking (optimiza tokens y simplifica formato)
- Deduplicación de thought parts en respuestas finales (filtro `!p.thought`)
- SYSTEM_PROMPT mejorado: solo fuerza herramientas para consultas de inventario, no para saludos
- MAX_ITERACIONES = 5 (antes 3): soporta 2-3 tool calls + respuesta final
- Fallback sin herramientas si el loop agota iteraciones sin generar texto
- Logging expandido en Edge Function para debugging de estructura de respuestas
- Fix en búsqueda de trabajadores: tokenización de nombres (split por espacios, AND lógico) — soporta "milton salcedo" para "SALCEDO CRUZ MILTON ALEJANDRO"

**Rate Limiting (Gemini with billing):**
- Límites según plan de billing (no free tier)
- Retry automático en 429 con exponential backoff (1s, 2s, 4s)
- UI muestra "Sin cuota disponible. Espera 1 minuto e intenta de nuevo" si persiste

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

#### Beta badge y UI refinements (2026-04-24)
- **Badge "Beta"** en chat ("Asistente IA BETA") y en app principal ("Inventario BETA")
  - Ubicación: `AIChatPanel.tsx` (header), `Layout.tsx` (sidebar desktop y header móvil)
  - Estilo: fondo amber/10, texto amber-600/dark:amber-400, uppercase, pequeño
- **iOS Safari zoom fix:** Textarea en chat tiene `text-base sm:text-sm` (16px móvil previene auto-zoom de Safari, 14px desktop)
  - Añadido `flex-1 min-w-0` para que textarea no desborde
- **AlertDialog "Limpiar conversación":** Confirmación antes de eliminar chat (ej. "¿Limpiar conversación? Se eliminarán todos los mensajes")
  - Implementado en `AIChatPanel.tsx` (estado `showClearConfirm`, AlertDialog shadcn)
  - Botón limpiar con `mr-7` para no sobreponerse con la X de cierre del Sheet

#### Búsqueda con persistencia en URL (2026-04-24 - Search.tsx)
- **Filtros en URL:** Al buscar, los filtros se guardan en URL (`/search?codigo=X&responsable=Y&nombres=Z|W...`)
  - Helper `writeFiltersToUrl()` genera URLSearchParams desde estado
  - Parámetros: `codigo`, `trabajador`, `ubicacion`, `marca`, `modelo`, `nombres` (pipe-separated), `todas` (1 o ausente), `p` (página)
- **Restauración al volver:** Mount effect lee URL → restaura estado → ejecuta búsqueda
  - Usuario navega a `/search?codigo=...` → vuelve desde detalle → remonta → read URL → refetch automático
  - Cambios hechos en detalle son visibles (Supabase re-consulta)
- **Arreglo del bug de paginación:** Reemplazado `setTimeout(handleSearch)` por patrón `setPendingSearch(true)` + useEffect
  - Antes: stale closure en `page` con setTimeout
  - Ahora: React flush de estado → re-render → effect corre handleSearch con estado actual
  - Afecta a `handleSubmit`, `handleNextPage`, `handlePrevPage`, `handleCodeScanned`

#### NombreSearchableInput — dedup y user-only search (2026-04-24)
- **Bug:** Popover mostraba 6+ duplicados de la misma descripción (siga_bienes tiene 1 fila/código)
- **Fixes:**
  - `userTypedRef`: solo busca si el usuario escribió manualmente, no en cambios programáticos (query params, autofill SIGA)
  - Deduplicación por `descripcion` usando `Map` antes de mostrar (keep first)
  - Al seleccionar sugerencia, `userTypedRef.current = false` previene reapertura del popover
- **Resultado:** Popover solo aparece cuando tipeas, con descripciones únicas

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
  - En Supabase Secrets: `GEMINI_API_KEY` (para Edge Function ai-chat con Gemini 2.5 Flash), `PASSKEY_EXTRA_HOSTS` (hosts adicionales para WebAuthn)

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

**Chat IA — Gemini 2.5 Flash (2026-04-24):**
- ✅ Migrado a Google Gemini 2.5 Flash (único modelo disponible con billing a abril 2026)
- ✅ Agentic loop con **5 iteraciones máximas** (soporta 2-3 tool calls + respuesta final)
- ✅ `maxOutputTokens: 500` (optimizado para respuestas concisas)
- ✅ `thinkingConfig: { thinkingBudget: 0 }` para deshabilitar thinking (simplifica estructura, ahorra tokens)
- ✅ camelCase en API: `functionCall`, `functionResponse`, `functionDeclarations`, `systemInstruction`
- ✅ Historial truncado a últimos 8 mensajes (evita que conversaciones largas inflen el costo)
- ✅ Mantiene contexto en conversaciones multi-turno
- ✅ 4 tools disponibles: buscar exacto, búsqueda filtrada, conteos, listar por responsable
- ✅ Deduplicación de thought parts en respuestas (si thinking estuviese habilitado)
- ✅ Retry automático en 429 con exponential backoff (1s, 2s, 4s)
- ⚠️ Requiere `GEMINI_API_KEY` con billing activo en Supabase Secrets
- ℹ️ Prompt caching no está disponible en Gemini API — no es aplicable

**Cambios CLAUDE.md:**
- Actualizado con todos los patrones implementados
- Detalles técnicos de cada mejora
- Fixes y pitfalls conocidos
- Status y configuración del Chat IA

## Mejoras (2026-04-28)

### BienForm — "Seguir registrando", draft autosave y barra fija móvil

#### Modo "Seguir registrando" (chainMode)
- **Feature:** Toggle `Switch` en la barra inferior del formulario (solo `create`). Cuando está activo, al guardar el bien no navega al detalle sino a `/scan?continuar=1`, heredando los campos comunes al siguiente registro.
- **Persistencia:** Preferencia guardada en `localStorage('inv:bien_form_chain')` — sobrevive recarga.
- **Herencia de campos:** Query params `chain_trabajador`, `chain_ubicacion`, `chain_estado` — se leen al montar el formulario y se convierten en estado inicial.
- **sessionStorage:** Al guardar con chainMode activo, guarda `inv:chain_defaults` (`{ id_trabajador, id_ubicacion, estado }`) para que `/scan` lo pase como query al montar el siguiente `BienForm`.
- **Toast:** `toast.success('Bien guardado · Continúa con el siguiente', { action: { label: 'Ver detalle', onClick: navigate } })` — permite ir al detalle sin perder el flujo.
- **Constante:** `CHAIN_KEY = 'inv:bien_form_chain'`

#### Draft autosave
- **Feature:** En `create`, el formulario autoguarda un borrador en `localStorage` con debounce de 500ms. Si el usuario vuelve al mismo código, ve un `Alert` con "Tienes un borrador para [codigo] (hace X min)" y botones **Restaurar** / **Descartar**.
- **Clave:** `inv:bien_draft:<codigo_patrimonial>` — one-key-per-code, no acumula borradores de todos los bienes.
- **Tipo:** `DraftPayload` (nombre, estado, idTrabajador, idUbicacion, marca, modelo, serie, ordenCompra, valor, savedAt).
- **`draftSuppressRef`:** Ref booleana que bloquea el autosave después de restaurar, descartar o guardar exitosamente — evita re-crear el draft inmediatamente.
- **Limpieza:** `localStorage.removeItem(DRAFT_PREFIX + codigo)` tras submit exitoso o al descartar.
- **`formatDraftAge(ms)`:** Helper local que devuelve "hace unos segundos / X min / X h / X d".
- **Detección al montar:** Solo para `create` con código en query params; si el draft existe para ese código, lo ofrece al usuario.
- **Constante:** `DRAFT_PREFIX = 'inv:bien_draft:'`

#### Barra de acciones fija en móvil
- **Feature:** El botón "Registrar bien" y el toggle "Seguir registrando" están en una barra fija al pie de pantalla en móvil (`fixed bottom-0 left-0 right-0 z-30`), con `backdrop-blur` y `border-t`.
- **Safe area iOS:** `pb-[max(env(safe-area-inset-bottom),0.75rem)]` para respetar el home indicator.
- **Desktop:** La barra vuelve a flujo normal: `lg:static lg:bg-transparent lg:border-0 lg:p-0`.
- **Compensación scroll:** `pb-24 lg:pb-0` en el `<form>` para que el último campo no quede oculto detrás de la barra fija.
- **Altura mínima botón:** `min-h-11` en el `<Button>` para facilitar el tap en móvil.

#### Toast en registro exitoso
- **Sonner:** Añadido `import { toast } from 'sonner'`. Toast en ambos paths de guardado:
  - `chainMode` activo: `toast.success('Bien guardado · Continúa con el siguiente', { action: … })`
  - Normal: `toast.success('Bien registrado correctamente')`

**Archivo:** `web/src/components/BienForm.tsx`

## Mejoras (2026-04-27) — actualizado

#### BienForm: UX móvil y layout desktop

##### UbicacionSelect — combobox con creación inline
- **Cambio:** Reemplazado `<Select>` simple por combobox con búsqueda (mismo patrón que `TrabajadorSearchableSelect`).
- **Crear inline:** Si el texto buscado no existe en el catálogo, aparece `+ Crear "Nombre"` al final de la lista. Un click hace `insert` en la tabla `ubicaciones`, llama `reload()` y selecciona el nuevo ID automáticamente.
- **Restricción:** La opción de crear solo aparece si `canEdit` (`admin` / `operador`); rol `consulta` solo puede seleccionar.
- **UX:** Sin modales extra ni botones separados — flujo en un solo campo, cero context switch en móvil.
- **Archivo:** `web/src/components/UbicacionSelect.tsx`

##### BienForm — sección SIGA colapsable en móvil
- **Comportamiento:** Botón header con `ChevronDown` rotatorio (solo visible `lg:hidden`). En desktop (`lg:`) el contenido siempre es visible con `lg:block`.
- **Estado inicial:** `sigaOpen = tieneSiga || modo === 'edit'`
  - Create sin datos SIGA → cerrada (usuario no ve los 5 campos extra en el primer scroll)
  - Create con scan SIGA → abierta (datos pre-llenados visibles para confirmación)
  - Edit → abierta siempre (puede haber datos que editar)
- **Implementación:** `<fieldset>` reemplazado por `<div>` + `<button type="button">` para evitar conflicto de event bubbling con el submit del form.
- **Archivo:** `web/src/components/BienForm.tsx`

##### BienForm — grid 2 columnas en desktop
- **Layout desktop (`md:grid-cols-2`):**
  - Fila 1: Código patrimonial (50%) + Estado (50%)
  - Fila 2: Nombre del bien (100%) — ancho completo para autocomplete SIGA
  - Fila 3: Responsable (50%) + Ubicación (50%)
  - Fila 4: Sección SIGA (colapsable móvil, siempre abierta desktop)
- **Nombre a ancho completo:** campo principal con autocomplete; un popover en 50% quedaría estrecho en desktop y rompe jerarquía visual.
- **Archivo:** `web/src/components/BienForm.tsx`



#### BienDetail rediseño: layout 2 columnas
- **Desktop (lg+):** Grid `lg:grid-cols-2 lg:items-start` — detalle del bien a la izquierda, historial de cambios a la derecha (consulta paralela sin scroll).
- **Móvil:** una columna, orden natural. Detalle completo, luego historial.
- **Sección "Datos SIGA PJ" colapsable en móvil:** 
  - Botón con `ChevronDown` rotatorio (chevron solo visible `lg:hidden`)
  - Cerrada por defecto en móvil (`sigaOpen=false`)
  - Siempre abierta en desktop (`lg:block` para contenido)
  - `setState` toggle con animación `transition-transform`
- **Contenedor:** ampliado a `lg:max-w-6xl` para soportar 2 columnas
- **Archivo:** `web/src/pages/BienDetail.tsx`

#### QuickEditBienDialog: precarga estado actual
- **Problema:** Al abrir dialog para editar Estado/Responsable/Ubicación, el campo no mostraba el valor actual (p. ej. "Regular").
- **Causa:** `useState` se inicializaba solo en primer render; cuando `target` cambiaba (nuevo bien/campo), el estado local no se resincronizaba.
- **Solución:** Agregado `useEffect` con dependencia `[target, ubicaciones]` que sincroniza:
  - `nuevoEstado` ← `target.bien.estado`
  - `nuevoIdTrabajador` ← `target.bien.id_trabajador`
  - `nuevoIdUbicacion` ← resolución de nombre a ID (idéntico a lógica anterior)
  - `setError(null)` para limpiar errores previos
- **Impacto:** Dialog precarga correctamente; usuario ve qué va a cambiar.
- **Archivo:** `web/src/components/QuickEditBienDialog.tsx`

**Variables de entorno actualizadas (2026-04-27):**
- `GEMINI_API_KEY` reemplaza `GROQ_API_KEY`
- `VITE_TURNSTILE_SITE_KEY` opcional (si CAPTCHA activo en Supabase Auth)
- `PASSKEY_EXTRA_HOSTS` para orígenes WebAuthn adicionales

## Fixes (2026-04-24)

### CORS en Edge Function admin-users
- **Problema:** Método PATCH fallaba con "Failed to send a request to the Edge Function" — preflight CORS rechazaba porque la función no declaraba `Access-Control-Allow-Methods`.
- **Solución:** Agregadas headers CORS completas en [supabase/functions/admin-users/index.ts](supabase/functions/admin-users/index.ts#L3-L6):
  ```
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS'
  'Access-Control-Max-Age': '86400'
  ```
- **Impacto:** Aprobar/rechazar/reactivar usuarios desde `/admin` ahora funciona. Redesplegada Edge Function.

### Error handling en AdminUsuarios
- **Problema:** Botones Aprobar/Rechazar/Suspender mostraban "No se pudo actualizar el estado de acceso." genérico sin detalles del servidor.
- **Solución:** [web/src/components/AdminUsuarios.tsx](web/src/components/AdminUsuarios.tsx#L139-L163) — mejorado catch en `executeRoleChange` y `executeAccesoChange` para incluir `e.message`:
  ```typescript
  } catch (e) {
    const detail = e instanceof Error && e.message ? `: ${e.message}` : ''
    setError(`No se pudo actualizar el rol${detail}`)
  }
  ```
- **Impacto:** Errores reales (RLS, columna faltante, etc.) ahora visibles al usuario.

### Chat IA — acceso para consulta confirmado
- **Verificado:** Rol `consulta` ya tiene acceso al chat (sin restricción de código ni RLS).
- **Detalle:** Layout.tsx renderiza botón Bot para todos los roles; `ai-chat` Edge Function usa `service_role` y no valida `app_role`.
- **Status:** Funcionando correctamente.
