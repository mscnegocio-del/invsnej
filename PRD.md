# PRD - Sistema de Inventario Web con Escaneo de Barras (v2)

## 1. Visión del producto

Sistema web móvil para registrar, buscar, ver, editar y eliminar bienes patrimoniales escaneando códigos de barras desde el celular. Incluye validación de duplicados, CRUD completo, búsqueda filtrada y exportación flexible (JSON, CSV, texto para compartir). Almacenamiento en Supabase. Actualmente con 1900+ registros en producción.

## 2. Usuarios objetivo

Personal de inventario que usa smartphone para registrar y gestionar bienes en campo, así como personal administrativo que requiere reportes y exports en múltiples formatos.

### 2.1 Objetivos de autenticación y seguridad

- Proteger el acceso al sistema de inventario para evitar uso no autorizado.
- Garantizar trazabilidad básica de accesos y eventos de seguridad relevantes.
- Mantener una experiencia móvil simple, con primer acceso rápido vía **código OTP** por correo.
- Adoptar autenticación resistente a phishing con passkeys/WebAuthn para accesos recurrentes.

### 2.2 Alcance (autenticación y seguridad)

- **Implementado (2026):** primer acceso con **código OTP** enviado al correo (`signInWithOtp`); registro y login con **passkeys/WebAuthn** vía Edge Function `passkeys`; fallback con OTP si passkeys no están disponibles o fallan.
- Autenticación por correo (flujo sin contraseña persistente en cliente).
- Registro y uso de passkeys/WebAuthn para accesos posteriores.
- Código por correo / enlaces como mecanismo de recuperación y fallback cuando passkeys no esté disponible.
- Protección de rutas y acciones críticas (crear, editar, eliminar, exportar) solo para usuarios autenticados.
- Gestión de sesión en frontend con renovación controlada y cierre de sesión manual.
- Registro de eventos mínimos de seguridad (login exitoso/fallido, intentos bloqueados, logout).

### 2.3 Fuera de alcance (versión actual)

- Integración SSO empresarial (Google Workspace, Azure AD, etc.).
- Roles avanzados por área (RBAC granular); en esta etapa se prioriza acceso autenticado básico.

---

## 3. Requisitos funcionales

### 3.1 Escaneo y entrada de código

| ID   | Requisito | Prioridad |
|------|-----------|-----------|
| RF-01 | Usar cámara trasera con soporte de flash | Alta |
| RF-02 | Detectar Code 128, Code 39, EAN-13, EAN-8, UPC | Alta |
| RF-03 | Mostrar área de escaneo en pantalla con marco | Media |
| RF-04 | Opción "Escribir manualmente" en escaneo | Alta |
| RF-05 | Icono cámara en campo de entrada para abrir modal | Alta |
| RF-06 | Modal cierra y libera cámara automáticamente | Alta |
| RF-07 | Soporte flash (linterna) si el dispositivo lo soporta | Media |

### 3.2 Validación de duplicados

| ID   | Requisito | Prioridad |
|------|-----------|-----------|
| RF-08 | Antes de mostrar el formulario, consultar si `codigo_patrimonial` existe | Alta |
| RF-09 | Si existe: mostrar alerta con código, nombre, responsable, ubicación, estado actual | Alta |
| RF-10 | Opciones en alerta: "Ver detalle", "Editar", "Registrar otro", "Cancelar" | Alta |
| RF-11 | Si no existe: continuar al formulario de registro | Alta |

### 3.3 CRUD de bienes

| ID   | Requisito | Prioridad |
|------|-----------|-----------|
| RF-12 | **Create**: formulario con código (prellenado), responsable (buscable), modelo, tipo, estado, ubicación | Alta |
| RF-13 | **Read**: vista de detalle de un bien con todos los datos resueltos (nombres no IDs) | Alta |
| RF-14 | **Update**: formulario prellenado para editar bien existente | Alta |
| RF-15 | **Delete**: confirmación previa antes de eliminar | Alta |
| RF-16 | Tras crear/editar: opciones "Ver detalle", "Editar", "Registrar otro" | Alta |
| RF-17 | Responsable muestra nombre (no ID) en todas las vistas | Alta |
| RF-18 | Ubicación muestra nombre resolviendo IDs antiguos | Alta |

### 3.4 Búsqueda y listado

| ID   | Requisito | Prioridad |
|------|-----------|-----------|
| RF-19 | Búsqueda por código patrimonial (exacto) | Alta |
| RF-20 | Icono cámara en campo código para escaneo directo | Alta |
| RF-21 | Filtro por responsable (buscable) | Media |
| RF-22 | Filtro por ubicación (contiene) | Media |
| RF-23 | Resultados paginados (20 por página) | Alta |
| RF-24 | Mostrar estado en resultados | Alta |
| RF-25 | Click en resultado → detalle → Ver / Editar / Eliminar | Alta |

### 3.5 Exportación y compartición

| ID   | Requisito | Prioridad |
|------|-----------|-----------|
| RF-26 | Copiar resultados búsqueda en formato legible para WhatsApp/Telegram | Alta |
| RF-27 | Descargar resultados búsqueda en JSON | Alta |
| RF-28 | Descargar resultados búsqueda en CSV (Excel) | Alta |
| RF-29 | Descargar inventario completo en JSON (bloques 1000) | Alta |
| RF-30 | Descargar inventario completo en CSV (bloques 1000) | Alta |
| RF-31 | CSV incluye columnas: id, codigo, nombre, estado, responsable, ubicacion | Alta |
| RF-32 | Normalizar IDs antiguos de ubicación a nombres en exportación | Alta |
| RF-33 | Exportación resuelve nombres de responsables (no IDs) | Alta |

### 3.6 Vista de detalle de bien (BienDetail)

| ID   | Requisito | Prioridad |
|------|-----------|-----------|
| RF-34 | **Desktop:** layout en 2 columnas — detalle a la izquierda, historial de cambios a la derecha | Media |
| RF-35 | **Móvil:** detalle completo en una columna, sección "Datos SIGA PJ" colapsable (cerrada por defecto) | Media |
| RF-36 | Historial muestra cambios con usuario, timestamp, campo afectado, valor anterior → nuevo | Alta |
| RF-37 | Avatar del usuario que hizo el cambio en historial | Media |
| RF-38 | Botones Editar (si permisos) y Eliminar (si admin) con confirmación | Alta |

### 3.7 Datos maestros

| ID   | Requisito | Prioridad |
|------|-----------|-----------|
| RF-39 | Cargar trabajadores desde Supabase | Alta |
| RF-40 | Cargar ubicaciones desde Supabase | Alta |
| RF-41 | Cache de trabajadores y ubicaciones en frontend (TTL 15 min) | Media |
| RF-42 | Select de responsable es buscable por nombre | Alta |

### 3.8 PWA y deploy

| ID   | Requisito | Prioridad |
|------|-----------|-----------|
| RF-43 | Instalable como PWA en móvil | Media |
| RF-44 | Deploy en Vercel | Alta |
| RF-45 | Service worker para precaching | Media |

### 3.9 Asistente IA (Chat)

| ID   | Requisito | Prioridad |
|------|-----------|-----------|
| RF-46 | Panel chat lateral (Sheet) con icono Bot en header/sidebar/bottom-nav | Alta |
| RF-47 | Entrada de usuario con Textarea (Shift+Enter para nueva línea, Enter envía) | Alta |
| RF-48 | Historial de conversación visible durante la sesión (se pierde al recargar) | Media |
| RF-49 | Typing indicator (3 puntos rebotando) mientras el asistente procesa | Media |
| RF-50 | 4 sugerencias de ejemplo al abrir chat vacío | Media |
| RF-51 | Botón limpiar conversación (icono papelera) | Media |
| RF-52 | Soporte para 4 tools: buscar por código exacto, búsqueda filtrada, conteos, listar por responsable | Alta |
| RF-53 | Contexto multi-turno: si usuario preguntó por "Milton" antes, preguntas sin nombre se asumen de Milton | Alta |
| RF-54 | Ambigüedad: asistente pregunta aclaración en lugar de adivinar trabajadores | Alta |
| RF-55 | Asistente no puede crear, editar ni eliminar bienes (solo lectura) | Alta |
| RF-56 | Respuestas en español, claras y concisas | Alta |
| RF-57 | Acceso: todos los roles (admin, operador, consulta) pueden usar el chat | Alta |
| RF-58 | Edge Function `ai-chat` usa Gemini 2.5 Flash API con billing | Alta |
| RF-59 | Agentic loop: máximo 5 iteraciones por pregunta para soportar multi-turn tool calls | Alta |

### 3.10 Edición rápida de bienes

| ID   | Requisito | Prioridad |
|------|-----------|-----------|
| RF-60 | Menú ⋮ en cada resultado de búsqueda con opciones: Ver detalle, Editar estado, Editar responsable, Editar ubicación | Media |
| RF-61 | Dialog QuickEditBienDialog precarga el valor actual del campo a editar | Alta |
| RF-62 | Actualiza Supabase e historial sin recargar resultados | Alta |

### 3.11 Autenticación y seguridad

| ID   | Requisito | Prioridad |
|------|-----------|-----------|
| RF-63 | Mostrar pantalla de login antes de acceder al sistema | Alta |
| RF-64 | Permitir primer acceso por correo (OTP o enlace; producto usa **OTP** como flujo principal) | Alta |
| RF-65 | Tras primer acceso exitoso, invitar a registrar una passkey/WebAuthn en el mismo dispositivo | Alta |
| RF-66 | Permitir siguientes accesos con passkey/WebAuthn cuando el dispositivo/navegador lo soporte | Alta |
| RF-67 | Proteger rutas privadas: Home, Scan, Registro, Search, Detail, Editar | Alta |
| RF-68 | Cerrar sesión explícitamente desde interfaz y limpiar estado local sensible | Alta |
| RF-69 | Bloquear temporalmente intentos excesivos por usuario/IP y mostrar mensaje claro | Alta |
| RF-70 | Registrar eventos de seguridad básicos (login ok, login fallido, bloqueo) | Media |
| RF-71 | Ofrecer **OTP por correo** (u otro fallback sin passkey) cuando la passkey no exista, falle o no esté disponible en el dispositivo | Alta |
| RF-72 | UX de error no técnica: mensajes claros para enlace expirado, passkey no disponible o autenticación cancelada | Alta |
| RF-73 | Permitir registrar o volver a registrar passkey desde una sesión autenticada | Media |

---

## 4. Requisitos no funcionales

| ID    | Requisito |
|-------|-----------|
| RNF-01 | Mobile-first, responsive (funciona en screens 320px+) |
| RNF-02 | HTTPS obligatorio (cámara y PWA) |
| RNF-03 | Tiempo de escaneo < 3 segundos |
| RNF-04 | Cámara solo activa en modal (ahorro batería) |
| RNF-05 | Credenciales Supabase en variables de entorno |
| RNF-06 | No saturar Supabase: paginación e índices |
| RNF-07 | Índice en `codigo_patrimonial` para búsqueda rápida |
| RNF-08 | Soportar 1900+ registros sin degradación |
| RNF-09 | Exportación en bloques 1000 (límite Supabase) |
| RNF-10 | Resolución automática de ubicaciones antiguas (ID → nombre) |
| RNF-11 | Sesiones autenticadas con expiración y renovación controlada |
| RNF-12 | Rate limiting para envío de códigos/correo de login y sesiones para reducir abuso |
| RNF-13 | Mensajes de autenticación claros en español y orientados a acción |
| RNF-14 | Auditoría mínima de accesos y eventos de seguridad |
| RNF-15 | Arquitectura compatible con passkeys/WebAuthn como método principal recurrente sin reescribir flujo principal |
| RNF-16 | Operar sin dominio propio: usar dominio provisto por plataforma (Vercel) |
| RNF-17 | Cookies/sesión seguras bajo HTTPS en entorno productivo |
| RNF-18 | **Interfaz visual moderna:** shadcn/ui + Tailwind CSS 4 + Lucide icons |
| RNF-19 | **Soporte dark mode/light mode:** persiste en localStorage vía next-themes |
| RNF-20 | **Validación de formularios tipada:** react-hook-form + zod |
| RNF-21 | **Componentes reutilizables:** Button, Input, Select, Card, Dialog, AlertDialog, Table, etc. desde shadcn/ui |
| RNF-22 | **Accesibilidad:** componentes shadcn/ui con ARIA labels, tabindex, keyboard navigation |

---

## 5. Modelo de datos (Supabase)

### bienes

- `id` (PK)
- `codigo_patrimonial` (unique, indexed) — código de barras
- `nombre_mueble_equipo` — nombre o modelo del bien
- `tipo_mueble_equipo` (nullable) — tipo genérico (mueble, equipo, etc.)
- `estado` — Nuevo, Bueno, Regular, Malo, Muy malo
- `id_trabajador` (FK a trabajadores, nullable)
- `ubicacion` — **texto (nombre)**, no ID. Resuelto desde catálogo
- `fecha_registro` — timestamp
- `eliminado_at` (nullable) — soft delete

### trabajadores

- `id` (PK)
- `nombre` — nombre del trabajador

### ubicaciones

- `id` (PK)
- `nombre` — nombre de ubicación

---

## 6. Criterios de aceptación

### Duplicados

- **Dado** que escaneo un código ya registrado
- **Cuando** presiono "Continuar"
- **Entonces** se muestra alerta "Bien ya registrado"
- **Y** se muestran: código, nombre, estado, responsable, ubicación (con nombres resueltos)
- **Y** puedo elegir "Ver detalle", "Editar", "Registrar otro" o "Cancelar"
- **Y** no se muestra el formulario de Create

### CRUD

- **Create**: escaneo o escribo código → no duplicado → formulario → guardar → éxito → opciones Ver/Editar/Registrar otro
- **Read**: desde alerta duplicado o búsqueda, abro detalle con todos los campos (nombres resueltos)
- **Update**: desde detalle o alerta, edito y guardo sin perder datos
- **Delete**: desde detalle, confirmo → eliminar → vuelvo a Home

### Exportación

- **Copiar**: genera texto formateado listo para chat (código, nombre, estado, responsable, ubicación)
- **JSON**: valida formato, incluye todos los campos con nombres resueltos
- **CSV**: incluye encabezado y columnas en orden (id, codigo, nombre, estado, responsable, ubicacion)
- **Descarga todo**: pagina en bloques 1000 sin bloquear UI

### Búsqueda

- Filtro por código exacto busca en Supabase indexado
- Filtro por responsable abre select buscable con cache
- Resultados paginados muestran máximo 20 items
- Click resultado navega a detalle con todos los datos

### Autenticación (OTP por correo + passkeys)

- **Dado** que ingreso un correo válido en login
- **Cuando** solicito acceso
- **Entonces** recibo un **código OTP** por correo y puedo iniciar sesión al introducirlo mientras esté vigente
- **Y** puedo registrar y usar **passkeys/WebAuthn** desde `/login` y gestionarlas en `/security`
- **Y** en accesos posteriores puedo autenticarme con passkey sin depender del correo (si hay credencial registrada)
- **Y** si la passkey no está disponible o falla, puedo usar **OTP por correo** como fallback
- **Y** si el enlace expira o la autenticación se cancela se muestra error claro con opción de reintento
- **Y** tras múltiples intentos fallidos se bloquea temporalmente el acceso y se informa el tiempo de espera
- **Y** al iniciar sesión se habilita acceso a rutas protegidas

---

## 7. Estrategias de rendimiento (1900+ registros)

| Operación | Estrategia |
|-----------|-----------|
| Duplicados | Índice en `codigo_patrimonial` + `.eq().maybeSingle()` |
| Selectores | Cache en `CatalogContext` (TTL 15 min) |
| Búsqueda | Filtros en Supabase, paginación `.range()` |
| Listado | Paginación de 20 en 20, nunca cargar todo |
| Exportación | Bloques de 1000 registros |
| Columnas | `.select()` solo necesarias, nunca `*` |
| Cámara | Solo activa en modal, se libera al cerrar |

---

## 8. Características destacadas (v2)

### 1. Flujo de entrada de código optimizado
- Campo input directo en `Scan`
- Icono 📷 abre modal de cámara
- Opción "Escribir manualmente" dentro del escáner
- Modal cierra automáticamente al detectar código o al presionar ✕

### 2. Exportación inteligente
- **Copiar**: texto legible para WhatsApp, Telegram, email
- **JSON**: formato estándar, datos resueltos
- **CSV**: compatible con Excel, con todas las columnas
- **Descarga todo**: en bloques 1000 (no bloqueante)

### 3. Normalización de datos
- Ubicaciones: se guardan nombres (string), se resuelven IDs antiguos automáticamente
- Responsables: se muestran nombres en todas las vistas
- Estado: incluido en búsqueda, detalle y exportación

### 4. Ahorro de batería
- Cámara solo activa dentro del modal
- Se libera automáticamente al cerrar
- CameraContext centraliza manejo del stream

### 5. Vista de detalle responsive (2026-04-27)
- **Desktop:** layout en 2 columnas — datos del bien a la izquierda, historial de cambios a la derecha (para consulta paralela)
- **Móvil:** una sola columna, datos básicos siempre visibles, sección "Datos SIGA PJ" colapsable para ahorrar espacio
- **Chevron rotatorio** en encabezado de SIGA PJ indica estado abierto/cerrado en móvil

### 6. Edición rápida sin recargar (2026-04-27)
- Menú ⋮ en resultados de búsqueda para editar un campo por vez (Estado, Responsable, Ubicación)
- Dialog precarga el valor actual — no hay confusión sobre qué cambiar
- Actualiza Supabase e historial sin refrescar la lista — experiencia fluida

---

## 9. Restricciones conocidas

- Quagga2 fallback en navegadores sin BarcodeDetector (Safari, Chrome desktop)
- Supabase limita queries a 1000 registros (se resuelve con paginación)
- Ubicación antigua como ID se resuelve en visualización (no en BD)
- Sin dominio propio en esta fase: se usa subdominio de plataforma para despliegue.
- Al no tener dominio propio, no se implementan políticas avanzadas de correo corporativo (SPF/DKIM/DMARC personalizadas) en esta etapa.
- La adopción de passkeys/WebAuthn depende del soporte del dispositivo, navegador y gestor de credenciales del usuario.

---

## 10. Métricas de éxito (básicas)

| Métrica | Definición | Meta inicial |
|---------|------------|--------------|
| Tasa de login exitoso | % de inicios de sesión exitosos sobre intentos totales | >= 90% |
| Tiempo medio de primer login | Tiempo desde solicitud de código/correo hasta sesión activa | <= 60 segundos |
| Adopción de passkeys | % de usuarios que registran passkey tras primer acceso exitoso | >= 70% |
| Tasa de login con passkey | % de accesos recurrentes completados con passkey sobre accesos recurrentes totales | >= 60% |
| Magic link expirado/fallido | % de intentos fallidos por enlace vencido o inválido | <= 10% |
| Intentos bloqueados | Cantidad de bloqueos temporales por abuso en ventana definida | Monitoreado; tendencia estable o a la baja |
| Reintento exitoso tras error | % de usuarios que corrigen y logran login tras un fallo inicial | >= 70% |

---

## 11. Historial de cambios

### Versión 2026-04-27
- **BienDetail rediseño:** layout 2 columnas en desktop (detalle + historial lado a lado), SIGA PJ colapsable en móvil
- **QuickEditBienDialog precarga:** dialog ahora muestra el valor actual del campo antes de editar (fix sincronización con useEffect)
- **Edición rápida mejorada:** acceso directo desde búsqueda con menú ⋮

### Versión 2026-04-24
- **CORS fix en admin-users:** Edge Function ahora soporta PATCH y OPTIONS (permite aprobar/rechazar usuarios)
- **Error handling mejorado:** mensajes de error incluyen detalles del servidor para diagnóstico

### Versión 2026-04-23
- **Chat IA con Gemini:** integración de Google Gemini 2.5 Flash con agentic loop (máx. 5 iteraciones), 4 tools especializadas
- **Sidebar colapsable:** toggle en desktop para expandir/contraer (persistido en localStorage)
- **Filtros móvil:** búsqueda avanzada bajo botón colapsable en pantallas < lg
- **Búsqueda con URL:** filtros guardados en parámetros de query para navegación consistente
