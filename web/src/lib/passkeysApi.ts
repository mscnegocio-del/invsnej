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

async function invokePasskeys<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<PasskeysResponse<T>>('passkeys', {
    method: 'POST',
    body,
  })

  if (error) throw error
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
