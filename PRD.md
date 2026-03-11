# PRD - Sistema de Inventario Web con Escaneo de Barras

## 1. Visión del producto

Sistema web móvil para registrar, buscar, ver, editar y eliminar bienes patrimoniales escaneando códigos de barras desde el celular. Incluye validación de duplicados, CRUD completo y almacenamiento en Supabase.

## 2. Usuarios objetivo

Personal de inventario que usa smartphone para registrar y gestionar bienes en campo.

---

## 3. Requisitos funcionales

### 3.1 Escaneo

| ID   | Requisito                                  | Prioridad |
|------|--------------------------------------------|-----------|
| RF-01 | Usar cámara trasera con soporte de flash   | Alta      |
| RF-02 | Detectar Code 128, Code 39, EAN-13         | Alta      |
| RF-03 | Mostrar área de escaneo en pantalla        | Media     |
| RF-04 | Feedback háptico/sonoro al detectar        | Media     |

### 3.2 Validación de duplicados

| ID   | Requisito                                                              | Prioridad |
|------|-----------------------------------------------------------------------|-----------|
| RF-05 | Antes de mostrar el formulario, consultar si `codigo_patrimonial` existe | Alta    |
| RF-06 | Si existe: mostrar alerta con código, responsable, ubicación actual   | Alta      |
| RF-07 | Opciones en alerta: "Ver detalle", "Editar", "Registrar otro", "Cancelar" | Alta  |
| RF-08 | Si no existe: continuar al formulario de registro                     | Alta      |

### 3.3 CRUD de bienes

| ID   | Requisito                                                    | Prioridad |
|------|-------------------------------------------------------------|-----------|
| RF-09 | **Create**: formulario con código (prellenado), responsable, modelo, tipo, estado, ubicación | Alta |
| RF-10 | **Read**: vista de detalle de un bien con todos los datos   | Alta      |
| RF-11 | **Update**: formulario prellenado para editar bien existente | Alta     |
| RF-12 | **Delete**: confirmación previa; preferible soft delete     | Alta      |
| RF-13 | Tras crear: opciones "Ver detalle", "Editar", "Registrar otro" | Alta   |

### 3.4 Búsqueda y listado

| ID   | Requisito                                                   | Prioridad |
|------|------------------------------------------------------------|-----------|
| RF-14 | Búsqueda por código patrimonial                            | Alta      |
| RF-15 | Filtros por responsable y ubicación                        | Media     |
| RF-16 | Resultados paginados (20 por página)                       | Alta      |
| RF-17 | Click en resultado → detalle → Ver / Editar / Eliminar     | Alta      |

### 3.5 Datos maestros

| ID   | Requisito                                    | Prioridad |
|------|----------------------------------------------|-----------|
| RF-18 | Cargar trabajadores desde Supabase           | Alta      |
| RF-19 | Cargar ubicaciones desde Supabase            | Alta      |
| RF-20 | Cache de trabajadores y ubicaciones en frontend | Media  |

### 3.6 PWA y deploy

| ID   | Requisito                      | Prioridad |
|------|--------------------------------|-----------|
| RF-21 | Instalable como PWA en móvil   | Media     |
| RF-22 | Deploy en Vercel               | Alta      |

---

## 4. Requisitos no funcionales

| ID    | Requisito                                             |
|-------|-------------------------------------------------------|
| RNF-01 | Mobile-first, responsive                             |
| RNF-02 | HTTPS obligatorio (cámara)                            |
| RNF-03 | Tiempo de escaneo < 3 segundos                        |
| RNF-04 | Credenciales Supabase en variables de entorno         |
| RNF-05 | No saturar Supabase: paginación e índices             |
| RNF-06 | Índice en `codigo_patrimonial` para búsqueda rápida   |

---

## 5. Modelo de datos (Supabase)

### bienes

- `id`, `id_trabajador`, `codigo_patrimonial`, `nombre_mueble_equipo`
- `tipo_mueble_equipo`, `estado`, `ubicacion`, `fecha_registro`
- Opcional: `eliminado_at` (soft delete)

### trabajadores

- `id`, `nombre`

### ubicaciones

- `id`, `nombre`

---

## 6. Criterios de aceptación

### Duplicados

- **Dado** que escaneo un código ya registrado
- **Cuando** se completa la detección
- **Entonces** se muestra alerta "Bien ya registrado"
- **Y** se muestran: código, responsable, ubicación
- **Y** puedo elegir "Ver detalle", "Editar", "Registrar otro" o "Cancelar"
- **Y** no se muestra el formulario de Create

### CRUD

- **Create**: tras escanear código nuevo, formulario → guardar → éxito → opciones Ver/Editar/Registrar otro
- **Read**: desde alerta duplicado o búsqueda, abrir detalle con todos los campos
- **Update**: desde detalle o alerta, editar y guardar
- **Delete**: desde detalle, confirmar → eliminar (o marcar eliminado_at)

---

## 7. Estrategias de rendimiento (1000+ registros)

| Operación      | Estrategia                                              |
|----------------|----------------------------------------------------------|
| Duplicados     | Índice en `codigo_patrimonial` + `.eq().maybeSingle()`   |
| Selectores     | Cache de trabajadores/ubicaciones + recarga ocasional    |
| Búsqueda       | Filtros en Supabase, paginación `.range()`               |
| Listado        | Paginación de 20 en 20, nunca cargar todo               |
| Columnas       | `.select()` solo las columnas necesarias                 |
