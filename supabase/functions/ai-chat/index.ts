import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
const GEMINI_MODEL = 'gemini-1.5-flash'
const MAX_ITERACIONES = 3

type Message = { role: 'user' | 'assistant' | 'system' | 'tool'; content: string; tool_call_id?: string; name?: string }

type ToolCall = {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

// Herramientas con descripciones compactas
const tools = [
  {
    type: 'function',
    function: {
      name: 'buscar_bien_por_codigo',
      description: 'Busca un bien por código patrimonial exacto',
      parameters: {
        type: 'object',
        properties: {
          codigo: { type: 'string', description: 'Código patrimonial' },
        },
        required: ['codigo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_bienes',
      description: 'Busca bienes con filtros opcionales',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Nombre parcial del bien' },
          tipo: { type: 'string', description: 'Tipo de bien' },
          marca: { type: 'string', description: 'Marca' },
          modelo: { type: 'string', description: 'Modelo' },
          estado: { type: 'string', description: 'Nuevo|Bueno|Regular|Malo|Muy malo' },
          ubicacion: { type: 'string', description: 'Ubicación parcial' },
          orden_compra: { type: 'string', description: 'Orden de compra' },
          nombre_responsable: { type: 'string', description: 'Nombre del responsable' },
          limit: { type: 'number', description: 'Máx resultados (def 10, max 50)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'contar_bienes',
      description: 'Cuenta bienes con filtros. Usar para "¿cuántos?"',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Nombre parcial' },
          tipo: { type: 'string', description: 'Tipo' },
          marca: { type: 'string', description: 'Marca' },
          estado: { type: 'string', description: 'Nuevo|Bueno|Regular|Malo|Muy malo' },
          ubicacion: { type: 'string', description: 'Ubicación' },
          orden_compra: { type: 'string', description: 'Orden de compra' },
          nombre_responsable: { type: 'string', description: 'Nombre del responsable' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_bienes_por_responsable',
      description: 'Lista bienes asignados a un trabajador',
      parameters: {
        type: 'object',
        properties: {
          nombre_responsable: { type: 'string', description: 'Nombre del trabajador' },
          limit: { type: 'number', description: 'Máx resultados (def 20)' },
        },
        required: ['nombre_responsable'],
      },
    },
  },
]

type BienesFilters = {
  nombre?: string
  tipo?: string
  marca?: string
  modelo?: string
  estado?: string
  ubicacion?: string
  orden_compra?: string
  nombre_responsable?: string
  limit?: number
}

// Trunca el resultado de una tool para no inflar el historial
function truncarResultadoTool(resultado: string): string {
  try {
    const obj = JSON.parse(resultado)
    // Si es una lista de resultados, limitar a 5 y quitar campos pesados
    if (obj.resultados && Array.isArray(obj.resultados)) {
      const camposLigeros = ['codigo_patrimonial', 'nombre_mueble_equipo', 'estado', 'ubicacion', 'trabajadores']
      obj.resultados = obj.resultados.slice(0, 5).map((item: Record<string, unknown>) => {
        const slim: Record<string, unknown> = {}
        for (const k of camposLigeros) if (item[k] !== undefined) slim[k] = item[k]
        return slim
      })
      obj.truncado = obj.total > 5
    }
    return JSON.stringify(obj)
  } catch {
    return resultado
  }
}

async function ejecutarTool(
  nombre: string,
  args: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>
): Promise<string> {
  try {
    if (nombre === 'buscar_bien_por_codigo') {
      const codigo = args.codigo as string
      const { data, error } = await supabase
        .from('bienes')
        .select(`
          id, codigo_patrimonial, nombre_mueble_equipo, tipo_mueble_equipo,
          estado, ubicacion, marca, modelo, serie, orden_compra, valor,
          fecha_registro, trabajadores(nombre)
        `)
        .eq('codigo_patrimonial', codigo)
        .is('eliminado_at', null)
        .maybeSingle()

      if (error) return JSON.stringify({ error: error.message })
      if (!data) return JSON.stringify({ resultado: null, mensaje: `No se encontró bien con código ${codigo}` })
      return JSON.stringify({ resultado: data })
    }

    if (nombre === 'buscar_bienes' || nombre === 'listar_bienes_por_responsable') {
      const filters = args as BienesFilters
      const limit = Math.min(filters.limit ?? (nombre === 'listar_bienes_por_responsable' ? 20 : 10), 50)

      let query = supabase
        .from('bienes')
        .select(`
          id, codigo_patrimonial, nombre_mueble_equipo, tipo_mueble_equipo,
          estado, ubicacion, marca, modelo, orden_compra, valor,
          trabajadores(nombre)
        `)
        .is('eliminado_at', null)
        .limit(limit)

      if (filters.nombre) query = query.ilike('nombre_mueble_equipo', `%${filters.nombre}%`)
      if (filters.tipo) query = query.ilike('tipo_mueble_equipo', `%${filters.tipo}%`)
      if (filters.marca) query = query.ilike('marca', `%${filters.marca}%`)
      if (filters.modelo) query = query.ilike('modelo', `%${filters.modelo}%`)
      if (filters.estado) query = query.eq('estado', filters.estado)
      if (filters.ubicacion) query = query.ilike('ubicacion', `%${filters.ubicacion}%`)
      if (filters.orden_compra) query = query.ilike('orden_compra', `%${filters.orden_compra}%`)

      if (filters.nombre_responsable) {
        const { data: trabajadores } = await supabase
          .from('trabajadores')
          .select('id')
          .ilike('nombre', `%${filters.nombre_responsable}%`)

        const ids = (trabajadores ?? []).map((t: { id: number }) => t.id)
        if (ids.length === 0) return JSON.stringify({ resultados: [], total: 0, mensaje: `No se encontró trabajador "${filters.nombre_responsable}"` })
        query = query.in('id_trabajador', ids)
      }

      const { data, error } = await query
      if (error) return JSON.stringify({ error: error.message })
      return truncarResultadoTool(JSON.stringify({ resultados: data ?? [], total: data?.length ?? 0 }))
    }

    if (nombre === 'contar_bienes') {
      const filters = args as BienesFilters

      let query = supabase
        .from('bienes')
        .select('id', { count: 'exact', head: true })
        .is('eliminado_at', null)

      if (filters.nombre) query = query.ilike('nombre_mueble_equipo', `%${filters.nombre}%`)
      if (filters.tipo) query = query.ilike('tipo_mueble_equipo', `%${filters.tipo}%`)
      if (filters.marca) query = query.ilike('marca', `%${filters.marca}%`)
      if (filters.estado) query = query.eq('estado', filters.estado)
      if (filters.ubicacion) query = query.ilike('ubicacion', `%${filters.ubicacion}%`)
      if (filters.orden_compra) query = query.ilike('orden_compra', `%${filters.orden_compra}%`)

      if (filters.nombre_responsable) {
        const { data: trabajadores } = await supabase
          .from('trabajadores')
          .select('id')
          .ilike('nombre', `%${filters.nombre_responsable}%`)

        const ids = (trabajadores ?? []).map((t: { id: number }) => t.id)
        if (ids.length === 0) return JSON.stringify({ total: 0, mensaje: `No se encontró trabajador "${filters.nombre_responsable}"` })
        query = query.in('id_trabajador', ids)
      }

      const { count, error } = await query
      if (error) return JSON.stringify({ error: error.message })
      return JSON.stringify({ total: count ?? 0 })
    }

    return JSON.stringify({ error: `Tool desconocida: ${nombre}` })
  } catch (e) {
    return JSON.stringify({ error: String(e) })
  }
}

// Prompt del sistema compactado
const SYSTEM_PROMPT = `Eres asistente de inventario patrimonial. Solo consultas — nunca modificas datos. Responde en español, breve y directo.

REGLA: SIEMPRE llama una herramienta antes de responder.

HERRAMIENTAS:
- "¿Cuántos?" → contar_bienes
- "¿Qué bienes tiene [persona]?" → listar_bienes_por_responsable
- "Busca el bien [código]" → buscar_bien_por_codigo
- "¿Qué hay en [ubicación/estado/tipo]?" → buscar_bienes

SINÓNIMOS (buscar con nombre):
laptop/PC/computadora, impresora, proyector/cañón, escritorio, silla/sillón, televisor/monitor, teléfono/celular, vehículo/camioneta

ESTADOS (exactos): Nuevo, Bueno, Regular, Malo, Muy malo

RESPUESTA:
- Conteo: "[Persona] tiene N bienes."
- Lista: máx 5 items. "• [código] — [nombre] ([estado]) · [responsable]". Si hay más: "... y N más."
- Sin resultados: "No se encontraron bienes con esos criterios."
- Contexto: si el usuario hace seguimiento sin mencionar persona, asume la misma de antes.`

// Llama a Gemini 2.0 Flash Lite vía endpoint OpenAI-compatible de Google
async function llamarLLM(
  apiKey: string,
  messages: Message[]
): Promise<Response> {
  return fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.3,
      max_tokens: 600,
    }),
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!geminiKey || !supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Configuración incompleta del servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Sin autorización' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Sesión inválida' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  let body: { messages: Message[] }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Body inválido' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { messages } = body
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages requerido' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Historial reducido: últimos 4 mensajes (ahorro ~500 tokens)
  const historialTruncado = messages.slice(-4)

  const conversacion: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...historialTruncado,
  ]

  let respuestaFinal = ''

  try {
    for (let i = 0; i < MAX_ITERACIONES; i++) {
      const llmRes = await llamarLLM(geminiKey, conversacion)

      if (!llmRes.ok) {
        const errText = await llmRes.text()
        console.error(`[ai-chat] Gemini HTTP ${llmRes.status}:`, errText)
        return new Response(JSON.stringify({ 
          error: `Gemini API Error (${llmRes.status})`, 
          details: errText 
        }), {
          status: llmRes.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const groqData = await llmRes.json() as { choices: Array<{ message: { content: string; tool_calls?: ToolCall[] } }> }
      const msg = groqData.choices?.[0]?.message

      if (!msg) break

      conversacion.push({ role: 'assistant', content: msg.content ?? '' })

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        respuestaFinal = msg.content ?? ''
        break
      }

      for (const tc of msg.tool_calls) {
        let args: Record<string, unknown> = {}
        try { args = JSON.parse(tc.function.arguments) } catch { /* args vacío */ }

        const resultado = await ejecutarTool(tc.function.name, args, supabase)

        conversacion.push({
          role: 'tool',
          tool_call_id: tc.id,
          name: tc.function.name,
          content: resultado,
        })
      }
    }
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Error desconocido'
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ reply: respuestaFinal }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
