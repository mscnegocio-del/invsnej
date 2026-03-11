import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { TrabajadorSelect } from './TrabajadorSelect'
import { UbicacionSelect } from './UbicacionSelect'
import type { BienDetalle } from '../types'

type Props = {
  initialCodigo?: string
  modo?: 'create' | 'edit'
  bienId?: number
}

const ESTADOS = ['Nuevo', 'Bueno', 'Regular', 'Malo', 'Muy malo'] as const

export function BienForm({ initialCodigo, modo = 'create', bienId }: Props) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const codigoFromQuery = searchParams.get('codigo') ?? ''

  const [codigo, setCodigo] = useState(initialCodigo ?? codigoFromQuery)
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState('')
  const [estado, setEstado] = useState<string>(ESTADOS[0])
  const [idTrabajador, setIdTrabajador] = useState<number | null>(null)
  const [idUbicacion, setIdUbicacion] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cargar datos iniciales en modo edición
  useEffect(() => {
    if (modo !== 'edit' || !bienId) return

    let cancelled = false

    async function loadBien() {
      setLoading(true)
      setError(null)

      const { data, error: supaError } = await supabase
        .from('bienes')
        .select(
          'id, codigo_patrimonial, nombre_mueble_equipo, tipo_mueble_equipo, estado, id_trabajador, ubicacion',
        )
        .eq('id', bienId)
        .maybeSingle()

      if (cancelled) return

      if (supaError || !data) {
        console.error(supaError)
        setError('No se pudo cargar la información inicial del bien para editar.')
        setLoading(false)
        return
      }

      const raw = data as unknown as BienDetalle
      setCodigo(raw.codigo_patrimonial)
      setNombre(raw.nombre_mueble_equipo)
      setTipo(raw.tipo_mueble_equipo ?? '')
      setEstado(raw.estado)
      setIdTrabajador(raw.id_trabajador)
      // En la BD ubicacion es texto; aquí asumimos que se migrará a FK en el futuro.
      setIdUbicacion(null)
      setLoading(false)
    }

    loadBien()

    return () => {
      cancelled = true
    }
  }, [modo, bienId])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!codigo.trim()) {
      setError('El código patrimonial es obligatorio.')
      return
    }
    if (!nombre.trim()) {
      setError('El nombre o modelo del bien es obligatorio.')
      return
    }
    if (!idTrabajador) {
      setError('Debes seleccionar un responsable.')
      return
    }

    setLoading(true)

    if (modo === 'create') {
      const { data, error: supaError } = await supabase
        .from('bienes')
        .insert({
          codigo_patrimonial: codigo.trim(),
          nombre_mueble_equipo: nombre.trim(),
          tipo_mueble_equipo: tipo.trim() || null,
          estado,
          id_trabajador: idTrabajador,
          ubicacion: idUbicacion ?? null,
        })
        .select('id')
        .maybeSingle()

      setLoading(false)

      if (supaError) {
        console.error(supaError)
        setError('No se pudo registrar el bien. Intenta nuevamente.')
        return
      }

      if (!data) {
        setError('No se recibió respuesta del servidor al registrar el bien.')
        return
      }

      const nuevoId = data.id as number
      navigate(`/bienes/${nuevoId}`, { replace: true })
    } else {
      const { error: supaError } = await supabase
        .from('bienes')
        .update({
          // Normalmente no se debería cambiar el código; aquí lo permitimos para flexibilidad.
          codigo_patrimonial: codigo.trim(),
          nombre_mueble_equipo: nombre.trim(),
          tipo_mueble_equipo: tipo.trim() || null,
          estado,
          id_trabajador: idTrabajador,
          ubicacion: idUbicacion ?? null,
        })
        .eq('id', bienId)

      setLoading(false)

      if (supaError) {
        console.error(supaError)
        setError('No se pudo actualizar el bien. Intenta nuevamente.')
        return
      }

      if (bienId) {
        navigate(`/bienes/${bienId}`, { replace: true })
      } else {
        navigate('/', { replace: true })
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label>
          Código patrimonial *
          <input
            type="text"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Código leído del código de barras"
          />
        </label>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label>
          Nombre / modelo del bien *
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Escritorio de oficina, Laptop Dell..."
          />
        </label>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label>
          Tipo de mueble o equipo
          <input
            type="text"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            placeholder="Ej. Mueble, Equipo de cómputo, Silla..."
          />
        </label>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label>
          Estado *
          <select value={estado} onChange={(e) => setEstado(e.target.value)}>
            {ESTADOS.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
        </label>
      </div>

      <TrabajadorSelect value={idTrabajador} onChange={setIdTrabajador} required />
      <UbicacionSelect value={idUbicacion} onChange={setIdUbicacion} />

      {error && (
        <p style={{ color: 'red' }}>
          {error}
        </p>
      )}

      <button type="submit" disabled={loading} style={{ padding: '0.75rem 1rem' }}>
        {loading ? 'Guardando...' : modo === 'create' ? 'Registrar bien' : 'Guardar cambios'}
      </button>
    </form>
  )
}

