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
        name: 'proponer_edicion_bien',
        description:
          'Propone editar un bien (estado, ubicación y/o responsable). NO edita: muestra una tarjeta de confirmación al usuario, quien decide en pantalla. Usar cuando el usuario pida cambiar/actualizar/editar/reasignar un bien.',
        parameters: {
          type: 'OBJECT',
          properties: {
            codigo: { type: 'STRING', description: 'Código patrimonial del bien a editar' },
            estado: { type: 'STRING', description: 'Nuevo estado: Nuevo|Bueno|Regular|Malo|Muy malo' },
            ubicacion: { type: 'STRING', description: 'Nueva ubicación (texto)' },
            nombre_responsable: { type: 'STRING', description: 'Nombre del nuevo responsable' },
          },
          required: ['codigo'],
        },
      },
      {
        name: 'proponer_registro_bien',
        description:
          'Propone registrar un bien NUEVO en el inventario. NO lo crea: muestra una tarjeta con los datos propuestos y un botón que abre el formulario de registro prellenado, donde el usuario completa y guarda. Usar cuando el usuario pida registrar/agregar/dar de alta un bien nuevo.',
        parameters: {
          type: 'OBJECT',
          properties: {
            nombre: { type: 'STRING', description: 'Nombre o descripción del bien (ej. "Silla giratoria")' },
            codigo: { type: 'STRING', description: 'Código patrimonial, si el usuario lo indica' },
            tipo: { type: 'STRING', description: 'Tipo de bien' },
            estado: { type: 'STRING', description: 'Nuevo|Bueno|Regular|Malo|Muy malo' },
            ubicacion: { type: 'STRING', description: 'Ubicación (nombre parcial)' },
            nombre_responsable: { type: 'STRING', description: 'Nombre del responsable' },
            marca: { type: 'STRING', description: 'Marca' },
            modelo: { type: 'STRING', description: 'Modelo' },
            serie: { type: 'STRING', description: 'Número de serie' },
            orden_compra: { type: 'STRING', description: 'Orden de compra' },
            valor: { type: 'NUMBER', description: 'Valor en soles' },
          },
          required: ['nombre'],
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

const SYSTEM_PROMPT = `Eres asistente de inventario patrimonial. Respondes en español, breve y directo.
Para saludos o preguntas generales responde DIRECTAMENTE sin usar herramientas.
Usa herramientas SOLO cuando el usuario pregunta sobre bienes, inventario, responsables o ubicaciones específicas.
EDICIONES: si el usuario pide cambiar estado, ubicación o responsable de un bien, usa proponer_edicion_bien. Tú NUNCA editas directamente: la herramienta muestra una tarjeta de confirmación y el usuario decide en pantalla. Tras proponer, di que revise y confirme en la tarjeta; NUNCA afirmes que el cambio ya se aplicó.
REGISTROS: si el usuario pide registrar/agregar/dar de alta un bien NUEVO, usa proponer_registro_bien con los datos que mencione (basta el nombre). Si el usuario da el código patrimonial, la herramienta consulta SIGA automáticamente y esos datos (marca, modelo, serie, OC, valor) mandan sobre lo que el usuario haya dicho; si la respuesta indica datos_desde_siga, menciónalo brevemente. Tú NUNCA creas el bien: la tarjeta abre el formulario de registro prellenado y el usuario completa (código, responsable) y guarda ahí. Tras proponer, di que abra el formulario desde la tarjeta; NUNCA afirmes que ya se registró. No puedes eliminar bienes.
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

// Tarjeta estructurada que el frontend renderiza como UI (ficha, lista o conteo)
type AgentCard =
  | { tipo: 'bien'; payload: any }
  | { tipo: 'lista'; payload: { resultados: any[]; total: number } }
  | { tipo: 'conteo'; payload: { total: number; filtros: Record<string, unknown> } }
  | { tipo: 'confirmacion'; payload: { bien: any; cambios: any[] } }
  | { tipo: 'registro'; payload: RegistroPropuesto }

type RegistroPropuesto = {
  nombre: string
  codigo?: string
  tipo?: string
  estado?: string
  marca?: string
  modelo?: string
  serie?: string
  orden_compra?: string
  valor?: number
  id_trabajador?: number
  nombre_responsable?: string
  id_ubicacion?: number
  ubicacion_nombre?: string
  desde_siga?: boolean
}

const ESTADOS_VALIDOS = ['Nuevo', 'Bueno', 'Regular', 'Malo', 'Muy malo']

async function ejecutarTool(
  nombre: string,
  args: any,
  supabase: any
): Promise<{ paraModelo: string; card?: AgentCard }> {
  try {
    if (nombre === 'buscar_bien_por_codigo') {
      const { data, error } = await supabase
        .from('bienes')
        .select('*, trabajadores(nombre)')
        .eq('codigo_patrimonial', args.codigo)
        .is('eliminado_at', null)
        .maybeSingle()
      if (error) return { paraModelo: JSON.stringify({ error: error.message }) }
      return {
        paraModelo: JSON.stringify({ resultado: data || null }),
        card: data ? { tipo: 'bien', payload: data } : undefined,
      }
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
        const tokens = String(args.nombre_responsable).trim().split(/\s+/).filter((t: string) => t.length > 1)
        let trabQ = supabase.from('trabajadores').select('id, nombre')
        for (const tk of tokens) trabQ = trabQ.ilike('nombre', `%${tk}%`)
        const { data: trab } = await trabQ
        const ids = (trab || []).map((t: any) => t.id)
        if (ids.length === 0) return { paraModelo: JSON.stringify({ resultados: [], total: 0 }) }
        query = query.in('id_trabajador', ids)
      }
      const { data, error } = await query
      if (error) return { paraModelo: JSON.stringify({ error: error.message }) }
      const resultados = data?.slice(0, 10) || []
      return {
        paraModelo: JSON.stringify({ resultados, total: data?.length || 0 }),
        card: resultados.length > 0
          ? { tipo: 'lista', payload: { resultados, total: data?.length || 0 } }
          : undefined,
      }
    }
    if (nombre === 'contar_bienes') {
      let query = supabase.from('bienes').select('id', { count: 'exact', head: true }).is('eliminado_at', null)
      if (args.nombre) query = query.ilike('nombre_mueble_equipo', `%${args.nombre}%`)
      if (args.tipo) query = query.ilike('tipo_mueble_equipo', `%${args.tipo}%`)
      if (args.estado) query = query.eq('estado', args.estado)
      if (args.ubicacion) query = query.ilike('ubicacion', `%${args.ubicacion}%`)
      if (args.nombre_responsable) {
        const tokens = String(args.nombre_responsable).trim().split(/\s+/).filter((t: string) => t.length > 1)
        let trabQ = supabase.from('trabajadores').select('id')
        for (const tk of tokens) trabQ = trabQ.ilike('nombre', `%${tk}%`)
        const { data: trab } = await trabQ
        const ids = (trab || []).map((t: any) => t.id)
        if (ids.length === 0) {
          return {
            paraModelo: JSON.stringify({ total: 0 }),
            card: { tipo: 'conteo', payload: { total: 0, filtros: args } },
          }
        }
        query = query.in('id_trabajador', ids)
      }
      const { count, error } = await query
      return {
        paraModelo: JSON.stringify({ total: count || 0, error: error?.message }),
        card: error ? undefined : { tipo: 'conteo', payload: { total: count || 0, filtros: args } },
      }
    }
    if (nombre === 'proponer_edicion_bien') {
      const { data: bien, error } = await supabase
        .from('bienes')
        .select('id, codigo_patrimonial, nombre_mueble_equipo, estado, ubicacion, id_trabajador, trabajadores(nombre)')
        .eq('codigo_patrimonial', args.codigo)
        .is('eliminado_at', null)
        .maybeSingle()
      if (error) return { paraModelo: JSON.stringify({ error: error.message }) }
      if (!bien) return { paraModelo: JSON.stringify({ error: `No existe bien con código ${args.codigo}` }) }

      const cambios: any[] = []

      if (args.estado) {
        const estadoNorm = ESTADOS_VALIDOS.find(
          (e) => e.toLowerCase() === String(args.estado).trim().toLowerCase()
        )
        if (!estadoNorm) {
          return { paraModelo: JSON.stringify({ error: `Estado inválido. Válidos: ${ESTADOS_VALIDOS.join(', ')}` }) }
        }
        if (estadoNorm !== bien.estado) {
          cambios.push({
            campo: 'estado',
            valor_antes: bien.estado,
            valor_despues: estadoNorm,
            update: { estado: estadoNorm },
          })
        }
      }

      if (args.ubicacion) {
        const nuevaUbicacion = String(args.ubicacion).trim()
        if (nuevaUbicacion && nuevaUbicacion !== bien.ubicacion) {
          cambios.push({
            campo: 'ubicacion',
            valor_antes: bien.ubicacion || null,
            valor_despues: nuevaUbicacion,
            update: { ubicacion: nuevaUbicacion },
          })
        }
      }

      if (args.nombre_responsable) {
        const tokens = String(args.nombre_responsable).trim().split(/\s+/).filter((t: string) => t.length > 1)
        let trabQ = supabase.from('trabajadores').select('id, nombre')
        for (const tk of tokens) trabQ = trabQ.ilike('nombre', `%${tk}%`)
        const { data: trab } = await trabQ
        if (!trab || trab.length === 0) {
          return { paraModelo: JSON.stringify({ error: `No se encontró trabajador que coincida con "${args.nombre_responsable}"` }) }
        }
        if (trab.length > 1) {
          return {
            paraModelo: JSON.stringify({
              error: 'Coinciden varios trabajadores; pide al usuario precisar el nombre',
              coincidencias: trab.slice(0, 5).map((t: any) => t.nombre),
            }),
          }
        }
        if (trab[0].id !== bien.id_trabajador) {
          cambios.push({
            campo: 'responsable',
            valor_antes: (bien as any).trabajadores?.nombre || null,
            valor_despues: trab[0].nombre,
            update: { id_trabajador: trab[0].id },
          })
        }
      }

      if (cambios.length === 0) {
        return { paraModelo: JSON.stringify({ mensaje: 'No hay cambios: los valores propuestos son iguales a los actuales (o no se indicó qué cambiar)' }) }
      }

      return {
        paraModelo: JSON.stringify({
          propuesta_mostrada: true,
          bien: bien.codigo_patrimonial,
          cambios: cambios.map((c) => ({ campo: c.campo, de: c.valor_antes, a: c.valor_despues })),
          nota: 'El usuario debe confirmar en la tarjeta en pantalla. No afirmes que ya se aplicó.',
        }),
        card: { tipo: 'confirmacion', payload: { bien, cambios } },
      }
    }
    if (nombre === 'proponer_registro_bien') {
      const propuesta: RegistroPropuesto = { nombre: String(args.nombre).trim() }
      if (!propuesta.nombre) return { paraModelo: JSON.stringify({ error: 'Falta el nombre del bien' }) }

      let siga: { descripcion?: string; marca?: string; modelo?: string; serie?: string; orden_compra?: string; valor?: number } | null = null

      // Código: si viene, verificar que no exista ya (duplicado) y, como en el
      // registro manual (ver Scan.tsx), consultar SIGA — es la fuente autorizada
      // de marca/modelo/serie/OC/valor/descripción para ese código específico.
      if (args.codigo) {
        const codigo = String(args.codigo).trim()
        const { data: existente } = await supabase
          .from('bienes')
          .select('id, codigo_patrimonial, nombre_mueble_equipo')
          .eq('codigo_patrimonial', codigo)
          .is('eliminado_at', null)
          .maybeSingle()
        if (existente) {
          return {
            paraModelo: JSON.stringify({
              error: `Ya existe un bien con código ${codigo}: ${existente.nombre_mueble_equipo}. Sugiere al usuario editarlo en vez de registrarlo de nuevo.`,
            }),
            card: { tipo: 'bien', payload: existente },
          }
        }
        propuesta.codigo = codigo

        const { data: sigaData } = await supabase
          .from('siga_bienes')
          .select('descripcion, marca, modelo, serie, orden_compra, valor')
          .eq('codigo_patrimonial', codigo)
          .maybeSingle()
        if (sigaData) {
          siga = sigaData
          propuesta.desde_siga = true
        }
      }

      if (args.estado) {
        const estadoNorm = ESTADOS_VALIDOS.find(
          (e) => e.toLowerCase() === String(args.estado).trim().toLowerCase()
        )
        if (estadoNorm) propuesta.estado = estadoNorm
      }

      if (args.nombre_responsable) {
        const tokens = String(args.nombre_responsable).trim().split(/\s+/).filter((t: string) => t.length > 1)
        let trabQ = supabase.from('trabajadores').select('id, nombre')
        for (const tk of tokens) trabQ = trabQ.ilike('nombre', `%${tk}%`)
        const { data: trab } = await trabQ
        if (trab && trab.length === 1) {
          propuesta.id_trabajador = trab[0].id
          propuesta.nombre_responsable = trab[0].nombre
        } else if (trab && trab.length > 1) {
          return {
            paraModelo: JSON.stringify({
              error: 'Coinciden varios trabajadores; pide al usuario precisar el nombre del responsable',
              coincidencias: trab.slice(0, 5).map((t: any) => t.nombre),
            }),
          }
        }
        // 0 coincidencias: se omite; el usuario lo elegirá en el formulario
      }

      if (args.ubicacion) {
        const { data: ubis } = await supabase
          .from('ubicaciones')
          .select('id, nombre')
          .ilike('nombre', `%${String(args.ubicacion).trim()}%`)
          .limit(5)
        if (ubis && ubis.length === 1) {
          propuesta.id_ubicacion = ubis[0].id
          propuesta.ubicacion_nombre = ubis[0].nombre
        }
        // 0 o varias: se omite; el usuario la elegirá en el formulario
      }

      if (args.tipo) propuesta.tipo = String(args.tipo).trim()

      // Datos técnicos: si el código coincidió en SIGA, esos datos mandan
      // (son los del catálogo oficial); si no, se usa lo que dijo el usuario.
      if (siga?.descripcion) propuesta.nombre = siga.descripcion
      propuesta.marca = siga?.marca || (args.marca ? String(args.marca).trim() : undefined)
      propuesta.modelo = siga?.modelo || (args.modelo ? String(args.modelo).trim() : undefined)
      propuesta.serie = siga?.serie || (args.serie ? String(args.serie).trim() : undefined)
      propuesta.orden_compra = siga?.orden_compra || (args.orden_compra ? String(args.orden_compra).trim() : undefined)
      propuesta.valor = siga?.valor ?? (typeof args.valor === 'number' && args.valor >= 0 ? args.valor : undefined)

      return {
        paraModelo: JSON.stringify({
          propuesta_mostrada: true,
          datos: propuesta,
          datos_desde_siga: !!siga,
          nota: siga
            ? 'El código coincidió con un registro en SIGA: los datos técnicos (marca, modelo, serie, OC, valor y/o nombre) se completaron desde ahí. Menciónalo brevemente. El usuario debe abrir el formulario desde la tarjeta, revisar, completar lo que falte (responsable) y guardar. No afirmes que ya se registró.'
            : 'El usuario debe abrir el formulario desde la tarjeta, completar lo que falte (código, responsable) y guardar. No afirmes que ya se registró.',
        }),
        card: { tipo: 'registro', payload: propuesta },
      }
    }
    return { paraModelo: JSON.stringify({ error: 'Tool no encontrada' }) }
  } catch (e: any) {
    return { paraModelo: JSON.stringify({ error: e.message }) }
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
    const cards: AgentCard[] = []

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
          const { paraModelo, card } = await ejecutarTool(tc.functionCall.name, tc.functionCall.args, supabase)
          console.log(`Tool ${tc.functionCall.name}: ${paraModelo.substring(0, 100)}`)
          if (card) cards.push(card)
          toolResults.push({
            functionResponse: {
              name: tc.functionCall.name,
              response: { content: paraModelo }
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

    return new Response(JSON.stringify({ reply: finalReply, cards }), {
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
