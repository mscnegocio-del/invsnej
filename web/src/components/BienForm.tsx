import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { TrabajadorSearchableSelect } from './TrabajadorSearchableSelect'
import { UbicacionSelect } from './UbicacionSelect'
import { useCatalogs } from '../context/CatalogContext'
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
  const { ubicaciones } = useCatalogs()

  const codigoFromQuery = searchParams.get('codigo') ?? ''

  const [codigo, setCodigo] = useState(initialCodigo ?? codigoFromQuery)
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState('')
  const [estado, setEstado] = useState<string>(ESTADOS[0])
  const [idTrabajador, setIdTrabajador] = useState<number | null>(null)
  const [idUbicacion, setIdUbicacion] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      if (raw.ubicacion) {
        const asNumber = Number(raw.ubicacion)
        if (!Number.isNaN(asNumber)) {
          setIdUbicacion(asNumber)
        } else {
          const byName = ubicaciones.find((u) => u.nombre === raw.ubicacion)
          setIdUbicacion(byName?.id ?? null)
        }
      } else {
        setIdUbicacion(null)
      }
      setLoading(false)
    }

    loadBien()

    return () => {
      cancelled = true
    }
  }, [modo, bienId, ubicaciones])

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

    const ubicacionNombre = idUbicacion
      ? (ubicaciones.find((u) => u.id === idUbicacion)?.nombre ?? null)
      : null

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
          ubicacion: ubicacionNombre,
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
          codigo_patrimonial: codigo.trim(),
          nombre_mueble_equipo: nombre.trim(),
          tipo_mueble_equipo: tipo.trim() || null,
          estado,
          id_trabajador: idTrabajador,
          ubicacion: ubicacionNombre,
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
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="label" htmlFor="form-codigo">Código patrimonial *</label>
        <input
          id="form-codigo"
          type="text"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="Código leído del código de barras"
          className="input"
        />
      </div>

      <div>
        <label className="label" htmlFor="form-nombre">Nombre / modelo del bien *</label>
        <input
          id="form-nombre"
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej. Escritorio de oficina, Laptop Dell..."
          className="input"
        />
      </div>

      <div>
        <label className="label" htmlFor="form-tipo">Tipo de mueble o equipo</label>
        <input
          id="form-tipo"
          type="text"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          placeholder="Ej. Mueble, Equipo de cómputo, Silla..."
          className="input"
        />
      </div>

      <div>
        <label className="label" htmlFor="form-estado">Estado *</label>
        <select
          id="form-estado"
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="input"
        >
          {ESTADOS.map((op) => (
            <option key={op} value={op}>
              {op}
            </option>
          ))}
        </select>
      </div>

      <TrabajadorSearchableSelect
        value={idTrabajador}
        onChange={(v) => setIdTrabajador(v === '' || v === null ? null : v)}
        label="Responsable *"
      />
      <UbicacionSelect value={idUbicacion} onChange={setIdUbicacion} />

      {error && (
        <p className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
        </p>
      )}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? (
          <>
            <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Guardando...
          </>
        ) : (
          modo === 'create' ? 'Registrar bien' : 'Guardar cambios'
        )}
      </button>
    </form>
  )
}
