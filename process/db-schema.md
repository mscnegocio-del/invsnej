# Esquema BD — Supabase `inventario` (hegtvsuscaaifqqhbbxq)
> Snapshot: 2026-07-20. Todas las tablas con RLS habilitado salvo donde se indica.

## bienes (tabla central)
- `id` bigint PK identity
- `codigo_patrimonial` text — identificador del barcode; validar duplicados con él
- `nombre_mueble_equipo` text, `tipo_mueble_equipo` text
- `estado` text CHECK: Nuevo | Bueno | Regular | Malo | Muy malo
- `ubicacion` text (nombre, no FK), `sede_id` int → sedes.id
- `marca`, `modelo`, `serie`, `orden_compra` text; `valor` numeric
- `id_trabajador` bigint → trabajadores.id (responsable)
- `creado_por` uuid → auth.users, `creado_por_email` text, `fecha_registro` timestamptz
- `eliminado_at` timestamptz — soft-delete (filtrar `IS NULL` siempre)

## trabajadores
- `id` bigint PK, `nombre` text UNIQUE, `cargo` text, `sede_id` bigint → sedes.id

## sedes
- `id` int PK, `nombre` text, `codigo` text UNIQUE

## ubicaciones
- `id` bigint PK, `nombre` text UNIQUE (catálogo; `bienes.ubicacion` guarda el texto)

## siga_bienes (catálogo SIGA importado de Excel)
- `id` int PK, `codigo_patrimonial` text UNIQUE, `descripcion`, `usuario`, `marca`, `modelo`,
  `serie`, `orden_compra`, `valor`, `fecha_carga`, `fecha_actualizacion`

## bien_historial (auditoría de cambios)
- `id` int PK, `bien_id` → bienes.id, `accion` CHECK: creacion | edicion | eliminacion
- `campo`, `valor_antes`, `valor_despues` text; `usuario_id` uuid → auth.users,
  `usuario_email`, `fecha`

## perfiles (roles y acceso)
- `id` uuid PK → auth.users.id, `nombre` text
- `app_role` CHECK: admin | operador | consulta (default consulta)
- `acceso_estado` CHECK: pendiente | activo | rechazado (default pendiente)
- `activo` bool — RLS concede acceso solo con `acceso_estado='activo'` AND `activo=true`

## Auth/passkeys
- `user_passkeys`: credenciales WebAuthn por usuario (credential_id UNIQUE, counter, revoked_at…)
- `auth_webauthn_challenges`: challenges temporales de registro/login — ⚠️ **RLS DESHABILITADO**
  (advisory crítico de Supabase; la usan Edge Functions con service_role — evaluar habilitar RLS)

## RPCs relevantes (ver sql/)
- `auth_user_id_by_email` (solo service_role), RPC listado de usuarios admin, `is_session_active()`
