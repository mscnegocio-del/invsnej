# Plan de implementación por fases

Sistema de inventario web con escaneo de barras, validación de duplicados y CRUD.

---

## Fase 0: Preparación (pre-desarrollo)

| # | Tarea | Descripción | Duración |
|---|-------|-------------|----------|
| 0.1 | Índices Supabase | Crear índice en `codigo_patrimonial` (y opcionales: `id_trabajador`, `ubicacion`) | 15 min |
| 0.2 | Variables de entorno | Definir `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `.env.example` | 5 min |
| 0.3 | Datos de prueba | Asegurar trabajadores y ubicaciones en Supabase (o seed script) | 15 min |

**Dependencias:** ninguna  
**Salida:** BD lista, credenciales documentadas

---

## Fase 1: Setup del proyecto

| # | Tarea | Descripción | Duración |
|---|-------|-------------|----------|
| 1.1 | Crear proyecto | `npm create vite@latest .` (React, JS/TS) | 5 min |
| 1.2 | Dependencias | Tailwind, Supabase, react-router-dom | 10 min |
| 1.3 | Estructura carpetas | `src/components`, `lib`, `hooks`, `pages` según claude.md | 10 min |
| 1.4 | Cliente Supabase | `src/lib/supabase.js` con createClient | 10 min |
| 1.5 | Rutas base | Home, Scan, Search, BienDetail (vacías o placeholder) | 15 min |

**Dependencias:** ninguna  
**Salida:** App corriendo, rutas básicas, Supabase conectado

---

## Fase 2: Datos maestros y selectores

| # | Tarea | Descripción | Duración |
|---|-------|-------------|----------|
| 2.1 | Hook/context | Cargar trabajadores y ubicaciones desde Supabase | 20 min |
| 2.2 | Cache | Guardar en estado o localStorage, recargar periódicamente | 15 min |
| 2.3 | TrabajadorSelect | Componente select buscable o listado | 30 min |
| 2.4 | UbicacionSelect | Componente select para ubicaciones | 20 min |

**Dependencias:** Fase 1  
**Salida:** Selectores funcionando en formularios

---

## Fase 3: Escáner de códigos de barras

| # | Tarea | Descripción | Duración |
|---|-------|-------------|----------|
| 3.1 | Permisos cámara | Solicitar acceso y obtener stream de video | 20 min |
| 3.2 | BarcodeDetector | Integrar API nativa con fallback ZXing/html5-qrcode | 45 min |
| 3.3 | Vista escaneo | Video fullscreen + área de escaneo | 30 min |
| 3.4 | Flash (torch) | Activar/desactivar linterna si el dispositivo lo soporta | 25 min |
| 3.5 | Callback | Al detectar código, navegar/retornar `codigo_patrimonial` | 15 min |

**Dependencias:** Fase 1  
**Salida:** Pantalla de escaneo funcional, retorna código

---

## Fase 4: Validación de duplicados y DuplicateAlert

| # | Tarea | Descripción | Duración |
|---|-------|-------------|----------|
| 4.1 | Validación | Query `.eq('codigo_patrimonial', codigo).maybeSingle()` post-escaneo | 20 min |
| 4.2 | DuplicateAlert | Componente que muestra código, responsable, ubicación | 25 min |
| 4.3 | Acciones alerta | Botones: Ver detalle, Editar, Registrar otro, Cancelar | 20 min |
| 4.4 | Flujo Scan → Alerta | Integrar escáner con validación y DuplicateAlert | 20 min |

**Dependencias:** Fase 2, Fase 3  
**Salida:** Flujo completo: escanear → validar → alerta si duplicado

---

## Fase 5: Create (registro de bienes)

| # | Tarea | Descripción | Duración |
|---|-------|-------------|----------|
| 5.1 | BienForm | Formulario con campos: código, responsable, modelo, tipo, estado, ubicación | 40 min |
| 5.2 | Modo Create | Código prellenado, resto vacío, validaciones básicas | 20 min |
| 5.3 | Insert Supabase | `.from('bienes').insert(bien)` | 15 min |
| 5.4 | Post-éxito | Mensaje + botones Ver detalle, Editar, Registrar otro | 20 min |
| 5.5 | Flujo Scan → Create | Si no duplicado, mostrar BienForm | 15 min |

**Dependencias:** Fase 2, Fase 4  
**Salida:** Registro de bienes nuevo funcionando de punta a punta

---

## Fase 6: Read (detalle de bien)

| # | Tarea | Descripción | Duración |
|---|-------|-------------|----------|
| 6.1 | BienDetail | Componente/página que muestra todos los campos del bien | 25 min |
| 6.2 | Carga por ID | `.from('bienes').select().eq('id', id).single()` | 15 min |
| 6.3 | Nombre responsable | Join o segunda query para mostrar nombre del trabajador | 15 min |
| 6.4 | Navegación | Links desde DuplicateAlert y post-Create hacia BienDetail | 15 min |

**Dependencias:** Fase 4, Fase 5  
**Salida:** Vista de detalle accesible desde alerta y post-registro

---

## Fase 7: Update (editar bien)

| # | Tarea | Descripción | Duración |
|---|-------|-------------|----------|
| 7.1 | Modo Edit en BienForm | Reutilizar BienForm con prop `bien` para prellenar | 25 min |
| 7.2 | Update Supabase | `.from('bienes').update(bien).eq('id', id)` | 15 min |
| 7.3 | Botón Editar en BienDetail | Navegar a formulario en modo edición | 10 min |
| 7.4 | Editar desde DuplicateAlert | Pasar bien a BienForm (Update) | 10 min |

**Dependencias:** Fase 5, Fase 6  
**Salida:** Edición de bienes desde detalle y desde alerta de duplicado

---

## Fase 8: Delete (eliminar bien)

| # | Tarea | Descripción | Duración |
|---|-------|-------------|----------|
| 8.1 | Confirmación | Modal o diálogo antes de eliminar | 20 min |
| 8.2 | Delete Supabase | `.from('bienes').delete().eq('id', id)` | 10 min |
| 8.3 | Botón Eliminar en BienDetail | Mostrar confirmación → eliminar → redirigir | 15 min |
| 8.4 | Opcional: soft delete | Añadir `eliminado_at` y filtrar en queries | 30 min |

**Dependencias:** Fase 6  
**Salida:** Eliminación con confirmación (o soft delete)

---

## Fase 9: Búsqueda y listado paginado

| # | Tarea | Descripción | Duración |
|---|-------|-------------|----------|
| 9.1 | BienSearch | Página con filtros (código, responsable, ubicación) | 30 min |
| 9.2 | Query paginada | `.range(offset, offset+19)` con filtros opcionales | 30 min |
| 9.3 | Tabla/lista resultados | Mostrar código, modelo, responsable, ubicación | 25 min |
| 9.4 | Navegación paginación | Botones o "Cargar más" | 20 min |
| 9.5 | Click fila | Ir a BienDetail | 10 min |
| 9.6 | Link en Home | Botón "Buscar" que lleve a BienSearch | 5 min |

**Dependencias:** Fase 2, Fase 6  
**Salida:** Búsqueda funcional con resultados paginados

---

## Fase 10: PWA y optimización móvil

| # | Tarea | Descripción | Duración |
|---|-------|-------------|----------|
| 10.1 | manifest.json | PWA instalable, iconos, nombre | 20 min |
| 10.2 | Service worker | Vite PWA plugin o workbox | 25 min |
| 10.3 | Meta viewport | Ajustes para móvil | 5 min |
| 10.4 | UX táctil | Botones grandes, áreas de toque adecuadas | 20 min |

**Dependencias:** Fase 1  
**Salida:** App instalable en el celular

---

## Fase 11: Deploy en Vercel

| # | Tarea | Descripción | Duración |
|---|-------|-------------|----------|
| 11.1 | vercel.json | Config SPA (rewrites a index.html) | 10 min |
| 11.2 | Variables de entorno | Configurar en Vercel Dashboard | 10 min |
| 11.3 | Deploy | `vercel` o integración con Git | 15 min |
| 11.4 | Pruebas en celular | Probar cámara, flash, flujos | 30 min |

**Dependencias:** Fases 1–10  
**Salida:** App en producción accesible desde el celular

---

## Resumen por fases

| Fase | Nombre | Duración est. | Depende de |
|------|--------|---------------|------------|
| 0 | Preparación | 35 min | — |
| 1 | Setup | 50 min | — |
| 2 | Datos maestros | 1h 25min | 1 |
| 3 | Escáner | 2h 15min | 1 |
| 4 | Duplicados + Alerta | 1h 25min | 2, 3 |
| 5 | Create | 1h 50min | 2, 4 |
| 6 | Read | 1h 10min | 4, 5 |
| 7 | Update | 1h | 5, 6 |
| 8 | Delete | 55 min | 6 |
| 9 | Búsqueda | 2h | 2, 6 |
| 10 | PWA | 1h 10min | 1 |
| 11 | Deploy | 1h 5min | 1–10 |

**Total estimado:** ~14–15 horas

---

## Orden sugerido de ejecución

1. **Fase 0** y **Fase 1** (base)
2. **Fase 2** y **Fase 3** en paralelo si trabajan dos personas
3. **Fase 4** (depende de 2 y 3)
4. **Fase 5** → **Fase 6** → **Fase 7** → **Fase 8** (CRUD secuencial)
5. **Fase 9** (puede hacerse en paralelo con 7 u 8)
6. **Fase 10** cuando el core esté estable
7. **Fase 11** al final

---

## MVP mínimo

Para una versión mínima viable:

- **Fases 0, 1, 2, 3, 4, 5** → Escanear, validar duplicados, registrar bienes (~8 h)
- Opcional: **Fase 6** para ver detalle tras registrar (~1 h)
- **Fase 11** para deploy básico (~1 h)

**MVP:** ~10 horas.
