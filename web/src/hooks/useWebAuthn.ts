import { startAuthentication, startRegistration } from '@simplewebauthn/browser'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  finishPasskeyAuthentication,
  finishPasskeyRegistration,
  startPasskeyAuthentication,
  startPasskeyRegistration,
} from '../lib/passkeysApi'

export type WebAuthnResult = 'ok' | 'fallback' | 'unsupported' | 'cancelled'

/**
 * Detección de soporte local. El flujo completo de passkeys requiere enrolamiento
 * y verificación backend; por ahora este hook solo informa compatibilidad del dispositivo.
 */
export function useWebAuthn() {
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (typeof window === 'undefined' || !window.PublicKeyCredential) {
        if (!cancelled) setIsSupported(false)
        return
      }
      try {
        const v = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.()
        if (!cancelled) setIsSupported(!!v)
      } catch {
        if (!cancelled) setIsSupported(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [])

  const registerPasskey = useCallback(
    async (origin: string, deviceName?: string): Promise<WebAuthnResult> => {
      if (!isSupported) return 'unsupported'
      try {
        const { options } = await startPasskeyRegistration(origin)
        const response = (await startRegistration({
          optionsJSON: options as unknown as Parameters<typeof startRegistration>[0]['optionsJSON'],
        })) as unknown as Record<string, unknown>

        await finishPasskeyRegistration(origin, response, deviceName)
        return 'ok'
      } catch (error) {
        if (error instanceof Error && error.name === 'NotAllowedError') return 'cancelled'
        throw error
      }
    },
    [isSupported],
  )

  const authenticate = useCallback(
    async (email: string, origin: string): Promise<WebAuthnResult> => {
      if (!isSupported) return 'unsupported'
      const normalized = email.trim().toLowerCase()
      try {
        const { options } = await startPasskeyAuthentication(normalized, origin)
        const response = (await startAuthentication({
          optionsJSON: options as unknown as Parameters<typeof startAuthentication>[0]['optionsJSON'],
        })) as unknown as Record<string, unknown>

        const { email_otp, verification_type, hashed_token, auth_email } =
          await finishPasskeyAuthentication(normalized, origin, response)
        const emailForVerify = (auth_email ?? normalized).trim()

        const vt = (verification_type as 'magiclink' | 'email') ?? 'magiclink'
        let { error } = await supabase.auth.verifyOtp({
          email: emailForVerify,
          token: email_otp,
          type: vt,
        })
        if (error && vt !== 'email') {
          ;({ error } = await supabase.auth.verifyOtp({
            email: emailForVerify,
            token: email_otp,
            type: 'email',
          }))
        }
        if (error && hashed_token) {
          ;({ error } = await supabase.auth.verifyOtp({
            type: 'magiclink',
            token_hash: hashed_token,
          }))
        }
        if (error) throw error
        return 'ok'
      } catch (error) {
        if (error instanceof Error && error.name === 'NotAllowedError') return 'cancelled'
        if (error instanceof Error && /passkey|credencial|credential|no registrada/i.test(error.message)) {
          return 'fallback'
        }
        throw error
      }
    },
    [isSupported],
  )

  return { isSupported, authenticate, registerPasskey }
}
