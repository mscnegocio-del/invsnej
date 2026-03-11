import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { BienDetalle } from '../types'

export function BienDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [bien, setBien] = useState<BienDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!id) return

    let cancelled = false

    async function fetchBien() {
      setLoading(true)
      setError(null)

      const { data, error: supaError } = await supabase
        .from('bienes')
        .select('id, codigo_patrimonial, nombre_mueble_equipo, tipo_mueble_equipo, estado, id_trabajador, ubicacion, fecha_registro')
        .eq('id', id)
        .maybeSingle()

      if (cancelled) return

      if (supaError) {
        console.error(supaError)
        setError('No se pudo cargar la información del bien.')
        setLoading(false)
        return
      }

      if (!data) {
        setError('No se encontró el bien solicitado.')
        setLoading(false)
        return
      }

      const raw = data as { id: number; codigo_patrimonial: string; nombre_mueble_equipo: string; tipo_mueble_equipo: string | null; estado: string; id_trabajador: number | null; ubicacion: string | null; fecha_registro: string | null }
      let trabajadorNombre: string | null = null

      if (raw.id_trabajador) {
        const { data: trabajador, error: trabajadorError } = await supabase
          .from('trabajadores')
          .select('nombre')
          .eq('id', raw.id_trabajador)
          .maybeSingle()

        if (!cancelled && !trabajadorError && trabajador) {
          trabajadorNombre = trabajador.nombre as string
        }
      }

      if (cancelled) return

      const detalle: BienDetalle = {
        id: raw.id,
        codigo_patrimonial: raw.codigo_patrimonial,
        nombre_mueble_equipo: raw.nombre_mueble_equipo,
        tipo_mueble_equipo: raw.tipo_mueble_equipo,
        estado: raw.estado,
        id_trabajador: raw.id_trabajador,
        ubicacion: raw.ubicacion,
        fecha_registro: raw.fecha_registro,
        trabajador_nombre: trabajadorNombre,
      }

      setBien(detalle)
      setLoading(false)
    }

    fetchBien()

    return () => {
      cancelled = true
    }
  }, [id])

  const handleDelete = async () => {
    if (!id || !bien) return

    const confirmar = window.confirm(
      `¿Seguro que deseas eliminar el bien con código ${bien.codigo_patrimonial}? Esta acción no se puede deshacer.`,
    )
    if (!confirmar) return

    setDeleting(true)
    const { error: supaError } = await supabase.from('bienes').delete().eq('id', id)
    setDeleting(false)

    if (supaError) {
      console.error(supaError)
      setError('No se pudo eliminar el bien. Intenta nuevamente.')
      return
    }

    navigate('/', { replace: true })
  }

  return (
    <div>
      <h1 className="page-title">Detalle de bien</h1>

      {loading && (
        <p className="mt-6 flex items-center gap-2 text-slate-600">
          <span className="size-4 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
          Cargando información del bien...
        </p>
      )}

      {error && !loading && (
        <p className="mt-6 rounded-xl bg-red-50 text-red-700 px-4 py-3">
          {error}
        </p>
      )}

      {bien && !loading && !error && (
        <div className="mt-6 card overflow-hidden">
          <dl className="divide-y divide-slate-100">
            {[
              { term: 'Código patrimonial', value: bien.codigo_patrimonial },
              { term: 'Nombre / modelo', value: bien.nombre_mueble_equipo },
              { term: 'Tipo', value: bien.tipo_mueble_equipo || '—' },
              { term: 'Estado', value: bien.estado },
              { term: 'Responsable', value: bien.trabajador_nombre || 'Sin responsable asignado' },
              { term: 'Ubicación', value: bien.ubicacion || 'Sin ubicación registrada' },
              { term: 'Fecha de registro', value: bien.fecha_registro ? new Date(bien.fecha_registro).toLocaleString() : '—' },
            ].map(({ term, value }) => (
              <div key={term} className="px-6 py-4 sm:grid sm:grid-cols-2 sm:gap-4">
                <dt className="text-sm font-medium text-slate-500">{term}</dt>
                <dd className="mt-1 text-slate-900 sm:mt-0">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="px-6 py-4 bg-slate-50/50 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate(`/bienes/${bien.id}/editar`)}
              className="btn-primary"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="btn-danger"
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
