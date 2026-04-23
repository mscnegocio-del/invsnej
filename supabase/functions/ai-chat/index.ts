import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Usamos el endpoint nativo de Gemini (más estable)
const GEMINI_MODEL = 'gemini-2.0-flash-lite'
const MAX_ITERACIONES = 3

type Message = { role: 'user' | 'assistant' | 'system' | 'tool'; content: string; tool_call_id?: string; name?: string }

// Herramientas en formato Gemini
const tools = [
  {
    function_declarations: [
      {
        name: 'buscar_bien_por_codigo',
        description: 'Busca un bien por código patrimonial exacto',
        parameters: {
          type: 'OBJECT',
          properties: {
            codigo: { type: 'STRING', description: 'Código patrimonial' },
          },
          required: ['codigo'],
        },
      },
      {
        name: 'buscar_bienes',
        description: 'Busca bienes con filtros opcionales',
        parameters: {
          type: 'OBJECT',
          properties: {
            nombre: { type: 'STRING', description: 'Nombre parcial del bien' },
            tipo: { type: 'STRING', description: 'Tipo de bien' },
            marca: { type: 'STRING', description: 'Marca' },
            modelo: { type: 'STRING', description: 'Modelo' },
            estado: { type: 'STRING', description: 'Nuevo|Bueno|Regular|Malo|Muy malo' },
            ubicacion: { type: 'STRING', description: 'Ubicación parcial' },
            orden_compra: { type: 'STRING', description: 'Orden de compra' },
            nombre_responsable: { type: 'STRING', description: 'Nombre del responsable' },
            limit: { type: 'NUMBER', description: 'Máx resultados (def 10, max 50)' },
          },
          required: [],
        },
      },
      {
        name: 'contar_bienes',
        description: 'Cuenta bienes con filtros. Usar para "¿cuántos?"',
        parameters: {
          type: 'OBJECT',
          properties: {
            nombre: { type: 'STRING', description: 'Nombre parcial' },
            tipo: { type: 'STRING', description: 'Tipo' },
            marca: { type: 'STRING', description: 'Marca' },
            estado: { type: 'STRING', description: 'Nuevo|Bueno|Regular|Malo|Muy malo' },
            ubicacion: { type: 'STRING', description: 'Ubicación' },
            orden_compra: { type: 'STRING', description: 'Orden de compra' },
            nombre_responsable: { type: 'STRING', description: 'Nombre del responsable' },
          },
          required: [],
        },
      },
      {
        name: 'listar_bienes_por_responsable',
        description: 'Lista bienes asignados a un trabajador',
        parameters: {
          type: 'OBJECT',
          properties: {
            nombre_responsable: { type: 'STRING', description: 'Nombre del trabajador' },
            limit: { type: 'NUMBER', description: 'Máx resultados (def 20)' },
          },
          required: ['nombre_responsable'],
        },
      },
    ]
  }
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

function truncarResultadoTool(resultado: string): string {
  try {
    const obj = JSON.parse(resultado)
    if (obj.resultados && Array.isArray(obj.resultados)) {
      const camposLigeros = ['codigo_patrimonial', 'nombre_mueble_equipo', 'estado', 'ubicacion', 'trabajadores']
      obj.resultados = obj.resultados.slice(0, 5).map((item: any) => {
        const slim: any = {}
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
  supabase: any
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

        const ids = (trabajadores ?? []).map((t: any) => t.id)
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
        const ids = (trabajadores ?? []).map((t: any) => t.id)
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

const SYSTEM_PROMPT = `Eres asistente de inventario patrimonial. Solo consultas. Responde en español, breve y directo.
REGLA: SIEMPRE llama una herramienta antes de responder.
SINÓNIMOS: laptop/PC, impresora, proyector, escritorio, silla, televisor, teléfono, vehículo.`

async function llamarGemini(apiKey: string, contents: any[]) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      tools,
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: { temperature: 0.3, maxOutputTokens: 600 }
    })
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!geminiKey || !supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Configuración incompleta' }), { status: 500, headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'Sin autorización' }), { status: 401, headers: corsHeaders })

  const supabase = createClient(supabaseUrl, serviceKey)

  const { messages } = await req.json()
  if (!Array.isArray(messages)) return new Response(JSON.stringify({ error: 'messages req' }), { status: 400, headers: corsHeaders })

  // Convertimos historial de OpenAI a Gemini
  const contents = messages.slice(-4).map((m: any) => {
    if (m.role === 'user') return { role: 'user', parts: [{ text: m.content }] }
    if (m.role === 'assistant') {
      const parts: any[] = []
      if (m.content) parts.push({ text: m.content })
      if (m.tool_calls) {
        parts.push(...m.tool_calls.map((tc: any) => ({
          function_call: { name: tc.function.name, args: JSON.parse(tc.function.arguments) }
        })))
      }
      return { role: 'model', parts }
    }
    if (m.role === 'tool') {
      return { role: 'function', parts: [{ function_response: { name: m.name, response: { content: m.content } } }] }
    }
    return { role: 'user', parts: [{ text: m.content }] }
  })

  try {
    let currentContents = [...contents]
    let finalReply = ''

    for (let i = 0; i < MAX_ITERACIONES; i++) {
      const res = await llamarGemini(geminiKey, currentContents)
      const data = await res.json()
      
      if (!res.ok) throw new Error(`Gemini Error: ${JSON.stringify(data)}`)

      const candidate = data.candidates?.[0]
      const parts = candidate?.content?.parts || []
      
      currentContents.push(candidate.content)

      const toolCalls = parts.filter((p: any) => p.function_call)
      const textPart = parts.find((p: any) => p.text)

      if (toolCalls.length > 0) {
        for (const tc of toolCalls) {
          const result = await ejecutarTool(tc.function_call.name, tc.function_call.args, supabase)
          currentContents.push({
            role: 'function',
            parts: [{ function_response: { name: tc.function_call.name, response: { content: result } } }]
          })
        }
      } else {
        finalReply = textPart?.text || ''
        break
      }
    }

    return new Response(JSON.stringify({ reply: finalReply }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 502, headers: corsHeaders })
  }
})
