# Arquitectura - Sistema de Inventario Web (v2)

## 1. Vista general

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CELULAR (PWA + shadcn/ui + Dark Mode)                    │
│                                                                              │
│  Header: 📍 [Sede Activa] [Cambiar] | ☀️/🌙 Theme | [👤 Admin]             │
│                                                                              │
│  Home (Card-based UI)                                                       │
│  ├── [Registrar bien] ──► Scan (Input + Button con icono cámara)           │
│  │                        ├── shadcn/ui Input + Button variant             │
│  │                        ├── Icono 📷 abre BarcodeScanModal               │
│  │                        │   └── Modal (shadcn/ui Dialog) con cámara      │
│  │                        │       ├── Detecta código → rellena input        │
│  │                        │       └── Cierra modal                          │
│  │                        ├── Presiona "Continuar"                          │
│  │                        └── ¿Duplicado? ──┬── Sí ──► DuplicateAlert      │
│  │                              (query)     │    (AlertDialog shadcn)       │
│  │                                          │                               │
│  │                                          └── No ──► BienForm            │
│  │                                            (react-hook-form + zod)      │
│  │                                                                          │
│  └── [Buscar] ──► Search                                                   │
│                   ├── Filtros (Card containers)                            │
│                   ├── Resultados paginados (Table shadcn/ui)               │
│                   ├── Acciones: Copiar / JSON / CSV / Descargar todo       │
│                   ├── Click resultado ──► BienDetail (Card + Tabs)         │
│                   │                      ├── Ver                            │
│                   │                      ├── Editar ──► BienForm           │
│                   │                      └── Eliminar (AlertDialog)        │
│                   │                                                         │
│                   ├── Icono 📷 abre modal de escaneo                       │
│                   └── Bloque "Descargar todos"                             │
│                       ├── CSV bloques 1000                                  │
│                       └── JSON bloques 1000                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         │ HTTPS
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     VERCEL (shadcn/ui Prebuilt)                             │
│                     (Frontend SPA + PWA + Dark Mode)                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             SUPABASE                                         │
│  • bienes, trabajadores, ubicaciones, sedes, siga_bienes, bien_historial   │
│  • Índices en: codigo_patrimonial, id_trabajador, ubicacion, sede_id       │
│  • RLS habilitado; autenticación: OTP + passkeys/WebAuthn                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Contextos y manejo de estado

### CameraContext
- **Propósito**: centralizar stream de cámara, solicitar permisos una sola vez
- **Estados**: `stream`, `error`, `isLoading`, `requestStream()`
- **Ciclo de vida**: 
  - Stream se solicita cuando se abre modal de escaneo
  - Stream se libera cuando se cierra modal (para ahorrar batería)

### CatalogContext
- **Propósito**: cachear trabajadores y ubicaciones con TTL 15 min
- **Estados**: `trabajadores[]`, `ubicaciones[]`, `loading`, `error`, `reload()`
- **Ciclo de vida**: se carga al montar App, cachea en localStorage

---

## 3. Flujo de escaneo y validación de duplicados

```
Usuario abre "Registrar bien" (Scan)
        │
        ▼
Input de código + Icono 📷
        │
        ├─ Usuario escribe código manualmente y presiona "Continuar"
        │
        └─ Usuario presiona 📷 → abre BarcodeScanModal
           ├── Montaje: se pide stream de cámara (CameraContext)
           ├── BarcodeScanner detecta código → handleDetected(code)
           │   └── Rellena input y cierra modal
           └── Desmontaje: stream se libera
           
Usuario presiona "Continuar" con código en input
        │
        ▼
supabase.from('bienes')
  .select('id, codigo_patrimonial, nombre_mueble_equipo, id_trabajador, ubicacion, estado')
  .eq('codigo_patrimonial', codigo)
  .maybeSingle()
        │
        ├── Existe ──► DuplicateAlert (muestra datos existentes)
        │              ├── Ver detalle
        │              ├── Editar (pasa a BienForm modo update)
        │              ├── Registrar otro (limpia input)
        │              └── Cancelar
        │
        └── No existe ──► BienForm (Create)
                         ├── Prellenado: código_patrimonial
                         ├── Vacíos: nombre, tipo, estado, responsable, ubicación
                         └── Guardar → .insert() → éxito → opciones Ver/Editar/Registrar otro
```

---

## 4. CRUD

| Operación | Ruta / Acción | Supabase |
|-----------|---------------|----------|
| **Create** | Post-escaneo (no duplicado) | `.insert(bien)` |
| **Read** | DuplicateAlert / Búsqueda → BienDetail | `.select().eq('id', id).single()` con resolución de nombre de responsable |
| **Update** | BienDetail → Editar o DuplicateAlert → Editar | `.update(bien).eq('id', id)` |
| **Delete** | BienDetail → Eliminar (con confirmación) | `.delete().eq('id', id)` o soft delete |

### Detalle importante: Ubicación y Responsable
- **Guardado**: `bienes.ubicacion` es texto (nombre de ubicación resuelto desde catálogo)
- **Edición**: En `BienForm`, se selecciona ID de ubicación del catálogo, se resuelve a nombre antes de guardar
- **Carga en edit**: Si `ubicacion` viene como número (datos antiguos), se mapea al catálogo
- **Responsable**: Se guarda `id_trabajador`, se resuelve nombre en visualización/exportación

---

## 5. Búsqueda, filtrado y exportación

### Búsqueda
```
BienSearch
  │
  ├── Filtros: código (exacto), id_trabajador, ubicacion (contiene)
  ├── Modal de escaneo: icono 📷 abre BarcodeScanModal
  │   └── Detecta → rellena código + ejecuta búsqueda
  │
  └── Query paginada:
        .from('bienes')
        .select('id, codigo_patrimonial, nombre_mueble_equipo, estado, id_trabajador, ubicacion')
        .eq('codigo_patrimonial', codigo)      // si aplica
        .eq('id_trabajador', id)               // si aplica
        .ilike('ubicacion', `%${texto}%`)      // si aplica
        .range(offset, offset + 19)
        .order('fecha_registro', { ascending: false })
```

### Exportación
- **Copiar para compartir (WhatsApp/Telegram)**:
  - Genera texto con formato legible:
    ```
    Resultados de búsqueda (N bienes)

    #1
    Código: XXX
    Nombre: YYY
    Estado: Bueno
    Responsable: ZZZ
    Ubicación: WWW
    
    #2
    ...
    ```
  - Se resuelven IDs antiguos de ubicación a nombres

- **Descargar JSON (búsqueda actual)**:
  - Array de objetos con campos resueltos (nombre responsable, ubicación normalizada)

- **Descargar CSV (Excel) (búsqueda actual)**:
  - Columnas: id, codigo_patrimonial, nombre_mueble_equipo, **estado**, responsable, ubicacion
  - Se normalizan IDs antiguos de ubicación

- **Descargar todo (inventario completo)**:
  - Paginado en bloques de 1000 registros (límite Supabase)
  - Formatos: JSON o CSV
  - Se normalizan todas las ubicaciones

---

## 6. Componentes principales (shadcn/ui + react-hook-form)

| Componente | Responsabilidad | Componentes shadcn/ui |
|-----------|-----------------|----------------------|
| **BarcodeScanner** | Interfaz con video/canvas, marco de escaneo, botones (capturar, flash, rotar, escribir manualmente) | Button (variant, size) |
| **BarcodeScanModal** | Modal que monta `BarcodeScanner`, cámara solo activa dentro | Dialog |
| **DuplicateAlert** | Muestra código, nombre, responsable, ubicación de bien duplicado + botones | AlertDialog, Badge, Button |
| **BienForm** | Create/Update con campos: código, nombre, tipo, estado, responsable (searchable), ubicación (select), SIGA (marca, modelo, serie, OC, valor) | Form, Input, Select, Button, Card, Tabs |
| **BienDetail** | Vista completa de bien + SIGA + historial + botones Editar/Eliminar | Card, Tabs, Table, AlertDialog, Badge |
| **Search** | Filtros (código + escaneo), responsable (select buscable), ubicación, resultados paginados (Table), acciones exportar | Card, Input, Button, Table, Pagination (custom) |
| **TrabajadorSearchableSelect** | Select buscable por nombre con Combobox, usa `CatalogContext` | Popover, Command, Button |
| **UbicacionSelect** | Select de ubicaciones, usa `CatalogContext` | Select (shadcn/ui) |
| **Layout** | Navegación inferior móvil + header sede + theme toggle | Button, Separator, cn() utility |
| **Admin** | Carga Excel SIGA, gestión usuarios, barra progreso | Card, Input, Button, Progress, Table, Tabs |
| **Login** | OTP por correo + passkeys/WebAuthn | Card, Input, Button, Form, AlertDialog |
| **Security** | Listar passkeys, registrar, revocar | Card, Button, Table, AlertDialog, Dialog |

---

## 6.5 Utilidades UI (shadcn/ui)

- **cn()**: función de `@/lib/utils` que combina clases Tailwind con `clsx` + `tailwind-merge`
- **Variantes**: Button usa `variant` (default, destructive, outline, secondary, ghost) + `size` (default, sm, lg, icon)
- **Temas**: `useTheme()` de `next-themes` retorna `{theme, setTheme}`; almacena en localStorage
- **Iconos**: Lucide React importados desde `lucide-react` (ej. `<Home className="h-4 w-4" />`)
- **Form**: `react-hook-form` + `zod` para validación tipada

---

## 7. Manejo de cámara y batería

- **CameraContext** gestiona un único stream durante sesión
- **Modal de escaneo**: al abrir → `requestStream()`, al cerrar → stream se libera (`.getTracks().forEach(t => t.stop())`)
- **Beneficio**: cámara solo activa mientras hay modal abierto, ahorra batería significativamente

---

## 8. Resolución de datos maestros en UI/Exportación

### Responsable
- Se guarda `id_trabajador` en bienes
- Se resuelve con `findResponsableNombre(id)` en tiempo de visualización/exportación
- En exportación CSV/JSON se resuelve el nombre antes de incluir

### Ubicación
- **Nuevos bienes**: se guarda nombre de ubicación (string)
- **Bienes antiguos**: pueden venir como ID (número)
- **Resolución en UI**: `findUbicacionNombre(ubicacionRaw)` detecta si es número, lo mapea al catálogo
- **Exportación**: se normalizan todos los valores a nombres

---

## 9. Índices recomendados en Supabase

```sql
CREATE INDEX IF NOT EXISTS idx_bienes_codigo_patrimonial 
  ON bienes(codigo_patrimonial);

CREATE INDEX IF NOT EXISTS idx_bienes_id_trabajador 
  ON bienes(id_trabajador);

CREATE INDEX IF NOT EXISTS idx_bienes_ubicacion 
  ON bienes(ubicacion);
```

---

## 10. Flujo de rendimiento para 1900+ registros

| Operación | Estrategia |
|-----------|-----------|
| Duplicados | Índice en `codigo_patrimonial` + `.maybeSingle()` |
| Trabajadores | Cache 15 min en `CatalogContext` |
| Ubicaciones | Cache 15 min en `CatalogContext` |
| Búsqueda/listado | Paginación `.range()`, 20 por página |
| Exportación completa | Bloques de 1000 registros (límite Supabase) |
| Detalle | `.select().eq('id', id).single()` (una fila) |
| Columnas | Siempre `.select('col1,col2,...')`, evitar `*` |

---

## 11. Autenticación y seguridad (actualizado: abril 2026)

### Estado actual del proyecto
- **Autenticación desplegada:** login con **código OTP por correo** (`/login`), **passkeys/WebAuthn** vía Edge Function Supabase `passkeys` (`@simplewebauthn/server` + `@simplewebauthn/browser`), gestión en `/security`, sesión con `@supabase/supabase-js`, `AuthGuard` / `RoleGuard` / `AuthenticatedShell`.
- **Fallback:** si no hay passkey o falla WebAuthn, el usuario sigue pudiendo entrar con **OTP por correo**.
- Tablas de soporte: `user_passkeys`, `auth_webauthn_challenges`; RPC `auth_user_id_by_email` para la Edge; secreto `PASSKEY_EXTRA_HOSTS` para dominios fuera de `*.vercel.app`.

### 11.1 Implementación base (en producción)
- **Supabase Auth** con **OTP por correo** como mecanismo principal sin contraseña en cliente.
- Flujo:
  - Usuario ingresa correo → `signInWithOtp` → recibe código → `verifyOtp` → sesión.
  - Opcional: **Continuar con passkey** tras indicar el mismo correo (autenticación WebAuthn + creación de sesión en servidor).
- `/auth/callback` atiende redirects de Auth (p. ej. plantillas legacy con enlaces mágicos si siguen habilitadas).

### 11.2 Passkeys / WebAuthn (en producción)
- Registro y uso con la Edge `passkeys`; validación de `Origin`/`rpID` y hosts permitidos (incl. `PASSKEY_EXTRA_HOSTS`).
- Objetivos cumplidos en diseño: menos fricción en accesos recurrentes, mayor resistencia a phishing frente solo a correo.

### 11.3 Google OAuth sin dominio propio: limitaciones prácticas
- Sigue siendo opción futura si el contexto lo justifica (consentimiento, redirects, previews en Vercel). No es requisito del despliegue actual.

### 11.4 Controles de seguridad obligatorios (mínimo y mejora continua)
- **RLS habilitado** en tablas sensibles con políticas por rol/usuario.
- **Nunca exponer `service_role` en frontend**; usar solo `anon key` en cliente.
- **Rate limiting** en autenticación y operaciones sensibles (OTP, passkeys, búsquedas intensivas, escrituras repetidas) — reforzar donde falte.
- **Auditoría**:
  - Registrar eventos críticos (inicio de sesión, altas, ediciones, eliminaciones, intentos denegados).
  - Conservar trazabilidad mínima: usuario, acción, timestamp, entidad afectada.
