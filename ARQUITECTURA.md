# Arquitectura - Sistema de Inventario Web

## 1. Vista general

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CELULAR (PWA)                                     │
│                                                                              │
│  Home                                                                        │
│  ├── [Escanear] ──► Scanner ──► ¿Duplicado? ──┬── Sí ──► DuplicateAlert     │
│  │                              (query)       │         (Ver/Editar/Otro)   │
│  │                                            │                             │
│  │                                            └── No ──► BienForm (Create)  │
│  │                                                       └── Éxito ──►      │
│  │                                                         Ver/Editar/Otro  │
│  │                                                                          │
│  └── [Buscar] ──► BienSearch (filtros + paginación)                         │
│                   └── Click resultado ──► BienDetail                         │
│                                          ├── Ver                             │
│                                          ├── Editar ──► BienForm (Update)   │
│                                          └── Eliminar (confirmación)        │
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
│  • bienes (con índice en codigo_patrimonial)                                 │
│  • trabajadores, ubicaciones                                                │
│  • Auth (opcional), RLS                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Validación de duplicados

```
Usuario escanea código
        │
        ▼
Obtener codigo_patrimonial
        │
        ▼
supabase.from('bienes')
  .select('id, codigo_patrimonial, nombre_mueble_equipo, id_trabajador, ubicacion')
  .eq('codigo_patrimonial', codigo)
  .maybeSingle()
        │
        ├── Existe ──► DuplicateAlert
        │              (Ver detalle | Editar | Registrar otro | Cancelar)
        │
        └── No existe ──► BienForm (Create)
```

---

## 3. CRUD

| Operación | Ruta / Acción           | Supabase                    |
|-----------|--------------------------|-----------------------------|
| **Create** | Post-escaneo (no duplicado) | `.insert(bien)`         |
| **Read**   | DuplicateAlert / Búsqueda → BienDetail | `.select().eq('id', id).single()` |
| **Update** | BienDetail → Editar     | `.update(bien).eq('id', id)`     |
| **Delete** | BienDetail → Eliminar   | `.delete().eq('id', id)` o soft delete |

---

## 4. Búsqueda (sin saturar Supabase)

```
BienSearch
  │
  ├── Filtros: código, id_trabajador, ubicacion
  │
  └── Query paginada:
        .from('bienes')
        .select('id, codigo_patrimonial, nombre_mueble_equipo, ubicacion', { count: 'exact' })
        .eq('codigo_patrimonial', codigo)  // si aplica
        .eq('id_trabajador', id)           // si aplica
        .ilike('ubicacion', `%${texto}%`)  // si aplica
        .range(offset, offset + 19)
        .order('fecha_registro', { ascending: false })
```

---

## 5. Rendimiento con 1000+ registros

| Operación        | Estrategia                                              |
|------------------|---------------------------------------------------------|
| Duplicados       | Índice en `codigo_patrimonial` + `.maybeSingle()`       |
| Trabajadores     | Cache en frontend (localStorage / estado global)        |
| Ubicaciones      | Cache en frontend                                       |
| Listado/búsqueda | Paginación `.range()`, 20 por página                    |
| Detalle          | `.select().eq('id', id).single()` (una fila)            |
| Columnas         | Siempre `.select('col1,col2,...')`, evitar `*`          |

---

## 6. Componentes principales

| Componente      | Responsabilidad                                        |
|-----------------|--------------------------------------------------------|
| BarcodeScanner  | Cámara, flash, detección, retorna codigo_patrimonial   |
| DuplicateAlert  | Muestra datos del bien duplicado + acciones            |
| BienForm        | Create o Update según prop `bien`                      |
| BienDetail      | Vista completa + botones Editar / Eliminar             |
| BienSearch      | Filtros, resultados paginados, navegación a detalle    |
| TrabajadorSelect| Select con cache de trabajadores                       |
| UbicacionSelect | Select con cache de ubicaciones                        |

---

## 7. Índices recomendados en Supabase

```sql
CREATE INDEX IF NOT EXISTS idx_bienes_codigo_patrimonial 
  ON bienes(codigo_patrimonial);

CREATE INDEX IF NOT EXISTS idx_bienes_id_trabajador 
  ON bienes(id_trabajador);

CREATE INDEX IF NOT EXISTS idx_bienes_ubicacion 
  ON bienes(ubicacion);
```
