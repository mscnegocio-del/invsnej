# Tareas — invsnej

## Épica E1: Modo Agente — Fase 1 (solo lectura) 🔄
1. [x] Ruta `/agente` con AuthGuard + página conversacional a pantalla completa (móvil primero)
2. [x] Entrada por voz con Web Speech API (es-PE) + botón micrófono; fallback a texto
3. [x] Extender `ai-chat` para devolver datos estructurados junto al texto (`{ reply, cards }`)
4. [x] Renderizar tarjetas en el chat: ficha de bien, lista de resultados, conteo (`AgentCards.tsx`)
5. [x] Enlace "Agente" en la navegación (Layout, todos los roles)
6. [x] Desplegar Edge Function `ai-chat` actualizada (v34, activa)
7. [x] Deploy frontend en producción (PR #5 mergeado, Vercel READY)
8. [ ] Fix voz tras feedback de campo (PR #6): dictado continuo, texto editable, botón Detener
9. [ ] Validar dictado corregido en móvil real y recoger más feedback de la Fase 1

## Épica E2: Modo Agente — Fase 2 (acciones con confirmación) ⏳
- Tools de escritura: editar estado/ubicación/responsable, registrar bien
- Confirmación visual obligatoria antes de ejecutar; respetar rol del usuario (JWT en Edge)
- Registrar cambios en `bien_historial`

## Épica E3: Modo Agente — Fase 3 (exports/reportes) ⏳
- Generar CSV/JSON desde el chat ("mándame los bienes en mal estado de la sede 2")

## Backlog / deuda
- [ ] Evaluar habilitar RLS en `auth_webauthn_challenges` (advisory Supabase) sin romper
      las Edge Functions (usan service_role, no les afecta RLS)
- [ ] Índice en `bienes.codigo_patrimonial` si no existe (búsquedas rápidas)
