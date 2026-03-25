# Plan de implementación por fases (v2)

Sistema de inventario web con escaneo de barras, validación de duplicados, CRUD, búsqueda y exportación flexible.

---

## Estado actual (Fase 12 - Completado)

✅ **Fases 0–11**: Completadas (app en producción)

Desde la última actualización:
- ✅ Cambio de ZXing a **Quagga2** como fallback de escaneo
- ✅ Flujo de **Scan**: input de código + icono cámara (modal)
- ✅ **Cámara**: solo activa en modal, se libera al cerrar (ahorro batería)
- ✅ **Copiar para compartir**: texto legible formateado para WhatsApp/Telegram
- ✅ **Exportación**: CSV, JSON, descarga todo en bloques 1000
- ✅ **Ubicación**: se guarda nombre (no ID), se resuelven IDs antiguos
- ✅ **Estado**: incluido en exportaciones y visualización
- ✅ **Responsable**: nombre resuelto en UI y exportaciones
- ✅ **Input manual**: opción "Escribir manualmente" en BarcodeScanner

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

| # | Tarea | Descripción | Prioridad |
|---|-------|-------------|-----------|
| 13.1 | Offline-first | Service worker + sync cuando hay conexión | Media |
| 13.2 | Soft delete | Marcar `eliminado_at` en lugar de DELETE | Media |
| 13.3 | Auditoría | Log de cambios (quién, cuándo, qué) | Baja |
| 13.4 | Roles y permisos | Restricciones por usuario en Supabase RLS | Baja |
| 13.5 | Importación masiva | CSV upload para registrar múltiples bienes | Baja |
| 13.6 | Etiquetas de código | Generar e imprimir etiquetas con códigos | Baja |
| 13.7 | Estadísticas | Dashboard de bienes por estado, ubicación, etc. | Baja |
| 13.8 | Modo oscuro | Tema dark mode configurable | Baja |

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

### 14.3 — Header con sede activa

Crear `src/components/Header.tsx`:

- Barra superior fija en todas las páginas (excepto SedeSelector)
- Muestra: `📍 [nombre de sede activa]` + botón `[Cambiar]`
- Botón Cambiar → llama `limpiarSede()` → vuelve a SedeSelector

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

- Agregar carga de `sedes` con mismo TTL 15 min
- Exponer `sedes[]` para uso en filtros y visualización

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

- [ ] SQL ejecutado en Supabase (tabla sedes + columna sede_id + índice)
- [ ] Sedes iniciales insertadas en BD
- [ ] `SedeContext` creado y envuelve la app en `App.tsx`
- [ ] `SedeSelector` muestra lista y guarda selección
- [ ] `Header` visible en todas las páginas con sede activa
- [ ] `BienForm` guarda `sede_id` al crear
- [ ] `Search` filtra por sede activa
- [ ] Exportación CSV/JSON incluye columna sede
- [ ] Toggle "todas las sedes" funciona en búsqueda
- [ ] Build sin errores

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
// Ajustar los nombres exactos según el Excel real
const COLUMN_MAP = {
  codigo_patrimonial: ['CÓDIGO', 'CODIGO', 'COD_PATRIMONIAL', 'CÓDIGO PATRIMONIAL'],
  descripcion:        ['DESCRIPCIÓN', 'DESCRIPCION', 'NOMBRE'],
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

- [ ] SQL ejecutado (tabla siga_bienes + columnas en bienes)
- [ ] Página Admin accesible desde Home/menú
- [ ] SheetJS parsea Excel correctamente
- [ ] Mapeo de columnas funciona con el Excel SIGA real
- [ ] Preview de 5 filas antes de confirmar
- [ ] Upsert en bloques 500 con progreso
- [ ] Resumen de carga (nuevos / actualizados / errores)
- [ ] Al escanear: consulta siga_bienes y prerellena BienForm
- [ ] Indicador visual "Desde SIGA" en campos prellenados
- [ ] BienDetail muestra campos SIGA si existen
- [ ] Exportación CSV incluye columnas SIGA
- [ ] Build sin errores

---

## Resumen de arquitectura actualizada

### Stack
- React 19 + Vite 6
- Tailwind CSS
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
10. **Cache de datos maestros**: trabajadores, ubicaciones y sedes con TTL 15 min

### Base de datos
- 1900+ registros de bienes
- Índices en: codigo_patrimonial, id_trabajador, ubicacion, sede_id
- Tabla `sedes`: catálogo de sedes (2–5 registros)
- Tabla `siga_bienes`: base de conocimiento SIGA PJ (todos los bienes del Poder Judicial)
- Modelo limpio con ubicacion como string (nombre)

### Estructura de archivos nuevos/modificados

```
src/
├── components/
│   ├── Header.tsx              # NUEVO: barra sede activa + botón cambiar
│   ├── BienForm.tsx            # MODIFICADO: sede_id + campos SIGA
│   └── BienDetail.tsx          # MODIFICADO: muestra campos SIGA
├── pages/
│   ├── SedeSelector.tsx        # NUEVO: pantalla selección de sede
│   ├── Admin.tsx               # NUEVO: carga Excel SIGA
│   └── Search.tsx              # MODIFICADO: filtro por sede + exportación enriquecida
├── context/
│   ├── SedeContext.tsx         # NUEVO: sede activa en localStorage
│   └── CatalogContext.tsx      # MODIFICADO: incluye sedes[]
└── App.tsx                     # MODIFICADO: SedeContext + SedeSelector guard
```

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
Antes de implementar Fase 15, verificar los nombres exactos de columnas del Excel SIGA PJ
y ajustar el `COLUMN_MAP` en `src/pages/Admin.tsx` según corresponda.

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