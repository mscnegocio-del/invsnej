import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Alert, AlertDescription } from '../components/ui/alert'

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
        'No se encontró un enlace válido. Si estás usando el nuevo flujo por código, vuelve al inicio de sesión y solicita un código de acceso.',
      )
    } catch (e) {
      console.error(e)
      setMessage(
        'No se pudo confirmar el acceso. Si el enlace ya fue usado, caducó o lo abrió otro navegador, vuelve al login y solicita un código nuevo.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-6 space-y-4">
          <h1 className="text-lg font-semibold">Confirmar inicio de sesión</h1>
          <p className="text-sm text-muted-foreground">
            Esta pantalla queda como compatibilidad transitoria para enlaces heredados. El método principal de
            acceso ahora es el código numérico enviado al correo.
          </p>
          {message && (
            <Alert variant="destructive">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
          <Button className="w-full" disabled={loading} onClick={() => void confirmar()}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Confirmando…</> : 'Confirmar acceso'}
          </Button>
          <Link to="/login" className="inline-block text-sm text-primary underline">
            Volver al inicio de sesión
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
