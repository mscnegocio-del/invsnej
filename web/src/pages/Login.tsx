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
  const { isSupported } = useWebAuthn()

  const [email, setEmail] = useState('')
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

  const sendMagicLink = async () => {
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
    setCooldown(120)
  }

  const handleSendMagicLink = (e: FormEvent) => {
    e.preventDefault()
    void sendMagicLink()
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md card p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Inventario patrimonial</h1>
          <p className="text-sm text-slate-600 mt-1">
            Ingresa con tu correo. Te enviaremos un enlace mágico para completar el acceso.
          </p>
        </div>

        <form onSubmit={handleSendMagicLink} className="space-y-4">
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
          <p className="text-sm text-slate-600">
            Abre el enlace desde el mismo navegador del dispositivo donde estás usando la app.
          </p>
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Enviando…' : 'Enviar enlace'}
          </button>
          <button
            type="button"
            className="btn-ghost w-full text-sm"
            disabled={cooldown > 0 || submitting}
            onClick={() => void sendMagicLink()}
          >
            {cooldown > 0 ? `Reenviar enlace (${cooldown}s)` : 'Reenviar enlace'}
          </button>
        </form>

        {isSupported && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              Tu dispositivo soporta passkeys/WebAuthn. Esta opción se habilitará como acceso preferente
              después del primer ingreso por enlace mágico.
            </p>
          </div>
        )}

        <p className="text-xs text-slate-500 text-center">
          Si el enlace abre una página de confirmación, pulsa <strong>Confirmar acceso</strong>. Si el
          enlace ya fue usado o caducó, solicita uno nuevo.
        </p>
      </div>
    </div>
  )
}
