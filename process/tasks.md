# Tareas — invsnej

## Épica E1: Modo Agente — Fase 1 (solo lectura) 🔄
1. [ ] Ruta `/agente` con AuthGuard + página conversacional a pantalla completa (móvil primero)
2. [ ] Entrada por voz con Web Speech API (es-PE) + botón micrófono; fallback a texto
3. [ ] Extender `ai-chat` para devolver datos estructurados junto al texto
       (`{ reply, data?: { tipo, payload } }`)
4. [ ] Renderizar tarjetas en el chat: ficha de bien, lista de resultados, conteo
       (reutilizar componentes/estilos existentes)
5. [ ] Enlace de entrada al modo agente desde Home/Layout
6. [ ] Probar en producción con casos reales de campo

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
