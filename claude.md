# Claude - Contexto del proyecto inv-web

## ¿Qué es este proyecto?

App web de inventario patrimonial para móvil. Permite escanear códigos de barras, registrar bienes en Supabase, validar duplicados y realizar CRUD completo (crear, leer, editar, eliminar).

## Stack

- React 19 + Vite 6
- Tailwind CSS
- Supabase (@supabase/supabase-js)
- **Quagga2** para fallback de escaneo (cuando BarcodeDetector no está disponible)
- BarcodeDetector API (nativa en navegadores soportados)
- Deploy: Vercel
- PWA con service workers

## Base de datos (Supabase)

- **Proyecto**: inventario (ID: `hegtvsuscaaifqqhbbxq`)
- **Tablas**: bienes, trabajadores, ubicaciones
- **bienes.codigo_patrimonial**: identificador del barcode. Usar para validar duplicados.
- **bienes.ubicacion**: texto (nombre de ubicación, no ID)
- **bienes.estado**: Nuevo, Bueno, Regular, Malo, Muy malo
- **Recomendado**: índice en `codigo_patrimonial` para búsquedas rápidas.

## Autenticación recomendada (marzo 2026)

- **Opción base (recomendada)**: Supabase Auth con OTP por correo (magic link o código OTP), priorizando simplicidad de adopción en móvil y menor fricción operativa.
- **Evolución posible**: passkeys/WebAuthn como mejora futura para reducir dependencia de correo y aumentar seguridad de inicio de sesión.
- **Estado esperado en tareas futuras**: tratar este bloque como guía de arquitectura; no asumir que OTP, passkeys o controles avanzados ya están implementados.

### Checklist de seguridad mínima

- **RLS estricto**: políticas por tabla y operación (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) con `auth.uid()` y principio de mínimo privilegio.
- **CORS de producción**: permitir solo dominios oficiales de la app (producción y, si aplica, preview controlado), evitando comodines.
- **Auditoría de cambios**: registrar altas/ediciones/eliminaciones con actor, timestamp y before/after para trazabilidad.
- **Protección brute force/rate limiting**: limitar intentos de autenticación y endpoints sensibles (login, recuperación, operaciones críticas).

## Reglas de negocio clave

1. **Duplicados**: Antes de crear, consultar si `codigo_patrimonial` existe. Si existe → mostrar alerta con opciones Ver detalle / Editar / Registrar otro.
2. **Estado**: Solo valores: Nuevo, Bueno, Regular, Malo, Muy malo. Incluye en exportaciones.
3. **Responsable**: FK a `trabajadores.id`. Se resuelve nombre en visualización y exportación.
4. **Ubicación**: texto en bienes. Se resuelve desde catálogo si vienen como ID antiguos.
5. **Delete**: Preferir soft delete (`eliminado_at`) sobre DELETE físico.
6. **Cámara**: Solo activa cuando se abre modal de escaneo, se libera al cerrar (ahorro de batería).

## Estructura esperada

```
src/
├── components/
│   ├── BarcodeScanner.tsx      # Interfaz escaneo + input manual
│   ├── BarcodeScanModal.tsx    # Modal con BarcodeScanner para búsqueda
│   ├── DuplicateAlert.tsx      # Alerta cuando codigo ya existe
│   ├── BienForm.tsx            # Create y Update
│   ├── BienDetail.tsx          # Vista detalle + botones Editar/Eliminar
│   ├── TrabajadorSearchableSelect.tsx # Select buscable por nombre
│   ├── UbicacionSelect.tsx     # Select de ubicaciones
│   └── Layout.tsx              # Navegación inferior móvil
├── pages/
│   ├── Home.tsx               # Home con "Registrar bien" y "Buscar"
│   ├── Scan.tsx               # Input código + icono cámara + modal
│   ├── Registro.tsx           # Contenedor de BienForm
│   ├── BienDetail.tsx         # Detalle + opciones
│   ├── EditarBien.tsx         # Edición
│   └── Search.tsx             # Búsqueda filtros + resultados + exportación
├── lib/
│   └── supabaseClient.ts
├── context/
│   ├── CameraContext.tsx      # Manejo de stream de cámara
│   └── CatalogContext.tsx     # Cache de trabajadores y ubicaciones
├── hooks/
│   └── useBarcodeScanner.ts   # Lógica escaneo (BarcodeDetector + Quagga2)
└── App.tsx
```

## Flujo principal actualizado

1. **Home** → Botón "Registrar bien" (nuevo flujo) o "Buscar"
2. **Registrar bien (Scan)**:
   - Input de código + botón cámara
   - Presionar cámara → abre `BarcodeScanModal`
   - Si detecta código → rellena input y cierra modal
   - Usuario presiona "Continuar" → verifica duplicado
3. **Validar duplicado** → query Supabase `.eq('codigo_patrimonial', codigo).maybeSingle()`
4. **Si existe** → `DuplicateAlert` → Ver detalle / Editar / Registrar otro
5. **Si no existe** → `BienForm` (Create) → éxito → Ver detalle / Editar / Registrar otro
6. **Búsqueda** → filtros (código, responsable, ubicación) + paginación → resultados con nombre de responsable → exportar a JSON/CSV/Excel/copiar para compartir
7. **Detalle** → Ver / Editar / Eliminar

## Rendimiento (1900+ registros)

- Duplicados: índice + `.maybeSingle()`
- Selectores: cache en `CatalogContext` (15 min TTL)
- Búsqueda/listado: paginación `.range(0, 19)`, `.range(20, 39)`, etc.
- Exportación todo: paginado en bloques de 1000 (límite Supabase)
- Ubicación: resolución de IDs antiguos a nombres en visualización/exportación
- Cámara: solo activa en modal, se libera al cerrar

## Exportación y compartibilidad

- **Copiar para compartir**: Genera texto legible (código, nombre, estado, responsable, ubicación) por bien, listo para WhatsApp/Telegram/email
- **Descargar JSON**: JSON de búsqueda actual o inventario completo
- **Descargar CSV (Excel)**: CSV con columnas id, codigo_patrimonial, nombre_mueble_equipo, estado, responsable, ubicacion
- **Paginación**: Exportación completa > 1000 registros se hace en bloques de 1000

## Convenciones

- Componentes funcionales + hooks
- Variables de entorno: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Idioma de la UI: español
- Input de ubicación: se guarda nombre (string), no ID, resolviendo desde catálogo
