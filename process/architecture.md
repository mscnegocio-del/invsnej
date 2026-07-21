# Arquitectura — invsnej

## Estructura del repo
```
invsnej/
├── AGENTS.md / memory.md / process/   ← harness del agente
├── PRD.md, claude.md, architecture.md, design.md, PLAN_IMPLEMENTACION.md  ← docs históricos
├── sql/                    ← migraciones numeradas (001..005: perfiles/RLS, RPCs admin, acceso_estado, sedes)
├── scripts/                ← utilidades (plantilla email magic link)
├── supabase/functions/     ← Edge Functions Deno
│   ├── ai-chat/            ← chat IA: Gemini 2.5 Flash + tool-calling (solo lectura)
│   ├── passkeys/           ← WebAuthn (registro/autenticación)
│   └── admin-users/        ← gestión de usuarios (invitar, aprobar, suspender)
└── web/                    ← app Vite + React 19
    └── src/
        ├── pages/          ← Home (hub único), Scan, Registro, Search, BienDetail, EditarBien,
        │                     Trabajadores, SigaPJ, Admin, Login, Security, SedeSelector,
        │                     AuthCallback, Agente, AgenteV2 (+ agente-v2.css)
        ├── components/     ← AIChatPanel, AgentCards, BarcodeScanner/Modal, BienForm,
        │                     CommandPalette (⌘K, incluye "Secciones"), Layout (sin sidebar/
        │                     bottom-nav — barra superior única), guards, ui/ (shadcn)
        ├── hooks/          ← useAIChat, useSpeechRecognition, useBarcodeScanner, useWebAuthn
        ├── context/, lib/ (incl. navSections.ts), types.ts
```

## Navegación (post-rediseño 2026-07-21)
No hay sidebar de escritorio ni bottom-nav de móvil. `Layout.tsx` es una sola barra
superior (igual en ambos breakpoints) con: logo → Home, botón "Inicio" (Link a `/`, visible
solo fuera de Home — reemplaza el `navigate(-1)` anterior), ⌘K, chat IA, tema, sede, usuario,
salir. **Home es el hub único**: todas las secciones son tarjetas ahí. `web/src/lib/
navSections.ts` es la fuente de las rutas para el grupo "Secciones" de `CommandPalette`
(⌘K), filtrado por rol — es el mecanismo de navegación rápida para desktop.

## Flujo del chat IA actual (base del Modo Agente)
1. `AIChatPanel` (UI) → `useAIChat` → `supabase.functions.invoke('ai-chat', { messages })`
2. Edge Function `ai-chat`:
   - Llama a Gemini 2.5 Flash (`generateContent`) con `tools` (function declarations),
     system prompt en español, temperature 0.1, thinkingBudget 0, retry con backoff en 429
   - Loop de tool-calling (máx 5 iteraciones); ejecuta tools contra Supabase con service_role
   - Historial: últimos 6 mensajes; respuesta: `{ reply: string }` (solo texto)
3. Tools actuales (solo lectura, soft-delete respetado con `eliminado_at IS NULL`):
   `buscar_bien_por_codigo`, `buscar_bienes`, `contar_bienes`, `listar_bienes_por_responsable`

## Modo Agente (diseño objetivo)
- Ruta nueva `/agente`: conversación a pantalla completa, entrada texto + micrófono
  (Web Speech API, es-PE), pensada como interfaz principal alternativa a la navegación
- La Edge Function evoluciona para devolver **respuestas estructuradas**
  (`{ reply, data?: { tipo: 'bien'|'lista'|'conteo', ... } }`) y el frontend renderiza
  tarjetas/tablas reutilizando componentes existentes (ficha de bien, tabla de resultados)
- Fase 2: tools de escritura (editar estado/ubicación/responsable, registrar bien) SIEMPRE con
  paso de confirmación visual en la UI antes de ejecutar; registrar en `bien_historial`
- Fase 3: exports (CSV/JSON) generados desde el chat
- Seguridad: `/agente` detrás de AuthGuard; validar JWT del usuario en la Edge Function y
  respetar rol (`consulta` no puede acciones de escritura aunque la tool exista)

## Restricciones de entorno
- Claves (GEMINI_API_KEY, service_role) solo en secrets de Edge Functions
- Frontend usa anon key + RLS; acceso solo con perfil `acceso_estado='activo'` y `activo=true`
- Deploy: push a `main` → Vercel build (`web/`, framework Vite); Edge Functions se despliegan
  con `supabase functions deploy` o vía MCP
