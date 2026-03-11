# Claude - Contexto del proyecto inv-web

## ¿Qué es este proyecto?

App web de inventario patrimonial para móvil. Permite escanear códigos de barras, registrar bienes en Supabase, validar duplicados y realizar CRUD completo (crear, leer, editar, eliminar).

## Stack

- React 19 + Vite 6
- Tailwind CSS
- Supabase (@supabase/supabase-js)
- BarcodeDetector API / ZXing como fallback
- Deploy: Vercel

## Base de datos (Supabase)

- **Proyecto**: inventario (ID: `hegtvsuscaaifqqhbbxq`)
- **Tablas**: bienes, trabajadores, ubicaciones
- **bienes.codigo_patrimonial**: identificador del barcode. Usar para validar duplicados.
- **Recomendado**: índice en `codigo_patrimonial` para búsquedas rápidas.

## Reglas de negocio clave

1. **Duplicados**: Antes de crear, consultar si `codigo_patrimonial` existe. Si existe → mostrar alerta con opciones Ver detalle / Editar / Registrar otro.
2. **Estado**: Solo valores: Nuevo, Bueno, Regular, Malo, Muy malo.
3. **Responsable**: FK a `trabajadores.id`.
4. **Ubicación**: texto en bienes (o FK a ubicaciones si se migra).
5. **Delete**: Preferir soft delete (`eliminado_at`) sobre DELETE físico.

## Estructura esperada

```
src/
├── components/
│   ├── BarcodeScanner/
│   ├── DuplicateAlert/      # Alerta cuando codigo ya existe
│   ├── BienForm/            # Create y Update
│   ├── BienDetail/          # Vista detalle + botones Editar/Eliminar
│   ├── BienSearch/          # Búsqueda con filtros y paginación
│   ├── TrabajadorSelect/
│   └── UbicacionSelect/
├── lib/
│   └── supabase.js
├── hooks/
│   └── useBarcodeScan.js
├── pages/
│   ├── Home.jsx
│   ├── Scan.jsx
│   ├── Registro.jsx
│   ├── BienDetail.jsx
│   └── Search.jsx
└── App.jsx
```

## Flujo principal

1. **Home** → Botón "Escanear" o "Buscar"
2. **Scan** → Obtener codigo_patrimonial
3. **Validar duplicado** → query Supabase `.eq('codigo_patrimonial', codigo).maybeSingle()`
4. **Si existe** → DuplicateAlert → Ver detalle / Editar / Registrar otro
5. **Si no existe** → BienForm (Create) → éxito → Ver detalle / Editar / Registrar otro
6. **Búsqueda** → filtros + paginación → click resultado → BienDetail → Ver / Editar / Eliminar

## Rendimiento (1000+ registros)

- Duplicados: índice + `.maybeSingle()`
- Selectores: cache trabajadores/ubicaciones
- Búsqueda/listado: paginación `.range(0, 19)`, `.range(20, 39)`, etc.
- Select solo columnas necesarias.

## Convenciones

- Componentes funcionales + hooks
- Variables de entorno: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Idioma de la UI: español
