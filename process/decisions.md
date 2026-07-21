# Decisiones técnicas — invsnej

| Decisión | Fecha | Alternativas descartadas | Razón |
|---|---|---|---|
| Modo Agente usa la API de Gemini existente (Edge `ai-chat`) | 2026-07-20 | API de Anthropic/Claude | Ya hay integración funcionando con tool-calling, key configurada y costo conocido; evita duplicar proveedores |
| Modo Agente como evolución de `ai-chat`/`AIChatPanel`, ruta nueva `/agente` | 2026-07-20 | Sistema paralelo desde cero | Reutiliza tools, retry, prompt y UI probados; menor riesgo |
| Fases: 1 lectura+voz+tarjetas → 2 escritura con confirmación → 3 exports | 2026-07-20 | Lanzar escritura desde el inicio | Valor rápido sin riesgo; las acciones destructivas requieren confirmación visual |
| Voz con Web Speech API del navegador | 2026-07-20 | STT de pago (Google/OpenAI/Deepgram) | Gratis, suficiente en móvil para español; swappable después |
| Dictado nunca auto-envía: acumula en el campo de texto, editable, con Detener explícito | 2026-07-20 | Enviar al detectar pausa (primera versión) | Feedback de campo: las pausas naturales cortaban el mensaje y no había control visible |
| Micrófono con auto-apagado: 60 s sin voz, tope 3 min, y al pasar a segundo plano | 2026-07-20 | Dejarlo activo hasta acción del usuario | Un mic olvidado transcribiría el entorno indefinidamente (privacidad + batería); una consulta nunca requiere más de 3 min |
| Fase 2: la Edge solo PROPONE ediciones; la escritura se ejecuta client-side al confirmar | 2026-07-20 | Escribir desde la Edge con service_role tras validar rol | Client-side hereda RLS y sesión real del usuario (rol consulta bloqueado por la BD, no por código), reutiliza el patrón probado de QuickEditBienDialog y el historial queda con el usuario correcto |
| Respuestas estructuradas `{ reply, data? }` desde la Edge Function | 2026-07-20 | Solo texto plano | Permite UI generativa (tarjetas de bienes) sin parsear texto |
| Gemini 2.5 Flash, temperature 0.1, thinkingBudget 0, máx 5 iteraciones de tools | pre-2026-07 | — | Ya en producción en `ai-chat`; rápido y barato |
| Auth sin contraseña: OTP correo + passkeys; aprobación manual de usuarios | pre-2026-07 | Contraseñas, SSO | Ver PRD.md §2; resistente a phishing, simple en móvil |
| Soft-delete con `eliminado_at` en `bienes` | pre-2026-07 | DELETE físico | Trazabilidad; todas las queries filtran `eliminado_at IS NULL` |
