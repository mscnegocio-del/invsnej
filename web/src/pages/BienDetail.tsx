import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useCatalogs } from '../context/CatalogContext'
import type { BienDetalle, BienHistorial } from '../types'

export function BienDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { sedes, ubicaciones } = useCatalogs()
  const [bien, setBien] = useState<BienDetalle | null>(null)
  const [historial, setHistorial] = useState<BienHistorial[]>([])
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
        .select('id, codigo_patrimonial, nombre_mueble_equipo, tipo_mueble_equipo, estado, id_trabajador, ubicacion, fecha_registro, sede_id, marca, modelo, serie, orden_compra, valor')
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

      const raw = data as { id: number; codigo_patrimonial: string; nombre_mueble_equipo: string; tipo_mueble_equipo: string | null; estado: string; id_trabajador: number | null; ubicacion: string | null; fecha_registro: string | null; sede_id: number | null; marca: string | null; modelo: string | null; serie: string | null; orden_compra: string | null; valor: number | null }
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
        sede_id: raw.sede_id,
        marca: raw.marca,
        modelo: raw.modelo,
        serie: raw.serie,
        orden_compra: raw.orden_compra,
        valor: raw.valor,
      }

      setBien(detalle)

      // Cargar historial del bien
      const { data: historialData } = await supabase
        .from('bien_historial')
        .select('id, bien_id, campo, valor_antes, valor_despues, fecha')
        .eq('bien_id', raw.id)
        .order('fecha', { ascending: false })
        .limit(30)

      if (!cancelled) {
        setHistorial((historialData ?? []) as BienHistorial[])
      }

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

      {bien && !loading && !error && (() => {
        // Resolver sede a nombre
        const sedeNombre = bien.sede_id
          ? (sedes.find((s) => s.id === bien.sede_id)?.nombre ?? `Sede ${bien.sede_id}`)
          : null

        // Resolver ubicacion: puede ser un ID antiguo (número) o ya un nombre
        const ubicacionNombre = (() => {
          if (!bien.ubicacion) return null
          const asNum = Number(bien.ubicacion)
          if (!Number.isNaN(asNum)) {
            return ubicaciones.find((u) => u.id === asNum)?.nombre ?? bien.ubicacion
          }
          return bien.ubicacion
        })()

        return (
        <>
        <div className="mt-6 card overflow-hidden">
          <dl className="divide-y divide-slate-100">
            {[
              { term: 'Código patrimonial', value: bien.codigo_patrimonial },
              { term: 'Nombre / modelo', value: bien.nombre_mueble_equipo },
              { term: 'Tipo', value: bien.tipo_mueble_equipo || '—' },
              { term: 'Estado', value: bien.estado },
              { term: 'Responsable', value: bien.trabajador_nombre || 'Sin responsable asignado' },
              { term: 'Ubicación', value: ubicacionNombre || 'Sin ubicación registrada' },
              { term: 'Sede', value: sedeNombre || 'Sin sede asignada' },
              { term: 'Fecha de registro', value: bien.fecha_registro ? new Date(bien.fecha_registro).toLocaleString() : '—' },
            ].map(({ term, value }) => (
              <div key={term} className="px-6 py-4 sm:grid sm:grid-cols-2 sm:gap-4">
                <dt className="text-sm font-medium text-slate-500">{term}</dt>
                <dd className="mt-1 text-slate-900 sm:mt-0">{value}</dd>
              </div>
            ))}

            {/* Campos SIGA (solo si existen) */}
            {(bien.marca || bien.modelo || bien.serie || bien.orden_compra || bien.valor != null) && (
              <>
                <div className="px-6 py-3 bg-amber-50/60">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Datos SIGA PJ</p>
                </div>
                {[
                  { term: 'Marca', value: bien.marca },
                  { term: 'Modelo', value: bien.modelo },
                  { term: 'N° Serie', value: bien.serie },
                  { term: 'Orden de compra', value: bien.orden_compra },
                  { term: 'Valor', value: bien.valor != null ? `S/. ${bien.valor.toLocaleString()}` : null },
                ]
                  .filter(({ value }) => value != null)
                  .map(({ term, value }) => (
                    <div key={term} className="px-6 py-4 sm:grid sm:grid-cols-2 sm:gap-4">
                      <dt className="text-sm font-medium text-slate-500">{term}</dt>
                      <dd className="mt-1 text-slate-900 sm:mt-0">{value}</dd>
                    </div>
                  ))}
              </>
            )}
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

        {/* Historial de cambios */}
        {historial.length > 0 && (
          <div className="mt-6 card overflow-hidden">
            <div className="px-6 py-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                Historial de cambios
              </h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {historial.map((h) => {
                const etiquetaCampo: Record<string, string> = {
                  estado: 'Estado',
                  responsable: 'Responsable',
                  ubicacion: 'Ubicación',
                }
                const fecha = new Date(h.fecha).toLocaleString('es-PE', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
                return (
                  <li key={h.id} className="px-6 py-3 flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-4">
                    <span className="text-xs text-slate-400 shrink-0 w-36">{fecha}</span>
                    <span className="text-xs font-semibold text-slate-600 w-24 shrink-0">
                      {etiquetaCampo[h.campo] ?? h.campo}
                    </span>
                    <span className="text-sm text-slate-700">
                      <span className="text-slate-400">{h.valor_antes ?? '—'}</span>
                      <span className="mx-2 text-slate-300">→</span>
                      <span className="font-medium text-slate-900">{h.valor_despues ?? '—'}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
        </>
        )
      })()}
    </div>
  )
}
