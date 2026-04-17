import type { FormEvent } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { Fingerprint, Loader2, ClipboardList } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useWebAuthn } from '../hooks/useWebAuthn'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Separator } from '../components/ui/separator'

const ERROR_MESSAGES: Record<string, string> = {
  over_email_send_rate_limit: 'Demasiados intentos. Espera unos minutos antes de solicitar otro código.',
  invalid_credentials: 'Credenciales inválidas.',
}

const OTP_SOLICITUD_GENERICA =
  'Si tu correo está autorizado, recibirás un código en breve. Si aún no tienes acceso, pide una invitación al administrador.'

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
    try { turnstileRef.current?.reset() } catch { /* noop */ }
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
    if (!trimmed) { setError('Ingresa tu correo institucional.'); return }
    if (turnstileSiteKey && !captchaToken) { setError('Completa la verificación anti-robots antes de enviar el código.'); return }
    setSubmitting(true)
    const { error: supaError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: false,
        ...(captchaToken ? { captchaToken } : {}),
      },
    })
    setSubmitting(false)
    resetCaptcha()
    if (supaError) { setError(mapAuthErrorSendCode(supaError.message)); return }
    setPhase('code')
    setCooldown(120)
  }

  const handleSendCode = (e: FormEvent) => { e.preventDefault(); void sendCode() }

  const handleVerifyCode = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const trimmed = email.trim()
    const token = code.trim()
    if (!trimmed || !token) { setError('Ingresa el código que recibiste por correo.'); return }
    if (token.length < EMAIL_OTP_MIN_LENGTH || token.length > EMAIL_OTP_MAX_LENGTH) {
      setError(`El código debe tener entre ${EMAIL_OTP_MIN_LENGTH} y ${EMAIL_OTP_MAX_LENGTH} dígitos.`)
      return
    }
    setSubmitting(true)
    const verifyOpts: { captchaToken?: string } = {}
    if (turnstileSiteKey && captchaToken) verifyOpts.captchaToken = captchaToken
    const { error: supaError } = await supabase.auth.verifyOtp({
      email: trimmed, token, type: 'email',
      options: Object.keys(verifyOpts).length ? verifyOpts : undefined,
    })
    setSubmitting(false)
    resetCaptcha()
    if (supaError) setError(mapAuthErrorVerify(supaError.message))
  }

  const handlePasskey = async () => {
    setError(null)
    const trimmed = email.trim()
    if (!trimmed) { setError('Ingresa tu correo antes de continuar con passkey.'); return }
    setSubmitting(true)
    try {
      const result = await authenticate(trimmed, window.location.origin)
      if (result === 'unsupported') setError('Este dispositivo o navegador no soporta passkeys.')
      else if (result === 'cancelled') setError('Se canceló la verificación con passkey.')
      else if (result === 'fallback') setError('No se encontró una passkey válida. Usa el código enviado a tu correo.')
    } catch (e) {
      const raw = e instanceof Error ? e.message : ''
      const detail = raw ? mapAuthErrorSendCode(raw) : ''
      setError(detail ? `Acceso con passkey: ${detail}` : 'No se pudo completar el acceso con passkey. Usa el código por correo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground leading-none">Inventario patrimonial</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Sistema de gestión de bienes</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">
              {phase === 'email' ? 'Iniciar sesión' : 'Verificar código'}
            </CardTitle>
            <CardDescription>
              {phase === 'email'
                ? 'Ingresa con tu correo. Recibirás un código numérico para iniciar sesión.'
                : `Revisa tu correo ${email} e ingresa el código de ${EMAIL_OTP_MIN_LENGTH}-${EMAIL_OTP_MAX_LENGTH} dígitos.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={phase === 'email' ? handleSendCode : handleVerifyCode} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="login-email">Correo electrónico</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  placeholder="tu.correo@institucion.gob.pe"
                  disabled={phase === 'code'}
                />
              </div>

              {phase === 'code' && (
                <div className="space-y-1.5">
                  <Label htmlFor="login-code">Código del correo</Label>
                  <Input
                    id="login-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(ev) => setCode(ev.target.value.replace(/\D/g, '').slice(0, EMAIL_OTP_MAX_LENGTH))}
                    className="tracking-[0.35em] font-mono text-center text-lg"
                    placeholder="·····"
                    maxLength={EMAIL_OTP_MAX_LENGTH}
                    autoFocus
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

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={submitting || (Boolean(turnstileSiteKey) && !captchaToken)}
                className="w-full"
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />{phase === 'email' ? 'Enviando…' : 'Verificando…'}</>
                ) : (
                  phase === 'email' ? 'Enviar código' : 'Confirmar código'
                )}
              </Button>

              {phase === 'code' && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-sm"
                    disabled={cooldown > 0 || submitting}
                    onClick={() => void sendCode()}
                  >
                    {cooldown > 0 ? `Reenviar código (${cooldown}s)` : 'Reenviar código'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-sm"
                    onClick={() => { setPhase('email'); setCode(''); resetCaptcha() }}
                  >
                    Cambiar correo
                  </Button>
                </>
              )}
            </form>

            {isSupported && (
              <>
                <Separator className="my-4" />
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Si ya registraste una passkey en este dispositivo, puedes ingresar sin esperar el correo.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full gap-2"
                    disabled={submitting}
                    onClick={() => void handlePasskey()}
                  >
                    <Fingerprint className="h-4 w-4" />
                    Continuar con passkey
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center px-4">
          El acceso requiere invitación previa. Contacta al administrador del sistema si no tienes acceso.
        </p>
      </div>
    </div>
  )
}
