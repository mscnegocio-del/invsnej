import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useWebAuthn } from '../hooks/useWebAuthn'

const ERROR_MESSAGES: Record<string, string> = {
  over_email_send_rate_limit: 'Demasiados intentos. Espera unos minutos antes de solicitar otro código.',
  invalid_credentials: 'Credenciales inválidas.',
}

function mapAuthError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('rate') || lower.includes('limit')) return ERROR_MESSAGES.over_email_send_rate_limit
  return message || 'No se pudo completar el inicio de sesión.'
}

export function Login() {
  const { user, loading, authReady } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const { isSupported, authenticate } = useWebAuthn()

  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [phase, setPhase] = useState<'email' | 'otp'>('email')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = window.setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => window.clearInterval(t)
  }, [cooldown])

  if (authReady && !loading && user) {
    return <Navigate to={from} replace />
  }

  const sendOtp = async () => {
    setError(null)
    const trimmed = email.trim()
    if (!trimmed) {
      setError('Ingresa tu correo institucional.')
      return
    }
    setSubmitting(true)
    const redirectTo = `${window.location.origin}/auth/callback`
    const { error: supaError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: redirectTo },
    })
    setSubmitting(false)
    if (supaError) {
      setError(mapAuthError(supaError.message))
      return
    }
    setPhase('otp')
    setCooldown(120)
  }

  const handleSendOtp = (e: FormEvent) => {
    e.preventDefault()
    void sendOtp()
  }

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const trimmed = email.trim()
    const code = otp.trim()
    if (!trimmed || !code) {
      setError('Ingresa el código de 6 dígitos que recibiste por correo.')
      return
    }
    setSubmitting(true)
    const { error: supaError } = await supabase.auth.verifyOtp({
      email: trimmed,
      token: code,
      type: 'email',
    })
    setSubmitting(false)
    if (supaError) {
      setError(mapAuthError(supaError.message))
      return
    }
  }

  const handleBiometric = async () => {
    setError(null)
    const result = await authenticate()
    if (result === 'fallback') {
      setError('Usa el código enviado a tu correo. La verificación solo con dispositivo se habilitará cuando esté vinculada tu cuenta.')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md card p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Inventario patrimonial</h1>
          <p className="text-sm text-slate-600 mt-1">Inicia sesión con tu correo. Recibirás un enlace y un código de un solo uso.</p>
        </div>

        {phase === 'email' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
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
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? 'Enviando…' : 'Enviar código'}
            </button>
          </form>
        )}

        {phase === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <p className="text-sm text-slate-600">
              Revisa tu bandeja (y spam). También puedes pegar aquí el código de 6 dígitos del correo.
            </p>
            <div>
              <label className="label" htmlFor="login-otp">
                Código de un solo uso
              </label>
              <input
                id="login-otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(ev) => setOtp(ev.target.value)}
                className="input tracking-widest font-mono"
                placeholder="000000"
                maxLength={12}
              />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? 'Verificando…' : 'Confirmar código'}
            </button>
            <button
              type="button"
              className="btn-ghost w-full text-sm"
              disabled={cooldown > 0 || submitting}
              onClick={() => void sendOtp()}
            >
              {cooldown > 0 ? `Reenviar código (${cooldown}s)` : 'Reenviar código'}
            </button>
            <button type="button" className="btn-ghost w-full text-sm" onClick={() => setPhase('email')}>
              Cambiar correo
            </button>
          </form>
        )}

        {isSupported && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-500 mb-2">Dispositivo con huella o PIN del sistema</p>
            <button type="button" className="btn-secondary w-full" onClick={() => void handleBiometric()}>
              Continuar con verificación del dispositivo
            </button>
          </div>
        )}

        <p className="text-xs text-slate-500 text-center">
          ¿Problemas con el enlace? Usa el código de 6 dígitos del correo o abre el enlace mágico y luego pulsa «Confirmar acceso» en la página que se abre.
        </p>
      </div>
    </div>
  )
}
