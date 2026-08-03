# Estado actual — invsnej
> Última actualización: 2026-08-03 (sesión 4: proyecto Supabase se pausó por inactividad;
> reanudado y agregado workflow de keep-alive para que no vuelva a pasar)

## ✅ Completado
- [x] Proyecto Supabase `inventario` se había pausado (plan free, ~7 días sin consultas a la
      API). Reanudado (`restore_project`, quedó `ACTIVE`). Fix permanente: PR #30 mergeado a
      `main` — `.github/workflows/supabase-keep-alive.yml`, corre cada 4 días vía GitHub
      Actions (cron, + `workflow_dispatch` manual), hace `GET /rest/v1/sedes?select=id&limit=1`
      con la anon key (pública, protegida por RLS; no requiere secrets en el repo). No depende
      de sesiones de Claude — corre siempre mientras el repo exista en GitHub.
- [x] Modo Agente Fase 1 EN PRODUCCIÓN (PR #5 mergeado): página `/agente` con voz y
      tarjetas ricas; Edge Function `ai-chat` v34 desplegada devolviendo `{ reply, cards }`
- [x] Fix de dictado (PR #6 mergeado): dictado continuo, texto acumulado editable, botón Detener
- [x] Protección de micrófono olvidado (PR #8 mergeado): inactividad 60 s, tope 3 min,
      apagado en segundo plano, aviso en UI
- [x] Fase 2 — ediciones con confirmación (PR #9 mergeado + `ai-chat` v35 desplegada):
      tool `proponer_edicion_bien`, `ConfirmacionCard` con Confirmar/Cancelar, escritura
      client-side con RLS, registro en `bien_historial`
- [x] Tarjeta destacada "Pregúntale al inventario" en Home (en PR abierto), enlaza a
      `/agente` (NO a v2, que sigue en pruebas) — el Agente ya no está escondido en el
      menú lateral, es lo primero visible al entrar
- [x] `/agente-v2` EXPERIMENTAL (en PR abierto): rediseño visual estilo Jarvis/HUD —
      núcleo circular como control de voz (ancla fija arriba, no se mueve con el scroll),
      historial en su propio contenedor con degradado en el borde superior (mask-image;
      no permanente — al scrollear arriba el historial se ve completo), paneles con
      esquinas cortadas, ámbar reservado solo a confirmaciones. Reutiliza 100% la lógica
      real (`useAIChat`, `useSpeechRecognition`, escritura+historial) — es un tema visual
      alterno, no un sistema paralelo. CSS aislado bajo `.av2` (`agente-v2.css`) para no
      afectar el resto de la app. Convive con `/agente` (shadcn) para comparar en vivo.
- [x] App de inventario en producción (Vercel `invsnej` + Supabase `inventario`), ~1900+ bienes
- [x] CRUD de bienes, escaneo de barras (BarcodeDetector + Quagga2), duplicados, exports
- [x] Multi-sede (`sedes`), catálogo SIGA (`siga_bienes`), historial (`bien_historial`)
- [x] Auth: OTP por correo + passkeys/WebAuthn, aprobación de usuarios, roles (admin|operador|consulta)
- [x] Chat IA existente: Edge Function `ai-chat` con Gemini 2.5 Flash y 4 tools de solo lectura
      (buscar_bien_por_codigo, buscar_bienes, contar_bienes, listar_bienes_por_responsable);
      frontend en `useAIChat.ts` + `AIChatPanel.tsx`
- [x] Harness creado (AGENTS.md, memory.md, process/)
- [x] Verificado acceso MCP a Supabase (`hegtvsuscaaifqqhbbxq`) y Vercel (`prj_NUeYWSxaqzw5GgGrWrP13cjTvLSx`)

- [x] Rediseño de navegación (PR #12 MERGEADO Y VALIDADO EN CAMPO por el usuario — "todo
      funciona bien"): sin sidebar/bottom-nav, Home como hub único, barra superior con
      botón "Inicio" explícito, ⌘K con grupo "Secciones" (`web/src/lib/navSections.ts`)
- [x] Fase 2 — registro de bienes desde el Agente (PR #14 + PR #15 MERGEADOS Y VALIDADOS
      EN CAMPO por el usuario). Edge Function `ai-chat` v37 desplegada:
      - Tool `proponer_registro_bien`: valida código duplicado (si existe, muestra la
        ficha y sugiere editar en vez de registrar); si viene código, consulta
        `siga_bienes` igual que el flujo manual (`Scan.tsx`) — marca/modelo/serie/OC/
        valor/nombre de SIGA MANDAN sobre lo dicho por voz; resuelve responsable/ubicación
        contra catálogos.
      - Frontend: tarjeta "Registro propuesto" (badge "Desde SIGA" cuando aplica) con
        botón que abre `/registro` prellenado (`BienForm` acepta `pre_*` y reutiliza los
        mismos `siga_*` que ya usaba `Scan.tsx` para los campos que vienen de SIGA).
      - El agente NUNCA inserta directamente: el guardado pasa por el formulario real
        (validación + RLS). Ciclo cerrado: al guardar vuelve al Agente
        (`?registrado=<id>`) y el chat confirma "✅ registrado exitosamente" con la
        ficha; historial del chat persiste en localStorage (ver fix abajo).
      - Validado en campo por el usuario: registro real con autorrelleno SIGA correcto
        (marca/modelo/serie/OC/valor) + confirmación en el chat. También confirmado que
        el Agente rechaza correctamente pedidos de eliminar bienes (no tiene esa tool).
- [x] Fix crítico: eliminar bienes fallaba SIEMPRE para todos (PR #17 mergeado). Causa
      raíz: `bienes_select_activos` exige `eliminado_at IS NULL`, y Postgres exige que la
      fila resultante de un UPDATE también pase la política SELECT — el soft-delete
      (fijar eliminado_at) violaba RLS sin importar el rol. Fix: `sql/006_*` agrega una
      política SELECT extra para admin que sí ve eliminados (ya aplicada en Supabase).
      También se corrigió `BienDetail.tsx`: el registro en `bien_historial` ahora ocurre
      SOLO si el borrado real tuvo éxito (antes se registraba primero, dejando "Baja"
      fantasma en el historial cuando el borrado fallaba — quedaron 2 filas así para el
      bien código 746437120002; el usuario decidió dejarlas, no limpiar).
- [x] Fix: historial del Agente desaparecía en móvil tras navegar/usar la app un rato
      (PR #19 mergeado). Causa: se guardaba en `sessionStorage`, que el SO puede borrar
      al reciclar la pestaña/PWA en segundo plano (bloqueo de pantalla, cambio de app —
      mismo motivo por el que ya existía la protección de "micrófono olvidado"). Fix:
      `useAIChat.ts` ahora usa `localStorage` (atado al origen, sobrevive a eso).
      "Nueva conversación" lo sigue limpiando igual.

## ⚠️ Decisiones de esta sesión
- `/agente-v2` PROBADO EN CAMPO y funciona correctamente, pero QUEDA OCULTO (sin enlace
  en la UI; accesible solo por URL directa) como tema alterno. `/agente` sigue siendo la
  principal; si a futuro se le agregan mejoras que lo justifiquen, v2 podría pasar a principal.
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
- Fase 2 completa. Siguiente: Fase 3 — exports/reportes desde el chat (Épica E3)
- Evaluar nota de seguridad pendiente: RLS en `auth_webauthn_challenges`
