import { FunctionsHttpError, FunctionsRelayError } from '@supabase/functions-js'
import { supabase } from './supabaseClient'
import type { UserPasskey } from '../types'

type PasskeysAction =
  | 'list'
  | 'start_registration'
  | 'finish_registration'
  | 'start_authentication'
  | 'finish_authentication'
  | 'revoke'

type PasskeysResponse<T> = T & { error?: string }

/** El SDK solo pone "non-2xx"; el cuerpo JSON de la Edge suele traer { error: "..." }. */
async function messageFromFunctionsFailure(error: unknown, response?: Response): Promise<string> {
  const res =
    response ??
    (error instanceof FunctionsHttpError || error instanceof FunctionsRelayError
      ? (error as FunctionsHttpError | FunctionsRelayError).context
      : undefined)

  if (res) {
    try {
      const text = await res.text()
      if (text) {
        try {
          const parsed = JSON.parse(text) as { error?: unknown; message?: unknown }
          if (parsed.error != null) return String(parsed.error)
          if (parsed.message != null) return String(parsed.message)
        } catch {
          if (text.length < 400) return text
        }
      }
      const st = res.status
      if (st >= 400) {
        return `La función passkeys respondió HTTP ${st}. Revisa dominio (PASSKEY_EXTRA_HOSTS en Supabase) o logs de la función.`
      }
    } catch {
      /* ignore */
    }
  }

  if (error instanceof Error) return error.message
  return 'Error al llamar a la función passkeys.'
}

async function invokePasskeys<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error, response } = await supabase.functions.invoke<PasskeysResponse<T>>('passkeys', {
    method: 'POST',
    body,
  })

  if (error) {
    throw new Error(await messageFromFunctionsFailure(error, response))
  }
  if (data && 'error' in data && data.error) throw new Error(String(data.error))
  return data as T
}

export async function listPasskeys(): Promise<UserPasskey[]> {
  const data = await invokePasskeys<{ passkeys?: UserPasskey[] }>({ action: 'list' satisfies PasskeysAction })
  return data?.passkeys ?? []
}

export async function startPasskeyRegistration(origin: string) {
  return invokePasskeys<{ options: Record<string, unknown> }>({
    action: 'start_registration' satisfies PasskeysAction,
    origin,
  })
}

export async function finishPasskeyRegistration(
  origin: string,
  response: Record<string, unknown>,
  deviceName?: string,
) {
  return invokePasskeys<{ ok: boolean }>({
    action: 'finish_registration' satisfies PasskeysAction,
    origin,
    response,
    device_name: deviceName ?? null,
  })
}

export async function startPasskeyAuthentication(email: string, origin: string) {
  return invokePasskeys<{ options: Record<string, unknown> }>({
    action: 'start_authentication' satisfies PasskeysAction,
    email,
    origin,
  })
}

export async function finishPasskeyAuthentication(
  email: string,
  origin: string,
  response: Record<string, unknown>,
) {
  return invokePasskeys<{
    email_otp: string
    verification_type: string
    hashed_token?: string
    auth_email?: string
  }>({
    action: 'finish_authentication' satisfies PasskeysAction,
    email,
    origin,
    response,
  })
}

export async function revokePasskey(passkeyId: string) {
  return invokePasskeys<{ ok: boolean }>({
    action: 'revoke' satisfies PasskeysAction,
    passkey_id: passkeyId,
  })
}
