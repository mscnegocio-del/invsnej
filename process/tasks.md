# Tareas — invsnej

## Épica E1: Modo Agente — Fase 1 (solo lectura) 🔄
1. [x] Ruta `/agente` con AuthGuard + página conversacional a pantalla completa (móvil primero)
2. [x] Entrada por voz con Web Speech API (es-PE) + botón micrófono; fallback a texto
3. [x] Extender `ai-chat` para devolver datos estructurados junto al texto (`{ reply, cards }`)
4. [x] Renderizar tarjetas en el chat: ficha de bien, lista de resultados, conteo (`AgentCards.tsx`)
5. [x] Enlace "Agente" en la navegación (Layout, todos los roles)
6. [x] Desplegar Edge Function `ai-chat` actualizada (v34, activa)
7. [x] Deploy frontend en producción (PR #5 mergeado, Vercel READY)
8. [x] Fix voz tras feedback de campo (PR #6 mergeado): dictado continuo, texto editable, botón Detener
9. [ ] Protección de micrófono olvidado: timeout de inactividad (60 s), tope de sesión (3 min),
       apagado en segundo plano, con aviso en la UI
10. [ ] Validar dictado corregido en móvil real y recoger más feedback de la Fase 1

## Épica E2: Modo Agente — Fase 2 (acciones con confirmación) 🔄
1. [x] Tool `proponer_edicion_bien` (estado/ubicación/responsable): NO escribe, valida y
       devuelve card `confirmacion`; system prompt actualizado (el modelo nunca afirma haber editado)
2. [x] `ConfirmacionCard`: diff antes→después, Confirmar/Cancelar, ejecución client-side con
       la sesión del usuario (RLS respeta rol; `canEdit` oculta Confirmar a rol consulta) +
       inserción en `bien_historial` por campo
3. [x] Desplegar `ai-chat` v35 con la nueva tool; probado en producción
4. [ ] Registro de bienes desde el chat (evaluar: proponer registro vs enlace a /registro prellenado)

## Épica E1b: `/agente-v2` — rediseño visual HUD (experimental) 🔄
1. [x] Prototipo visual validado con el usuario (núcleo circular, esquinas cortadas, ámbar
       solo para confirmaciones, orbe anclado + scroll con degradado, responsivo con clamp())
2. [x] Implementado como ruta paralela `/agente-v2`, CSS aislado (`agente-v2.css`, scoped `.av2`),
       reutilizando `useAIChat`/`useSpeechRecognition`/lógica de confirmación reales
3. [ ] Probar en campo y decidir: ¿reemplaza `/agente`, queda como alterna, o se descarta?
4. [ ] Si se adopta: retemar vía shadcn (tokens `--radius`, paleta) en vez de CSS aislado

## Épica E3: Modo Agente — Fase 3 (exports/reportes) ⏳
- Generar CSV/JSON desde el chat ("mándame los bienes en mal estado de la sede 2")

## Backlog / deuda
- [ ] Evaluar habilitar RLS en `auth_webauthn_challenges` (advisory Supabase) sin romper
      las Edge Functions (usan service_role, no les afecta RLS)
- [ ] Índice en `bienes.codigo_patrimonial` si no existe (búsquedas rápidas)
