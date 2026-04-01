import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from 'npm:@simplewebauthn/server'
import { isoBase64URL } from 'npm:@simplewebauthn/server/helpers'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type PasskeyRow = {
  id: string
  user_id: string
  credential_id: string
  public_key: string
  counter: number
  transports: string[] | null
  device_name: string | null
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
  backed_up: boolean | null
  device_type: string | null
}

type ChallengeRow = {
  id: string
  user_id: string | null
  email: string | null
  challenge: string
  flow: 'register' | 'authenticate'
  expires_at: string
  used_at: string | null
}

const ALLOWED_HOSTS = new Set(['invsnej.vercel.app', 'localhost', '127.0.0.1'])

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeOrigin(origin: string) {
  const url = new URL(origin)
  if (!ALLOWED_HOSTS.has(url.hostname)) throw new Error('Origen no permitido')
  return {
    origin: url.origin,
    rpID: url.hostname,
  }
}

async function requireUser(req: Request, supabaseUrl: string, anonKey: string) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return { user: null, error: json({ error: 'Sin autorización' }, 401) }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser()

  if (error || !user) return { user: null, error: json({ error: 'Sesión inválida' }, 401) }
  return { user, error: null }
}

async function findUserByEmail(admin: ReturnType<typeof createClient>, email: string) {
  const lower = email.trim().toLowerCase()
  let page = 1
  while (page <= 5) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const found = data.users.find((u) => (u.email ?? '').toLowerCase() === lower)
    if (found) return found
    if (data.users.length < 200) break
    page += 1
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json({ error: 'Configuración del servidor incompleta' }, 500)
  }

  const admin = createClient(supabaseUrl, serviceKey)

  try {
    const body = (await req.json()) as Record<string, unknown>
    const action = String(body.action ?? '')

    if (action === 'list' || action === 'start_registration' || action === 'finish_registration' || action === 'revoke') {
      const { user, error } = await requireUser(req, supabaseUrl, anonKey)
      if (error || !user) return error

      if (action === 'list') {
        const { data, error: listErr } = await admin
          .from('user_passkeys')
          .select('id, credential_id, device_name, created_at, last_used_at, revoked_at, backed_up, device_type')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
        if (listErr) return json({ error: listErr.message }, 400)
        return json({ passkeys: data ?? [] })
      }

      if (action === 'revoke') {
        const passkeyId = String(body.passkey_id ?? '')
        if (!passkeyId) return json({ error: 'Falta passkey_id' }, 400)
        const { error: revokeErr } = await admin
          .from('user_passkeys')
          .update({ revoked_at: new Date().toISOString() })
          .eq('id', passkeyId)
          .eq('user_id', user.id)
          .is('revoked_at', null)
        if (revokeErr) return json({ error: revokeErr.message }, 400)
        return json({ ok: true })
      }

      const originRaw = String(body.origin ?? '')
      const { origin, rpID } = normalizeOrigin(originRaw)

      if (action === 'start_registration') {
        const { data: passkeys, error: passkeyErr } = await admin
          .from('user_passkeys')
          .select('credential_id, transports')
          .eq('user_id', user.id)
          .is('revoked_at', null)
        if (passkeyErr) return json({ error: passkeyErr.message }, 400)

        const options = await generateRegistrationOptions({
          rpName: 'Inventario patrimonial',
          rpID,
          userName: user.email ?? user.id,
          userDisplayName: user.email ?? user.id,
          userID: new TextEncoder().encode(user.id),
          attestationType: 'none',
          excludeCredentials: (passkeys ?? []).map((item) => ({
            id: isoBase64URL.toBuffer(item.credential_id as string),
            transports: ((item.transports ?? []) as string[] | null) ?? undefined,
          })),
          authenticatorSelection: {
            residentKey: 'preferred',
            userVerification: 'preferred',
          },
        })

        await admin.from('auth_webauthn_challenges').insert({
          user_id: user.id,
          email: user.email,
          challenge: options.challenge,
          flow: 'register',
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        })

        return json({ options })
      }

      if (action === 'finish_registration') {
        const response = body.response as Parameters<typeof verifyRegistrationResponse>[0]['response']
        if (!response) return json({ error: 'Falta response' }, 400)

        const { data: challenge, error: chErr } = await admin
          .from('auth_webauthn_challenges')
          .select('id, challenge, expires_at, used_at')
          .eq('user_id', user.id)
          .eq('flow', 'register')
          .is('used_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle<ChallengeRow>()
        if (chErr) return json({ error: chErr.message }, 400)
        if (!challenge) return json({ error: 'No hay un registro WebAuthn pendiente.' }, 400)
        if (new Date(challenge.expires_at).getTime() < Date.now()) return json({ error: 'El registro expiró. Intenta nuevamente.' }, 400)

        const verification = await verifyRegistrationResponse({
          response,
          expectedChallenge: challenge.challenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
          requireUserVerification: true,
        })
        if (!verification.verified || !verification.registrationInfo) {
          return json({ error: 'No se pudo verificar la passkey.' }, 400)
        }

        const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo
        const deviceName = body.device_name ? String(body.device_name) : null

        const { error: insertErr } = await admin.from('user_passkeys').insert({
          user_id: user.id,
          credential_id: credential.id,
          public_key: isoBase64URL.fromBuffer(credential.publicKey),
          counter: credential.counter,
          transports: response.response.transports ?? [],
          device_name: deviceName,
          backed_up: credentialBackedUp,
          device_type: credentialDeviceType,
        })
        if (insertErr) return json({ error: insertErr.message }, 400)

        await admin.from('auth_webauthn_challenges').update({ used_at: new Date().toISOString() }).eq('id', challenge.id)
        return json({ ok: true })
      }
    }

    if (action === 'start_authentication' || action === 'finish_authentication') {
      const email = String(body.email ?? '').trim().toLowerCase()
      if (!email) return json({ error: 'Falta email' }, 400)
      const originRaw = String(body.origin ?? '')
      const { origin, rpID } = normalizeOrigin(originRaw)
      const authUser = await findUserByEmail(admin, email)
      if (!authUser) return json({ error: 'No existe una cuenta para ese correo.' }, 404)

      if (action === 'start_authentication') {
        const { data: passkeys, error: passkeyErr } = await admin
          .from('user_passkeys')
          .select('credential_id, transports')
          .eq('user_id', authUser.id)
          .is('revoked_at', null)
        if (passkeyErr) return json({ error: passkeyErr.message }, 400)
        if (!passkeys || passkeys.length === 0) return json({ error: 'No hay passkeys registradas para este correo.' }, 404)

        const options = await generateAuthenticationOptions({
          rpID,
          allowCredentials: passkeys.map((item) => ({
            id: isoBase64URL.toBuffer(item.credential_id as string),
            transports: ((item.transports ?? []) as string[] | null) ?? undefined,
          })),
          userVerification: 'preferred',
        })

        await admin.from('auth_webauthn_challenges').insert({
          user_id: authUser.id,
          email,
          challenge: options.challenge,
          flow: 'authenticate',
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        })

        return json({ options })
      }

      if (action === 'finish_authentication') {
        const response = body.response as Parameters<typeof verifyAuthenticationResponse>[0]['response']
        if (!response) return json({ error: 'Falta response' }, 400)

        const { data: challenge, error: chErr } = await admin
          .from('auth_webauthn_challenges')
          .select('id, challenge, expires_at, used_at')
          .eq('user_id', authUser.id)
          .eq('flow', 'authenticate')
          .is('used_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle<ChallengeRow>()
        if (chErr) return json({ error: chErr.message }, 400)
        if (!challenge) return json({ error: 'No hay una autenticación WebAuthn pendiente.' }, 400)
        if (new Date(challenge.expires_at).getTime() < Date.now()) return json({ error: 'La autenticación expiró. Intenta nuevamente.' }, 400)

        const { data: passkey, error: passkeyErr } = await admin
          .from('user_passkeys')
          .select('*')
          .eq('user_id', authUser.id)
          .eq('credential_id', response.id)
          .is('revoked_at', null)
          .maybeSingle<PasskeyRow>()
        if (passkeyErr) return json({ error: passkeyErr.message }, 400)
        if (!passkey) return json({ error: 'La passkey no está registrada o fue revocada.' }, 404)

        const verification = await verifyAuthenticationResponse({
          response,
          expectedChallenge: challenge.challenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
          requireUserVerification: true,
          credential: {
            id: passkey.credential_id,
            publicKey: isoBase64URL.toBuffer(passkey.public_key),
            counter: Number(passkey.counter),
            transports: passkey.transports ?? undefined,
          },
        })
        if (!verification.verified) return json({ error: 'No se pudo verificar la passkey.' }, 400)

        await admin
          .from('user_passkeys')
          .update({
            counter: verification.authenticationInfo.newCounter,
            last_used_at: new Date().toISOString(),
          })
          .eq('id', passkey.id)

        await admin.from('auth_webauthn_challenges').update({ used_at: new Date().toISOString() }).eq('id', challenge.id)

        const redirectTo = `${origin}/auth/callback`
        const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
          type: 'magiclink',
          email,
          options: { redirectTo },
        })
        if (linkErr) return json({ error: linkErr.message }, 400)

        const emailOtp = linkData.properties.email_otp
        const verificationType = linkData.properties.verification_type
        if (!emailOtp) return json({ error: 'No se pudo generar el token de sesión fallback.' }, 500)

        return json({
          email_otp: emailOtp,
          verification_type: verificationType,
        })
      }
    }

    return json({ error: 'Acción no permitida' }, 405)
  } catch (error) {
    console.error(error)
    return json({ error: error instanceof Error ? error.message : 'Error interno' }, 500)
  }
})
