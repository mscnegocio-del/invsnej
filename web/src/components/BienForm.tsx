import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { TrabajadorSearchableSelect } from './TrabajadorSearchableSelect'
import { UbicacionSelect } from './UbicacionSelect'
import { useCatalogs } from '../context/CatalogContext'
import { useSede } from '../context/SedeContext'
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
  const { sedeActiva } = useSede()

  const codigoFromQuery = searchParams.get('codigo') ?? ''

  // Datos pre-cargados desde SIGA (via query params)
  const sigaMarca = searchParams.get('siga_marca') ?? ''
  const sigaModelo = searchParams.get('siga_modelo') ?? ''
  const sigaSerie = searchParams.get('siga_serie') ?? ''
  const sigaOC = searchParams.get('siga_oc') ?? ''
  const sigaValor = searchParams.get('siga_valor') ?? ''
  const sigaDescripcion = searchParams.get('siga_descripcion') ?? ''
  const tieneSiga = !!(sigaMarca || sigaModelo || sigaSerie || sigaOC || sigaValor)

  const [codigo, setCodigo] = useState(initialCodigo ?? codigoFromQuery)
  const [nombre, setNombre] = useState(sigaDescripcion)
  const [tipo, setTipo] = useState('')
  const [estado, setEstado] = useState<string>(ESTADOS[0])
  const [idTrabajador, setIdTrabajador] = useState<number | null>(null)
  const [idUbicacion, setIdUbicacion] = useState<number | null>(null)
  // Campos SIGA
  const [marca, setMarca] = useState(sigaMarca)
  const [modelo, setModelo] = useState(sigaModelo)
  const [serie, setSerie] = useState(sigaSerie)
  const [ordenCompra, setOrdenCompra] = useState(sigaOC)
  const [valor, setValor] = useState(sigaValor)
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
          'id, codigo_patrimonial, nombre_mueble_equipo, tipo_mueble_equipo, estado, id_trabajador, ubicacion, marca, modelo, serie, orden_compra, valor',
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
      // Campos SIGA
      setMarca(raw.marca ?? '')
      setModelo(raw.modelo ?? '')
      setSerie(raw.serie ?? '')
      setOrdenCompra(raw.orden_compra ?? '')
      setValor(raw.valor != null ? String(raw.valor) : '')
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

    const valorNum = valor.trim() ? parseFloat(valor.replace(',', '.')) : null

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
          sede_id: sedeActiva?.id ?? null,
          marca: marca.trim() || null,
          modelo: modelo.trim() || null,
          serie: serie.trim() || null,
          orden_compra: ordenCompra.trim() || null,
          valor: valorNum != null && !Number.isNaN(valorNum) ? valorNum : null,
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
          marca: marca.trim() || null,
          modelo: modelo.trim() || null,
          serie: serie.trim() || null,
          orden_compra: ordenCompra.trim() || null,
          valor: valorNum != null && !Number.isNaN(valorNum) ? valorNum : null,
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

      {/* Sección datos SIGA */}
      <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4">
        <legend className="flex items-center gap-2 px-1 text-sm font-semibold text-slate-700">
          Datos del bien (SIGA)
          {tieneSiga && modo === 'create' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              🔍 Desde SIGA
            </span>
          )}
        </legend>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="form-marca">Marca</label>
            <input
              id="form-marca"
              type="text"
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              placeholder="Ej. HP, Dell, Lenovo"
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="form-modelo">Modelo</label>
            <input
              id="form-modelo"
              type="text"
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              placeholder="Ej. ProBook 440 G8"
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="form-serie">N° Serie</label>
            <input
              id="form-serie"
              type="text"
              value={serie}
              onChange={(e) => setSerie(e.target.value)}
              placeholder="Número de serie"
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="form-oc">Orden de compra</label>
            <input
              id="form-oc"
              type="text"
              value={ordenCompra}
              onChange={(e) => setOrdenCompra(e.target.value)}
              placeholder="Ej. OC-2023-001"
              className="input"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="form-valor">Valor (S/.)</label>
            <input
              id="form-valor"
              type="number"
              step="0.01"
              min="0"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="Ej. 3500.00"
              className="input"
            />
          </div>
        </div>
      </fieldset>

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
