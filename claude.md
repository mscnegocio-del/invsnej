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

## Deploy

- **Frontend:** Vercel (proyecto `web/` o monorepo según configuración).
- **Edge Functions:** `supabase functions deploy` o MCP Supabase `deploy_edge_function` (p. ej. `passkeys`, `admin-users`).
