import { useEffect, useState } from 'react'
import { Loader2, MapPin } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useSede } from '../context/SedeContext'
import type { Sede } from '../types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Button } from '../components/ui/button'

export function SedeSelector() {
  const { cambiarSede } = useSede()
  const [sedes, setSedes] = useState<Sede[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadSedes() {
      setLoading(true)
      setError(null)
      const { data, error: supaError } = await supabase
        .from('sedes')
        .select('id, nombre, codigo')
        .order('nombre', { ascending: true })
      if (cancelled) return
      if (supaError) {
        console.error(supaError)
        setError('No se pudo cargar la lista de sedes.')
        setLoading(false)
        return
      }
      setSedes((data ?? []) as Sede[])
      setLoading(false)
    }

    loadSedes()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Selecciona tu sede
          </CardTitle>
          <CardDescription>
            Debes elegir una sede para continuar con el inventario.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Cargando sedes…</span>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!loading && !error && sedes.map((sede) => (
            <Button
              key={sede.id}
              type="button"
              variant="outline"
              className="w-full h-auto justify-start flex-col items-start gap-0.5 px-4 py-3 hover:border-primary/40 hover:bg-primary/5"
              onClick={() => cambiarSede(sede)}
            >
              <span className="font-medium">{sede.nombre}</span>
              {sede.codigo && <span className="text-xs text-muted-foreground font-normal">{sede.codigo}</span>}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
