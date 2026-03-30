import { useCallback, useEffect, useState } from 'react'

export type WebAuthnResult = 'ok' | 'fallback'

/**
 * Detección de soporte local. El flujo completo de passkeys requiere backend;
 * aquí se deja listo el hook para no bloquear la UI si el dispositivo no soporta.
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

  const authenticate = useCallback(async (): Promise<WebAuthnResult> => {
    return 'fallback'
  }, [])

  return { isSupported, authenticate }
}
