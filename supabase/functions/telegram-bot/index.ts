import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

// Webhook de Telegram para consulta de bienes patrimoniales.
// Acceso: auto-vínculo correo institucional + código (Supabase Auth OTP).
// Desplegar con verificación de JWT DESHABILITADA (Telegram no envía JWT de Supabase).
// La autenticidad del webhook se valida con el header secreto de Telegram.

const TELEGRAM_API = 'https://api.telegram.org'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_INTENTOS_CODIGO = 5

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function tg(token: string, method: string, payload: Record<string, unknown>) {
  try {
    await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (e) {
    console.error(`Telegram ${method} falló:`, (e as Error).message)
  }
}

function reply(token: string, chatId: number, text: string) {
  return tg(token, 'sendMessage', { chat_id: chatId, text, parse_mode: 'HTML' })
}

function formatBien(b: Record<string, any>): string {
  const lines = [
    `📦 <b>${escapeHtml(String(b.codigo_patrimonial ?? ''))}</b>`,
    `🏷️ ${escapeHtml(String(b.nombre_mueble_equipo ?? '—'))}`,
  ]
  if (b.tipo_mueble_equipo) lines.push(`Tipo: ${escapeHtml(String(b.tipo_mueble_equipo))}`)
  const marcaModelo = [b.marca, b.modelo].filter(Boolean).join(' / ')
  if (marcaModelo) lines.push(`Marca/Modelo: ${escapeHtml(marcaModelo)}`)
  if (b.estado) lines.push(`Estado: ${escapeHtml(String(b.estado))}`)
  if (b.ubicacion) lines.push(`Ubicación: ${escapeHtml(String(b.ubicacion))}`)
  lines.push(`Responsable: ${escapeHtml(String(b.trabajadores?.nombre ?? '—'))}`)
  if (b.orden_compra) lines.push(`O/C: ${escapeHtml(String(b.orden_compra))}`)
  return lines.join('\n')
}

Deno.serve(async (req) => {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
  const webhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!botToken || !webhookSecret || !supabaseUrl || !serviceKey || !anonKey) {
    console.error('Faltan secrets de configuración')
    return new Response('config', { status: 500 })
  }

  // Autenticidad del webhook: Telegram reenvía el secreto configurado en setWebhook.
  if (req.headers.get('x-telegram-bot-api-secret-token') !== webhookSecret) {
    return new Response('unauthorized', { status: 401 })
  }

  let update: any
  try {
    update = await req.json()
  } catch {
    return new Response('ok')
  }

  const message = update?.message
  const chatId: number | undefined = message?.chat?.id
  const text: string = (message?.text ?? '').trim()
  if (!chatId || !text) return new Response('ok')

  const db = createClient(supabaseUrl, serviceKey)
  const auth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })

  try {
    // ¿Ya está vinculado y activo?
    const { data: vinculo } = await db
      .from('telegram_usuarios')
      .select('perfil_id, email, activo')
      .eq('chat_id', chatId)
      .eq('activo', true)
      .maybeSingle()

    // Comandos globales
    if (text === '/start' || text === '/login') {
      await db.from('telegram_sesiones').upsert({
        chat_id: chatId, estado: 'esperando_email', email_pendiente: null, intentos: 0, updated_at: new Date().toISOString(),
      })
      await reply(botToken, chatId,
        'Hola 👋 Soy el asistente de inventario patrimonial.\n\n' +
        'Para verificar tu acceso, envíame tu <b>correo institucional</b> (el que usas en el sistema).')
      return new Response('ok')
    }

    if (text === '/salir' || text === '/logout') {
      await db.from('telegram_usuarios').delete().eq('chat_id', chatId)
      await db.from('telegram_sesiones').delete().eq('chat_id', chatId)
      await reply(botToken, chatId, 'Listo, desvinculé este chat. Escribe /start para volver a verificar tu acceso.')
      return new Response('ok')
    }

    if (text === '/ayuda' || text === '/help') {
      await reply(botToken, chatId, vinculo
        ? 'Envíame un <b>código patrimonial</b> y te muestro los datos del bien.\n/salir para desvincular este chat.'
        : 'Escribe /start para verificar tu acceso con tu correo institucional.')
      return new Response('ok')
    }

    // Usuario ya verificado: tratar el texto como código patrimonial
    if (vinculo) {
      const { data: bien, error } = await db
        .from('bienes')
        .select('*, trabajadores(nombre)')
        .eq('codigo_patrimonial', text)
        .is('eliminado_at', null)
        .maybeSingle()
      if (error) {
        await reply(botToken, chatId, 'Hubo un error al consultar. Intenta de nuevo en un momento.')
      } else if (!bien) {
        await reply(botToken, chatId, `No encontré ningún bien con el código <b>${escapeHtml(text)}</b>.`)
      } else {
        await reply(botToken, chatId, formatBien(bien))
      }
      return new Response('ok')
    }

    // No verificado: máquina de estados de verificación
    const { data: sesion } = await db
      .from('telegram_sesiones')
      .select('estado, email_pendiente, intentos')
      .eq('chat_id', chatId)
      .maybeSingle()
    const estado = sesion?.estado ?? 'inicio'

    if (estado === 'esperando_email') {
      const email = text.toLowerCase()
      if (!EMAIL_RE.test(email)) {
        await reply(botToken, chatId, 'Eso no parece un correo válido. Envíame tu correo institucional.')
        return new Response('ok')
      }
      const { error } = await auth.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
      if (error) {
        await reply(botToken, chatId,
          'Ese correo no está registrado en el sistema. Pide al administrador que cree y apruebe tu cuenta, luego escribe /start.')
        return new Response('ok')
      }
      await db.from('telegram_sesiones').upsert({
        chat_id: chatId, estado: 'esperando_codigo', email_pendiente: email, intentos: 0, updated_at: new Date().toISOString(),
      })
      await reply(botToken, chatId,
        `Te envié un código de 6 dígitos a <b>${escapeHtml(email)}</b>.\nEscríbelo aquí para confirmar tu acceso.`)
      return new Response('ok')
    }

    if (estado === 'esperando_codigo') {
      const email = sesion?.email_pendiente ?? ''
      const code = text.replace(/\s+/g, '')
      const { error } = await auth.auth.verifyOtp({ email, token: code, type: 'email' })
      if (error) {
        const intentos = (sesion?.intentos ?? 0) + 1
        if (intentos >= MAX_INTENTOS_CODIGO) {
          await db.from('telegram_sesiones').upsert({
            chat_id: chatId, estado: 'esperando_email', email_pendiente: null, intentos: 0, updated_at: new Date().toISOString(),
          })
          await reply(botToken, chatId, 'Demasiados intentos. Envíame tu correo de nuevo para reiniciar.')
        } else {
          await db.from('telegram_sesiones').update({ intentos, updated_at: new Date().toISOString() }).eq('chat_id', chatId)
          await reply(botToken, chatId, 'Código inválido o vencido. Intenta de nuevo, o escribe /start para reiniciar.')
        }
        return new Response('ok')
      }

      // Código válido: confirmar que el perfil esté aprobado
      const { data: perfil } = await db.rpc('perfil_por_email', { p_email: email }).maybeSingle()
      if (!perfil || perfil.acceso_estado !== 'activo' || perfil.activo !== true) {
        await db.from('telegram_sesiones').update({ estado: 'inicio', email_pendiente: null, updated_at: new Date().toISOString() }).eq('chat_id', chatId)
        await reply(botToken, chatId,
          'Tu correo está verificado, pero tu cuenta aún no está aprobada. Pide al administrador que la active y vuelve a intentar con /start.')
        return new Response('ok')
      }

      await db.from('telegram_usuarios').upsert({
        chat_id: chatId, perfil_id: perfil.id, email, activo: true, vinculado_at: new Date().toISOString(),
      })
      await db.from('telegram_sesiones').update({ estado: 'vinculado', email_pendiente: null, updated_at: new Date().toISOString() }).eq('chat_id', chatId)
      await reply(botToken, chatId,
        '✅ Acceso verificado. Ya puedes consultar.\nEnvíame un <b>código patrimonial</b> para ver los datos del bien.')
      return new Response('ok')
    }

    // Estado inicial / desconocido
    await reply(botToken, chatId, 'Escribe /start para verificar tu acceso con tu correo institucional.')
    return new Response('ok')
  } catch (e) {
    console.error('Error:', (e as Error).message)
    // Responder 200 para que Telegram no reintente en bucle
    return new Response('ok')
  }
})
