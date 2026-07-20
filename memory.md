# Estado actual — invsnej
> Última actualización: 2026-07-20

## ✅ Completado
- [x] App de inventario en producción (Vercel `invsnej` + Supabase `inventario`), ~1900+ bienes
- [x] CRUD de bienes, escaneo de barras (BarcodeDetector + Quagga2), duplicados, exports
- [x] Multi-sede (`sedes`), catálogo SIGA (`siga_bienes`), historial (`bien_historial`)
- [x] Auth: OTP por correo + passkeys/WebAuthn, aprobación de usuarios, roles (admin|operador|consulta)
- [x] Chat IA existente: Edge Function `ai-chat` con Gemini 2.5 Flash y 4 tools de solo lectura
      (buscar_bien_por_codigo, buscar_bienes, contar_bienes, listar_bienes_por_responsable);
      frontend en `useAIChat.ts` + `AIChatPanel.tsx`
- [x] Harness creado (AGENTS.md, memory.md, process/)
- [x] Verificado acceso MCP a Supabase (`hegtvsuscaaifqqhbbxq`) y Vercel (`prj_NUeYWSxaqzw5GgGrWrP13cjTvLSx`)

## 🔄 En progreso
- [ ] Modo Agente (`/agente`): definición aprobada por el usuario, pendiente implementar Fase 1
      (ver process/tasks.md — Épica E1)

## ⚠️ Decisiones de esta sesión
- El Modo Agente usará la **API de Gemini ya existente** (Edge Function `ai-chat`), NO Anthropic
- Se construye como evolución de `ai-chat`/`AIChatPanel`, no como sistema paralelo
- Fases: 1) solo lectura + voz + tarjetas ricas, 2) acciones con confirmación, 3) exports/reportes

## 🔴 Bloqueantes
- Ninguno. Nota de seguridad pendiente de decidir: la tabla `auth_webauthn_challenges` tiene
  RLS deshabilitado (advisory de Supabase); evaluar habilitar RLS con políticas adecuadas
  (la usan solo las Edge Functions con service_role, pero queda expuesta a la anon key)

## 📌 Próximos pasos (próxima sesión)
- Implementar Fase 1 del Modo Agente: ruta `/agente`, UI conversacional a pantalla completa,
  entrada por voz (Web Speech API), respuestas con tarjetas de bienes reutilizando componentes
- Extender `ai-chat` para devolver datos estructurados (no solo texto) que el frontend renderice
