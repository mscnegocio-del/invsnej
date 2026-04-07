import type { FormEvent } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useWebAuthn } from '../hooks/useWebAuthn'

const ERROR_MESSAGES: Record<string, string> = {
  over_email_send_rate_limit: 'Demasiados intentos. Espera unos minutos antes de solicitar otro código.',
  invalid_credentials: 'Credenciales inválidas.',
}

/** Mensaje genérico al solicitar código (evita filtrar si el correo existe en el sistema). */
const OTP_SOLICITUD_GENERICA =
  'Si tu correo está autorizado, recibirás un código en breve. Si aún no tienes acceso, pide una invitación al administrador.'

/** Supabase suele enviar 6 u 8 dígitos en {{ .Token }} según el proyecto. */
const EMAIL_OTP_MIN_LENGTH = 6
const EMAIL_OTP_MAX_LENGTH = 8

const turnstileSiteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() || ''

function mapAuthErrorSendCode(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('rate') || lower.includes('too many') || lower.includes('over_email')) {
    return ERROR_MESSAGES.over_email_send_rate_limit
  }
  return OTP_SOLICITUD_GENERICA
}

function mapAuthErrorVerify(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('rate') || lower.includes('limit')) return ERROR_MESSAGES.over_email_send_rate_limit
  if (lower.includes('expired') || lower.includes('invalid') || lower.includes('token')) {
    return 'El código no es válido o expiró. Solicita uno nuevo e inténtalo de nuevo.'
  }
  return message || 'No se pudo verificar el código.'
}

export function Login() {
  const { user, loading, authReady } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const { isSupported, authenticate } = useWebAuthn()

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [phase, setPhase] = useState<'email' | 'code'>('email')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileInstance | null>(null)

  const resetCaptcha = useCallback(() => {
    setCaptchaToken(null)
    try {
      turnstileRef.current?.reset()
    } catch {
      /* noop */
    }
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = window.setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => window.clearInterval(t)
  }, [cooldown])

  if (authReady && !loading && user) {
    return <Navigate to={from} replace />
  }

  const sendCode = async () => {
    setError(null)
    const trimmed = email.trim()
    if (!trimmed) {
      setError('Ingresa tu correo institucional.')
      return
    }
    if (turnstileSiteKey && !captchaToken) {
      setError('Completa la verificación anti-robots antes de enviar el código.')
      return
    }
    setSubmitting(true)
    const redirectTo = `${window.location.origin}/auth/callback`
    const { error: supaError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: false,
        ...(captchaToken ? { captchaToken } : {}),
      },
    })
    setSubmitting(false)
    resetCaptcha()
    if (supaError) {
      setError(mapAuthErrorSendCode(supaError.message))
      return
    }
    setPhase('code')
    setCooldown(120)
  }

  const handleSendCode = (e: FormEvent) => {
    e.preventDefault()
    void sendCode()
  }

  const handleVerifyCode = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const trimmed = email.trim()
    const token = code.trim()
    if (!trimmed || !token) {
      setError('Ingresa el código que recibiste por correo.')
      return
    }
    if (token.length < EMAIL_OTP_MIN_LENGTH || token.length > EMAIL_OTP_MAX_LENGTH) {
      setError(`El código debe tener entre ${EMAIL_OTP_MIN_LENGTH} y ${EMAIL_OTP_MAX_LENGTH} dígitos.`)
      return
    }
    setSubmitting(true)
    const verifyOpts: { redirectTo?: string; captchaToken?: string } = {}
    if (turnstileSiteKey && captchaToken) verifyOpts.captchaToken = captchaToken
    const { error: supaError } = await supabase.auth.verifyOtp({
      email: trimmed,
      token,
      type: 'email',
      options: Object.keys(verifyOpts).length ? verifyOpts : undefined,
    })
    setSubmitting(false)
    resetCaptcha()
    if (supaError) {
      setError(mapAuthErrorVerify(supaError.message))
      return
    }
  }

  const handlePasskey = async () => {
    setError(null)
    const trimmed = email.trim()
    if (!trimmed) {
      setError('Ingresa tu correo antes de continuar con passkey.')
      return
    }

    setSubmitting(true)
    try {
      const result = await authenticate(trimmed, window.location.origin)
      if (result === 'unsupported') {
        setError('Este dispositivo o navegador no soporta passkeys.')
      } else if (result === 'cancelled') {
        setError('Se canceló la verificación con passkey.')
      } else if (result === 'fallback') {
        setError('No se encontró una passkey válida. Usa el código enviado a tu correo.')
      }
    } catch (e) {
      console.error(e)
      const raw = e instanceof Error ? e.message : ''
      const detail = raw ? mapAuthErrorSendCode(raw) : ''
      setError(
        detail
          ? `Acceso con passkey: ${detail} Si sigue fallando, usa el código por correo.`
          : 'No se pudo completar el acceso con passkey. Usa el código por correo como fallback.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md card p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Inventario patrimonial</h1>
          <p className="text-sm text-slate-600 mt-1">
            Ingresa con tu correo. Recibirás un código numérico para iniciar sesión (suele ser de 6 u 8 dígitos). El
            acceso requiere invitación previa.
          </p>
        </div>

        <form onSubmit={phase === 'email' ? handleSendCode : handleVerifyCode} className="space-y-4">
          <div>
            <label className="label" htmlFor="login-email">
              Correo electrónico
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              className="input"
              placeholder="tu.correo@institucion.gob.pe"
            />
          </div>
          {phase === 'code' && (
            <div>
              <label className="label" htmlFor="login-code">
                Código del correo
              </label>
              <input
                id="login-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(ev) =>
                  setCode(ev.target.value.replace(/\D/g, '').slice(0, EMAIL_OTP_MAX_LENGTH))
                }
                className="input tracking-[0.35em] font-mono"
                placeholder="00000000"
                maxLength={EMAIL_OTP_MAX_LENGTH}
              />
            </div>
          )}
          {turnstileSiteKey && (
            <div className="flex justify-center min-h-[65px]">
              <Turnstile
                ref={turnstileRef}
                siteKey={turnstileSiteKey}
                onSuccess={(tok) => setCaptchaToken(tok)}
                onExpire={() => setCaptchaToken(null)}
                onError={() => setCaptchaToken(null)}
                options={{ theme: 'auto', size: 'normal' }}
              />
            </div>
          )}

          {phase === 'email' ? (
            <p className="text-sm text-slate-600">
              Puedes abrir el correo en el mismo celular o en la PC y escribir el código aquí.
            </p>
          ) : (
            <p className="text-sm text-slate-600">
              Si no llegó el código, revisa spam o solicita uno nuevo cuando el temporizador termine.
              {turnstileSiteKey ? ' Tras reenviar, completa de nuevo la verificación anti-robots.' : ''}
            </p>
          )}
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <button
            type="submit"
            disabled={
              submitting || (Boolean(turnstileSiteKey) && !captchaToken)
            }
            className="btn-primary w-full"
          >
            {submitting ? (phase === 'email' ? 'Enviando…' : 'Verificando…') : phase === 'email' ? 'Enviar código' : 'Confirmar código'}
          </button>
          <button
            type="button"
            className="btn-ghost w-full text-sm"
            disabled={cooldown > 0 || submitting}
            onClick={() => void sendCode()}
          >
            {cooldown > 0 ? `Reenviar código (${cooldown}s)` : 'Reenviar código'}
          </button>
          {phase === 'code' && (
            <button
              type="button"
              className="btn-ghost w-full text-sm"
              onClick={() => {
                setPhase('email')
                setCode('')
                resetCaptcha()
              }}
            >
              Cambiar correo
            </button>
          )}
        </form>

        {isSupported && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-500 mb-2">
              Si ya registraste una passkey en este dispositivo, puedes ingresar sin esperar el correo.
            </p>
            <button type="button" disabled={submitting} className="btn-secondary w-full" onClick={() => void handlePasskey()}>
              Continuar con passkey
            </button>
          </div>
        )}

        <p className="text-xs text-slate-500 text-center">
          Si tu correo todavía muestra un enlace en lugar del código, úsalo solo como compatibilidad temporal
          mientras se termina de alinear la plantilla del proveedor.
        </p>
      </div>
    </div>
  )
}
