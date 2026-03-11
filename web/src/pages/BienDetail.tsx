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

      const raw = data as any
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
    <main style={{ padding: '1.5rem' }}>
      <h1>Detalle de bien</h1>

      {loading && <p>Cargando información del bien...</p>}

      {error && !loading && (
        <p style={{ color: 'red' }}>
          {error}
        </p>
      )}

      {bien && !loading && !error && (
        <section style={{ marginTop: '1rem' }}>
          <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '0.5rem 1rem' }}>
            <div>
              <dt style={{ fontWeight: 600 }}>Código patrimonial</dt>
              <dd>{bien.codigo_patrimonial}</dd>
            </div>
            <div>
              <dt style={{ fontWeight: 600 }}>Nombre / modelo</dt>
              <dd>{bien.nombre_mueble_equipo}</dd>
            </div>
            <div>
              <dt style={{ fontWeight: 600 }}>Tipo</dt>
              <dd>{bien.tipo_mueble_equipo || '—'}</dd>
            </div>
            <div>
              <dt style={{ fontWeight: 600 }}>Estado</dt>
              <dd>{bien.estado}</dd>
            </div>
            <div>
              <dt style={{ fontWeight: 600 }}>Responsable</dt>
              <dd>{bien.trabajador_nombre || 'Sin responsable asignado'}</dd>
            </div>
            <div>
              <dt style={{ fontWeight: 600 }}>Ubicación</dt>
              <dd>{bien.ubicacion || 'Sin ubicación registrada'}</dd>
            </div>
            <div>
              <dt style={{ fontWeight: 600 }}>Fecha de registro</dt>
              <dd>{bien.fecha_registro ? new Date(bien.fecha_registro).toLocaleString() : '—'}</dd>
            </div>
          </dl>

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => navigate(`/bienes/${bien.id}/editar`)}
              style={{ padding: '0.5rem 1rem' }}
            >
              Editar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              style={{ padding: '0.5rem 1rem', backgroundColor: '#fee2e2' }}
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </section>
      )}
    </main>
  )
}

