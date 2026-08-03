# AGENTS.md — invsnej (Inventario Patrimonial) v2
> Generado: 2026-07-20

## Qué es
App web móvil de inventario patrimonial: escaneo de códigos de barras, CRUD de bienes,
validación de duplicados, multi-sede, exports y chat IA. ~1900+ bienes en producción.

## Stack técnico
- Frontend: React 19 + Vite 6 + Tailwind 4 + shadcn/ui (carpeta `web/`)
- Backend: Supabase (Postgres 17) — proyecto `inventario` (`hegtvsuscaaifqqhbbxq`, us-west-2)
- Edge Functions (Deno): `ai-chat` (Gemini 2.5 Flash), `passkeys` (WebAuthn), `admin-users`
- IA: **Gemini API** (`GEMINI_API_KEY` en secrets de la Edge Function) — es el proveedor oficial del proyecto
- Auth: OTP por correo + passkeys/WebAuthn; roles en `perfiles.app_role` (admin|operador|consulta)
- Deploy: Vercel — proyecto `invsnej` (`prj_NUeYWSxaqzw5GgGrWrP13cjTvLSx`), dominio invsnej.vercel.app

## Convenciones obligatorias
- Todo el código de la app vive en `web/`; SQL versionado en `sql/NNN_*.sql`
- UI con shadcn/ui + lucide-react; formularios con react-hook-form + zod
- Textos de UI y respuestas del agente en español
- NUNCA exponer claves de API (Gemini, service_role) en el frontend — solo en Edge Functions
- NUNCA hacer queries de escritura sin pasar por RLS/rol del usuario; soft-delete vía `eliminado_at`
- Cambios de esquema: agregar archivo SQL numerado en `sql/` (no editar los anteriores)
- Commits: mensaje corto en español, imperativo

## Reglas de trabajo
- Leer `memory.md` al inicio de cada sesión
- Actualizar `memory.md` después de cada acción relevante (no solo al final de la sesión):
  cambios de infraestructura, PRs creados/mergeados, fixes desplegados, decisiones tomadas
- Para contexto profundo → `process/` (rutas abajo)
- Docs históricos en raíz (PRD.md, claude.md, architecture.md, design.md, PLAN_IMPLEMENTACION.md):
  son referencia; el estado vivo está en memory.md y process/

## Visión actual: "Modo Agente"
Nueva subpágina `/agente`: interfaz conversacional (texto + voz) donde el usuario pide y el
agente ejecuta — buscar, contar, mostrar fichas de bienes como tarjetas, y luego acciones con
confirmación. Se construye SOBRE lo existente: Edge Function `ai-chat` (Gemini + tools) y
`useAIChat`/`AIChatPanel`. Detalle y fases → `process/tasks.md` y `process/decisions.md`.

## Contexto profundo → process/
- Arquitectura: `process/architecture.md`
- Tareas/Sprint: `process/tasks.md`
- Decisiones: `process/decisions.md`
- Esquema BD: `process/db-schema.md`

## Estado actual → memory.md
