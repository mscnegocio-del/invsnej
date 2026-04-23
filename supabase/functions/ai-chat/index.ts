import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.1-8b-instant'
const MAX_ITERACIONES = 3

type Message = { role: 'user' | 'assistant' | 'system' | 'tool'; content: string; tool_call_id?: string; name?: string }

type ToolCall = {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

const tools = [
  {
    type: 'function',
    function: {
      name: 'buscar_bien_por_codigo',
      description: 'Busca un bien por su código patrimonial exacto',
      parameters: {
        type: 'object',
        properties: {
          codigo: { type: 'string', description: 'Código patrimonial del bien' },
        },
        required: ['codigo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_bienes',
      description: 'Busca bienes con filtros opcionales. Devuelve lista de bienes.',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Parte del nombre del mueble/equipo' },
          tipo: { type: 'string', description: 'Tipo de mueble/equipo' },
          marca: { type: 'string', description: 'Marca del bien' },
          modelo: { type: 'string', description: 'Modelo del bien' },
          estado: { type: 'string', description: 'Estado: Nuevo, Bueno, Regular, Malo, Muy malo' },
          ubicacion: { type: 'string', description: 'Ubicación (texto parcial)' },
          orden_compra: { type: 'string', description: 'Número de orden de compra' },
          nombre_responsable: { type: 'string', description: 'Nombre del trabajador responsable (busca por nombre)' },
          limit: { type: 'number', description: 'Máximo de resultados a devolver (default 10, max 50)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'contar_bienes',
      description: 'Cuenta bienes con filtros opcionales. Devuelve el total numérico. Usar para preguntas como "¿cuántos bienes tiene X?", "¿cuántas laptops hay?", "¿cuántos bienes de estado Bueno tiene Romario?".',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Parte del nombre del mueble/equipo' },
          tipo: { type: 'string', description: 'Tipo de mueble/equipo' },
          marca: { type: 'string', description: 'Marca del bien' },
          estado: { type: 'string', description: 'Estado: Nuevo, Bueno, Regular, Malo, Muy malo' },
          ubicacion: { type: 'string', description: 'Ubicación (texto parcial)' },
          orden_compra: { type: 'string', description: 'Número de orden de compra' },
          nombre_responsable: { type: 'string', description: 'Nombre o parte del nombre del trabajador responsable. Usar para contar bienes de una persona específica.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_bienes_por_responsable',
      description: 'Lista todos los bienes asignados a un trabajador por su nombre',
      parameters: {
        type: 'object',
        properties: {
          nombre_responsable: { type: 'string', description: 'Nombre o parte del nombre del trabajador' },
          limit: { type: 'number', description: 'Máximo de resultados (default 20)' },
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
      if (!data) return JSON.stringify({ resultado: null, mensaje: `No se encontró ningún bien con código ${codigo}` })
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
        if (ids.length === 0) return JSON.stringify({ resultados: [], total: 0, mensaje: `No se encontró trabajador con nombre "${filters.nombre_responsable}"` })
        query = query.in('id_trabajador', ids)
      }

      const { data, error } = await query
      if (error) return JSON.stringify({ error: error.message })
      return JSON.stringify({ resultados: data ?? [], total: data?.length ?? 0 })
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
        if (ids.length === 0) return JSON.stringify({ total: 0, mensaje: `No se encontró trabajador con nombre "${filters.nombre_responsable}"` })
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

const SYSTEM_PROMPT = `Eres un asistente especializado en consultas del sistema de inventario patrimonial.
Solo puedes responder preguntas sobre los bienes registrados en la base de datos.
Tienes acceso a herramientas para consultar bienes, contar registros y buscar por diferentes criterios.

Reglas:
- Si el usuario pregunta algo que no está relacionado con el inventario de bienes, declina amablemente.
- Nunca edites, crees ni elimines datos. Solo consultas de lectura.
- Responde siempre en español de forma clara y concisa.
- Si no encuentras resultados, dilo claramente.
- Cuando listes bienes, muestra información relevante: código, nombre, ubicación, estado, responsable.
- El campo "nombre_mueble_equipo" es el nombre del bien. "tipo_mueble_equipo" es el tipo o categoría.
- Los bienes eliminados tienen "eliminado_at" con fecha, no los incluyas en resultados.

Uso de herramientas — IMPORTANTE:
- Para contar bienes de una persona: llama contar_bienes con nombre_responsable. Ejemplo: "¿cuántos bienes tiene Romario?" → contar_bienes({ nombre_responsable: "Romario" })
- Para contar bienes con múltiples filtros: contar_bienes({ nombre_responsable: "X", estado: "Bueno" })
- Para listar bienes de una persona: listar_bienes_por_responsable({ nombre_responsable: "X" })
- SIEMPRE llama la herramienta directamente. Nunca digas que no puedes usar una herramienta — todas están disponibles.

Contexto y responsables:
- Mantén siempre el contexto de la conversación. Si el usuario preguntó antes por un responsable específico (ej: "Milton"), y luego hace una pregunta de seguimiento sin mencionar a nadie (ej: "¿cuántas son computadoras?"), asume que se refiere al mismo responsable de la pregunta anterior.
- Si hay ambigüedad real (el usuario podría referirse a la persona anterior o al inventario general), pregunta: "¿Te refieres a [nombre] o al inventario completo?"
- Nunca mezcles resultados de diferentes responsables.
- Cuando el usuario proporcione un nombre completo para corregir una búsqueda anterior, usa ese nombre exacto en la herramienta.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const groqKey = Deno.env.get('GROQ_API_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!groqKey || !supabaseUrl || !serviceKey) {
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

  // Limitar historial a los últimos 8 mensajes para reducir tokens
  const historialTruncado = messages.slice(-8)

  const conversacion: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...historialTruncado,
  ]

  let respuestaFinal = ''

  try {
    for (let i = 0; i < MAX_ITERACIONES; i++) {
      const groqRes = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: conversacion,
          tools,
          tool_choice: 'auto',
          temperature: 0.3,
          max_tokens: 800,
        }),
      })

      if (!groqRes.ok) {
        const err = await groqRes.text()
        throw new Error(`Error Groq: ${err}`)
      }

      const groqData = await groqRes.json() as { choices: Array<{ message: { content: string; tool_calls?: ToolCall[] } }> }
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
