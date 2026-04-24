import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return new Response(JSON.stringify({ error: 'Configuración del servidor incompleta' }), {
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

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser()
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: 'Sesión inválida' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(supabaseUrl, serviceKey)

  const { data: perfil } = await admin
    .from('perfiles')
    .select('app_role, activo, acceso_estado')
    .eq('id', user.id)
    .maybeSingle()
  const accesoOk =
    perfil &&
    perfil.app_role === 'admin' &&
    perfil.activo === true &&
    (perfil as { acceso_estado?: string }).acceso_estado === 'activo'
  if (!accesoOk) {
    return new Response(JSON.stringify({ error: 'Sin permiso' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (req.method === 'GET') {
    // No usar auth.admin.listUsers: con confirmation_token NULL en auth.users GoTrue puede devolver
    // "Database error finding users" (bug de scan en GoTrue). Listamos vía RPC con columnas mínimas.
    const { data: authRows, error: rpcErr } = await admin.rpc('admin_list_auth_users')
    if (rpcErr) {
      return new Response(JSON.stringify({ error: rpcErr.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const listUsers = (authRows ?? []) as { id: string; email: string | undefined; created_at: string }[]
    const ids = listUsers.map((u) => u.id)
    const { data: perfiles, error: perfilErr } =
      ids.length === 0
        ? {
            data: [] as {
              id: string
              app_role: string
              nombre: string | null
              activo: boolean
              acceso_estado: string
            }[],
            error: null,
          }
        : await admin.from('perfiles').select('id, app_role, nombre, activo, acceso_estado').in('id', ids)
    if (perfilErr) {
      return new Response(JSON.stringify({ error: perfilErr.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const map = new Map((perfiles ?? []).map((p) => [p.id as string, p]))
    const users = listUsers.map((u) => {
      const p = map.get(u.id)
      const acceso = (p as { acceso_estado?: string } | undefined)?.acceso_estado
      const activoRow = p?.activo ?? false
      return {
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at,
        app_role: (p?.app_role as string) ?? 'consulta',
        nombre: p?.nombre ?? null,
        activo: activoRow,
        acceso_estado: (typeof acceso === 'string' ? acceso : 'pendiente') as 'pendiente' | 'activo' | 'rechazado',
      }
    })
    return new Response(JSON.stringify({ users }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (req.method === 'POST') {
    const body = (await req.json()) as { email?: string; app_role?: string }
    const email = body.email?.trim()
    const app_role = body.app_role
    if (!email || !app_role) {
      return new Response(JSON.stringify({ error: 'Faltan email o rol' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const appUrl = Deno.env.get('APP_URL') ?? ''
    const redirectTo = appUrl ? `${appUrl.replace(/\/$/, '')}/auth/callback` : undefined

    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
    })
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (data.user) {
      await admin
        .from('perfiles')
        .update({
          app_role,
          acceso_estado: 'pendiente',
          activo: false,
        })
        .eq('id', data.user.id)
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (req.method === 'PATCH') {
    const body = (await req.json()) as {
      user_id?: string
      app_role?: string
      activo?: boolean
      acceso_estado?: string
    }
    const user_id = body.user_id
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'Falta user_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const estados = ['pendiente', 'activo', 'rechazado'] as const
    const selfBlock =
      user_id === user.id &&
      (body.activo === false ||
        body.acceso_estado === 'rechazado' ||
        body.acceso_estado === 'pendiente')
    if (selfBlock) {
      return new Response(JSON.stringify({ error: 'No puedes restringir tu propia cuenta' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (body.acceso_estado !== undefined && !estados.includes(body.acceso_estado as (typeof estados)[number])) {
      return new Response(JSON.stringify({ error: 'acceso_estado inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const patch: Record<string, unknown> = {}
    if (body.app_role !== undefined) patch.app_role = body.app_role
    if (body.acceso_estado !== undefined) {
      patch.acceso_estado = body.acceso_estado
      patch.activo = body.acceso_estado === 'activo'
    } else if (body.activo !== undefined) {
      patch.activo = body.activo
      patch.acceso_estado = body.activo ? 'activo' : 'rechazado'
    }
    const { error } = await admin.from('perfiles').update(patch).eq('id', user_id)
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ error: 'Método no permitido' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
