import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_MODEL = 'gemini-2.5-flash'
const MAX_ITERACIONES = 5

const tools = [
  {
    functionDeclarations: [
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
        description: 'Cuenta bienes con filtros. Usar para preguntas de cuántos.',
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

const SYSTEM_PROMPT = `Eres asistente de inventario patrimonial. Solo consultas, no puedes editar ni crear bienes. Responde en español, breve y directo.
Para saludos o preguntas generales responde DIRECTAMENTE sin usar herramientas.
Usa herramientas SOLO cuando el usuario pregunta sobre bienes, inventario, responsables o ubicaciones específicas.
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
      const { data, error } = await supabase
        .from('bienes')
        .select('*, trabajadores(nombre)')
        .eq('codigo_patrimonial', args.codigo)
        .is('eliminado_at', null)
        .maybeSingle()
      if (error) return JSON.stringify({ error: error.message })
      return JSON.stringify({ resultado: data || null })
    }
    if (nombre === 'buscar_bienes' || nombre === 'listar_bienes_por_responsable') {
      const limit = Math.min(args.limit ?? 10, 50)
      let query = supabase
        .from('bienes')
        .select('id, codigo_patrimonial, nombre_mueble_equipo, estado, ubicacion, trabajadores(nombre)')
        .is('eliminado_at', null)
        .limit(limit)
      if (args.nombre) query = query.ilike('nombre_mueble_equipo', `%${args.nombre}%`)
      if (args.tipo) query = query.ilike('tipo_mueble_equipo', `%${args.tipo}%`)
      if (args.estado) query = query.eq('estado', args.estado)
      if (args.ubicacion) query = query.ilike('ubicacion', `%${args.ubicacion}%`)
      if (args.nombre_responsable) {
        const { data: trab } = await supabase.from('trabajadores').select('id').ilike('nombre', `%${args.nombre_responsable}%`)
        const ids = (trab || []).map((t: any) => t.id)
        if (ids.length === 0) return JSON.stringify({ resultados: [], total: 0 })
        query = query.in('id_trabajador', ids)
      }
      const { data, error } = await query
      if (error) return JSON.stringify({ error: error.message })
      return JSON.stringify({ resultados: data?.slice(0, 10) || [], total: data?.length || 0 })
    }
    if (nombre === 'contar_bienes') {
      let query = supabase.from('bienes').select('id', { count: 'exact', head: true }).is('eliminado_at', null)
      if (args.nombre) query = query.ilike('nombre_mueble_equipo', `%${args.nombre}%`)
      if (args.tipo) query = query.ilike('tipo_mueble_equipo', `%${args.tipo}%`)
      if (args.estado) query = query.eq('estado', args.estado)
      if (args.ubicacion) query = query.ilike('ubicacion', `%${args.ubicacion}%`)
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

    // Mapeo a formato Gemini (camelCase)
    const contents: any[] = []
    messages.slice(-6).forEach((m: any) => {
      if (m.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: m.content || '...' }] })
      } else if (m.role === 'assistant' || m.role === 'model') {
        const parts: any[] = []
        if (m.content) parts.push({ text: m.content })
        contents.push({ role: 'model', parts })
      }
    })

    let finalReply = ''
    let currentContents = [...contents]

    for (let i = 0; i < MAX_ITERACIONES; i++) {
      const data = await callGeminiWithRetry(
        {
          contents: currentContents,
          tools,
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          generationConfig: { temperature: 0.1, maxOutputTokens: 500, thinkingConfig: { thinkingBudget: 0 } }
        },
        geminiKey
      )

      const candidate = data.candidates?.[0]
      if (!candidate) break

      const content = candidate.content
      const parts: any[] = content?.parts || []
      console.log(`Iter ${i}: finishReason=${candidate.finishReason}, parts=${JSON.stringify(parts.map((p: any) => Object.keys(p)))}`)

      if (content) currentContents.push(content)

      // Gemini 2.5 usa camelCase: functionCall / functionResponse
      // Filtrar thought parts (pensamiento interno del modelo)
      const toolCalls = parts.filter((p: any) => p.functionCall && !p.thought)
      // Solo partes de texto real, no pensamiento interno
      const textPart = parts.find((p: any) => p.text && !p.thought)

      if (toolCalls.length > 0) {
        const toolResults: any[] = []
        for (const tc of toolCalls) {
          const result = await ejecutarTool(tc.functionCall.name, tc.functionCall.args, supabase)
          console.log(`Tool ${tc.functionCall.name}: ${result.substring(0, 100)}`)
          toolResults.push({
            functionResponse: {
              name: tc.functionCall.name,
              response: { content: result }
            }
          })
        }
        // Las respuestas de herramientas se envían con role 'user' en Gemini
        currentContents.push({ role: 'user', parts: toolResults })
      } else {
        finalReply = textPart?.text || ''
        console.log(`Final reply (${finalReply.length} chars): ${finalReply.substring(0, 80)}`)
        break
      }
    }

    // Fallback si el loop agotó iteraciones sin texto (forzar respuesta sin tools)
    if (!finalReply) {
      console.log('Loop agotado sin texto. Intentando respuesta sin herramientas...')
      const fallback = await callGeminiWithRetry(
        {
          contents: currentContents,
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          generationConfig: { temperature: 0.1, maxOutputTokens: 300, thinkingConfig: { thinkingBudget: 0 } }
        },
        geminiKey
      )
      const fbParts: any[] = fallback.candidates?.[0]?.content?.parts || []
      finalReply = fbParts.find((p: any) => p.text && !p.thought)?.text || 'No pude obtener una respuesta. Intenta de nuevo.'
    }

    return new Response(JSON.stringify({ reply: finalReply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (e: any) {
    console.error('Fatal Error:', e.message)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
