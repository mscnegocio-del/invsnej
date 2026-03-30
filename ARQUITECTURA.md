# Arquitectura - Sistema de Inventario Web (v2)

## 1. Vista general

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CELULAR (PWA)                                     │
│                                                                              │
│  Home                                                                        │
│  ├── [Registrar bien] ──► Scan                                              │
│  │                        ├── Input código + icono cámara                   │
│  │                        ├── Icono 📷 abre BarcodeScanModal               │
│  │                        │   └── Modal con cámara + "Escribir manualmente" │
│  │                        │       ├── Detecta código → rellena input        │
│  │                        │       └── Cierra modal                           │
│  │                        ├── Presiona "Continuar"                           │
│  │                        └── ¿Duplicado? ──┬── Sí ──► DuplicateAlert      │
│  │                              (query)     │         (Ver/Editar/Otro)    │
│  │                                          │                               │
│  │                                          └── No ──► BienForm (Create)   │
│  │                                                     └── Éxito ──►        │
│  │                                                       Ver/Editar/Otro    │
│  │                                                                          │
│  └── [Buscar] ──► Search                                                   │
│                   ├── Filtros (código, responsable, ubicación)             │
│                   ├── Resultados paginados (20 por página)                 │
│                   ├── Acciones: Copiar / JSON / CSV / Descargar todo       │
│                   ├── Click resultado ──► BienDetail                        │
│                   │                      ├── Ver                            │
│                   │                      ├── Editar ──► BienForm (Update)  │
│                   │                      └── Eliminar (confirmación)       │
│                   │                                                         │
│                   ├── Icono 📷 abre modal de escaneo                       │
│                   │   └── Detecta código → rellena filtro + busca         │
│                   │                                                         │
│                   └── Bloque "Descargar todos los bienes"                  │
│                       ├── Descargar todo Excel (CSV) en bloques 1000       │
│                       └── Descargar todo JSON en bloques 1000              │
└─────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         │ HTTPS
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VERCEL                                          │
│                     (Frontend estático / SPA)                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             SUPABASE                                         │
│  • bienes (id, codigo_patrimonial, nombre_mueble_equipo, estado,            │
│            id_trabajador, ubicacion [string], fecha_registro)               │
│  • trabajadores (id, nombre)                                                │
│  • ubicaciones (id, nombre)                                                 │
│  • Índices en: codigo_patrimonial, id_trabajador, ubicacion                │
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

## 6. Componentes principales

| Componente | Responsabilidad |
|-----------|-----------------|
| **BarcodeScanner** | Interfaz con video/canvas, marco de escaneo, botones (capturar, flash, rotar, escribir manualmente), selección de input manual de código |
| **BarcodeScanModal** | Modal que monta `BarcodeScanner`, cámara solo activa dentro del modal, se libera al desmontar |
| **DuplicateAlert** | Muestra código, nombre, responsable, ubicación de bien duplicado + botones Ver/Editar/Otro/Cancelar |
| **BienForm** | Create o Update con campos: código (prellenado), nombre, tipo, estado, responsable (searchable), ubicación (select) |
| **BienDetail** | Vista completa de bien + botones Editar / Eliminar |
| **Search** | Filtros (código + escaneo), responsable (select buscable), ubicación, resultados paginados, acciones exportar |
| **TrabajadorSearchableSelect** | Select buscable por nombre, usa `CatalogContext` |
| **UbicacionSelect** | Select de ubicaciones, usa `CatalogContext` |
| **Layout** | Navegación inferior móvil (Home, Registrar/Scan, Buscar) |

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

## 11. Autenticación y seguridad (actualizado: marzo 2026)

### Estado actual del proyecto
- Actualmente la app opera sin un módulo de autenticación de usuarios finalizado en producción.
- Lo siguiente define la **implementación recomendada inmediata** y la **evolución por fases**.

### 11.1 Implementación recomendada inmediata (Fase 1)
- **Supabase Auth con OTP por correo** (`magic link` o código de un solo uso).
- Flujo recomendado:
  - Usuario ingresa correo institucional.
  - Supabase envía enlace mágico o código OTP.
  - Frontend valida sesión con `@supabase/supabase-js` y opera con token de usuario.
- Ventajas para este contexto (Vercel + sin dominio propio):
  - Menor complejidad operativa que OAuth social.
  - No exige configurar app OAuth de terceros para salir a producción inicial.
  - Permite activar control de acceso real en base de datos con RLS.

### 11.2 Evolución recomendada (Fase 2)
- **Passkeys / WebAuthn** como mejora futura de seguridad y UX.
- Objetivo: reducir fricción de login y fortalecer resistencia a phishing.
- Estado: **propuesta**, no asumida como implementada.

### 11.3 Google OAuth sin dominio propio: limitaciones prácticas
- Puede no ser viable o puede retrasar salida en este contexto porque:
  - Requiere configurar correctamente pantalla de consentimiento, orígenes autorizados y redirect URIs.
  - En modo externo, Google puede exigir verificación adicional según alcance/branding/políticas.
  - Cambios de URL por previews o ajustes de despliegue en Vercel elevan mantenimiento de callbacks.
- Por esto, para etapa inicial se recomienda OTP por correo y dejar OAuth social como fase posterior.

### 11.4 Controles de seguridad obligatorios (mínimo)
- **RLS habilitado** en tablas sensibles (`bienes`, `trabajadores`, `ubicaciones`) con políticas por rol/usuario.
- **Nunca exponer `service_role` en frontend**; usar solo `anon key` en cliente.
- **Rate limiting** en autenticación y operaciones sensibles (login OTP, búsquedas intensivas, escrituras repetidas).
- **Auditoría**:
  - Registrar eventos críticos (inicio de sesión, altas, ediciones, eliminaciones, intentos denegados).
  - Conservar trazabilidad mínima: usuario, acción, timestamp, entidad afectada.
