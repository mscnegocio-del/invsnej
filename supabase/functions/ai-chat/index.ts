import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_MODEL = 'gemini-2.5-flash-lite'
const MAX_ITERACIONES = 2

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

const SYSTEM_PROMPT = `Eres asistente de inventario patrimonial. Solo consultas. Responde en español, breve y directo.
REGLA: SIEMPRE llama una herramienta antes de responder.
SINÓNIMOS: laptop/PC, impresora, proyector, escritorio, silla, televisor, teléfono, vehículo.`

async function callGeminiWithRetry(body: any, geminiKey: string) {
  const maxRetries = 3
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }
      )

      const data = await res.json()

      // Si hay error 429, reintentar con backoff
      if (!res.ok && data.error?.code === 429) {
        const waitMs = Math.pow(2, attempt) * 1000
        lastError = new Error(`Rate limited (429). Retry attempt ${attempt + 1}/${maxRetries}`)
        console.log(`429 received. Waiting ${waitMs}ms before retry...`)
        await new Promise(r => setTimeout(r, waitMs))
        continue
      }

      if (!res.ok) {
        throw new Error(`Gemini error: ${data.error?.code || 'unknown'} - ${data.error?.message || 'unknown'}`)
      }

      return data
    } catch (e: any) {
      lastError = e
      if (attempt < maxRetries - 1 && !e.message.includes('429')) throw e
    }
  }

  throw lastError || new Error('Gemini API: Max retries exceeded')
}

async function ejecutarTool(nombre: string, args: any, supabase: any): Promise<string> {
  try {
    if (nombre === 'buscar_bien_por_codigo') {
      const { data, error } = await supabase.from('bienes').select('*, trabajadores(nombre)').eq('codigo_patrimonial', args.codigo).is('eliminado_at', null).maybeSingle()
      if (error) return JSON.stringify({ error: error.message })
      return JSON.stringify({ resultado: data || null })
    }
    if (nombre === 'buscar_bienes' || nombre === 'listar_bienes_por_responsable') {
      const limit = Math.min(args.limit ?? 10, 50)
      let query = supabase.from('bienes').select('id, codigo_patrimonial, nombre_mueble_equipo, estado, ubicacion, trabajadores(nombre)').is('eliminado_at', null).limit(limit)
      if (args.nombre) query = query.ilike('nombre_mueble_equipo', `%${args.nombre}%`)
      if (args.tipo) query = query.ilike('tipo_mueble_equipo', `%${args.tipo}%`)
      if (args.estado) query = query.eq('estado', args.estado)
      if (args.nombre_responsable) {
        const { data: trab } = await supabase.from('trabajadores').select('id').ilike('nombre', `%${args.nombre_responsable}%`)
        const ids = (trab || []).map((t: any) => t.id)
        if (ids.length === 0) return JSON.stringify({ resultados: [], total: 0 })
        query = query.in('id_trabajador', ids)
      }
      const { data, error } = await query
      if (error) return JSON.stringify({ error: error.message })
      return JSON.stringify({ resultados: data?.slice(0, 5) || [], total: data?.length || 0 })
    }
    if (nombre === 'contar_bienes') {
      let query = supabase.from('bienes').select('id', { count: 'exact', head: true }).is('eliminado_at', null)
      if (args.nombre_responsable) {
        const { data: trab } = await supabase.from('trabajadores').select('id').ilike('nombre', `%${args.nombre_responsable}%`)
        const ids = (trab || []).map((t: any) => t.id)
        query = query.in('id_trabajador', ids)
      }
      const { count, error } = await query
      return JSON.stringify({ total: count || 0, error: error?.message })
    }
    return JSON.stringify({ error: 'Tool no encontrada' })
  } catch (e: any) {
    return JSON.stringify({ error: e.message })
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!geminiKey) throw new Error('Falta GEMINI_API_KEY')

    const { messages } = await req.json()
    const supabase = createClient(supabaseUrl!, serviceKey!)

    // Mapeo estricto a formato Gemini (alternando user/model)
    const contents: any[] = []
    messages.slice(-6).forEach((m: any) => {
      if (m.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: m.content || '...' }] })
      } else if (m.role === 'assistant' || m.role === 'model') {
        const parts: any[] = []
        if (m.content) parts.push({ text: m.content })
        if (m.tool_calls) {
          parts.push(...m.tool_calls.map((tc: any) => ({
            function_call: { name: tc.function.name, args: JSON.parse(tc.function.arguments) }
          })))
        }
        contents.push({ role: 'model', parts })
      } else if (m.role === 'tool' || m.role === 'function') {
        contents.push({ role: 'function', parts: [{ function_response: { name: m.name, response: { content: m.content } } }] })
      }
    })

    let finalReply = ''
    let currentContents = [...contents]

    for (let i = 0; i < MAX_ITERACIONES; i++) {
      const data = await callGeminiWithRetry(
        {
          contents: currentContents,
          tools,
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          generationConfig: { temperature: 0.1, maxOutputTokens: 300 }
        },
        geminiKey
      )

      const candidate = data.candidates?.[0]
      const parts = candidate?.content?.parts || []
      currentContents.push(candidate.content)

      const toolCalls = parts.filter((p: any) => p.function_call)
      if (toolCalls.length > 0) {
        for (const tc of toolCalls) {
          const result = await ejecutarTool(tc.function_call.name, tc.function_call.args, supabase)
          currentContents.push({
            role: 'function',
            parts: [{ function_response: { name: tc.function_call.name, response: { content: result } } }]
          })
        }
      } else {
        finalReply = parts.find((p: any) => p.text)?.text || ''
        break
      }
    }

    return new Response(JSON.stringify({ reply: finalReply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (e: any) {
    console.error('Fatal Error:', e.message)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 200, // Devolvemos 200 con el error en el body para que el front no muera
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
