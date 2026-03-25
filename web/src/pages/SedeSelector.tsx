import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useSede } from '../context/SedeContext'
import type { Sede } from '../types'

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
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <section className="w-full max-w-md card p-6">
        <h1 className="text-xl font-bold text-slate-900">Selecciona tu sede</h1>
        <p className="mt-2 text-sm text-slate-600">
          Debes elegir una sede para continuar con el inventario.
        </p>

        {loading && (
          <p className="mt-4 flex items-center gap-2 text-slate-600">
            <span className="size-4 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
            Cargando sedes...
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</p>
        )}

        {!loading && !error && (
          <div className="mt-4 space-y-2">
            {sedes.map((sede) => (
              <button
                key={sede.id}
                type="button"
                className="w-full text-left rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-teal-300 hover:bg-teal-50/30"
                onClick={() => cambiarSede(sede)}
              >
                <p className="font-medium text-slate-900">{sede.nombre}</p>
                {sede.codigo && <p className="text-xs text-slate-500 mt-0.5">{sede.codigo}</p>}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
