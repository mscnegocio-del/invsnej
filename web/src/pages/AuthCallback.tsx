import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export function AuthCallback() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const confirmar = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) throw error
        navigate('/', { replace: true })
        return
      }

      const hash = window.location.hash?.replace(/^#/, '')
      if (hash) {
        const params = new URLSearchParams(hash)
        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token })
          if (error) throw error
          window.history.replaceState({}, document.title, window.location.pathname + window.location.search)
          navigate('/', { replace: true })
          return
        }
      }

      setMessage(
        'No se encontró un código válido en el enlace. Solicita un nuevo acceso desde el inicio de sesión.',
      )
    } catch (e) {
      console.error(e)
      setMessage(
        'No se pudo confirmar el acceso. Si el enlace ya fue usado o caducó, solicita un nuevo código.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md card p-6 space-y-4 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Confirmar inicio de sesión</h1>
        <p className="text-sm text-slate-600">
          Pulsa el botón para completar el acceso. Esto evita que herramientas de seguridad del correo consuman el enlace antes que tú.
        </p>
        {message && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{message}</p>}
        <button type="button" className="btn-primary w-full" disabled={loading} onClick={() => void confirmar()}>
          {loading ? 'Confirmando…' : 'Confirmar acceso'}
        </button>
        <Link to="/login" className="inline-block text-sm text-teal-700 underline">
          Volver al inicio de sesión
        </Link>
      </div>
    </div>
  )
}
