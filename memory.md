# Estado actual — invsnej
> Última actualización: 2026-07-20 (sesión 2: Fase 1 en producción, protecciones de mic, inicio Fase 2)

## ✅ Completado
- [x] Modo Agente Fase 1 EN PRODUCCIÓN (PR #5 mergeado): página `/agente` con voz y
      tarjetas ricas; Edge Function `ai-chat` v34 desplegada devolviendo `{ reply, cards }`
- [x] Fix de dictado (PR #6 mergeado): dictado continuo, texto acumulado editable, botón Detener
- [x] Protección de micrófono olvidado (PR #8 mergeado): inactividad 60 s, tope 3 min,
      apagado en segundo plano, aviso en UI
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
- [ ] Fase 2 — ediciones con confirmación (en PR abierto): tool `proponer_edicion_bien` en
      `ai-chat` (NO escribe; propone estado/ubicación/responsable y devuelve card
      `confirmacion`), `ConfirmacionCard` en frontend con Confirmar/Cancelar. La escritura se
      ejecuta CLIENT-SIDE con la sesión del usuario (RLS manda; rol consulta no puede) +
      registro en `bien_historial`, reutilizando el patrón de QuickEditBienDialog.
      Pendiente tras merge: desplegar `ai-chat` (nueva versión) y probar en producción.
- [ ] Fase 2 restante: registro de bienes por voz/chat (quizá vía enlace a /registro
      prellenado) — aún no implementado

## ⚠️ Decisiones de esta sesión
- El Modo Agente usará la **API de Gemini ya existente** (Edge Function `ai-chat`), NO Anthropic
- Se construye como evolución de `ai-chat`/`AIChatPanel`, no como sistema paralelo
- Fases: 1) solo lectura + voz + tarjetas ricas, 2) acciones con confirmación, 3) exports/reportes
- UX de voz: el dictado NUNCA se envía solo — se acumula en el campo de texto y el usuario
  revisa/edita y envía; detener es siempre acción explícita del usuario

## 🔴 Bloqueantes
- Ninguno. Nota de seguridad pendiente de decidir: la tabla `auth_webauthn_challenges` tiene
  RLS deshabilitado (advisory de Supabase); evaluar habilitar RLS con políticas adecuadas
  (la usan solo las Edge Functions con service_role, pero queda expuesta a la anon key)

## 📌 Próximos pasos (próxima sesión)
- Merge del PR de Fase 2, desplegar `ai-chat` y probar edición por voz en producción
- Completar Fase 2: registro de bienes desde el chat
- Luego Fase 3: exports/reportes desde el chat (Épica E3)
