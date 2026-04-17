import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, Database } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { TrabajadorSearchableSelect } from './TrabajadorSearchableSelect'
import { UbicacionSelect } from './UbicacionSelect'
import { NombreSearchableInput } from './NombreSearchableInput'
import type { SigaSugerencia } from './NombreSearchableInput'
import { useCatalogs } from '../context/CatalogContext'
import { useSede } from '../context/SedeContext'
import { useAuth } from '../context/AuthContext'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Alert, AlertDescription } from './ui/alert'
import { Badge } from './ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
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
  const { ubicaciones, trabajadores } = useCatalogs()
  const { sedeActiva } = useSede()
  const { user } = useAuth()

  const codigoFromQuery = searchParams.get('codigo') ?? ''
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
        .is('eliminado_at', null)
        .maybeSingle()

      if (cancelled) return

      if (supaError || !data) {
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
      setMarca(raw.marca ?? '')
      setModelo(raw.modelo ?? '')
      setSerie(raw.serie ?? '')
      setOrdenCompra(raw.orden_compra ?? '')
      setValor(raw.valor != null ? String(raw.valor) : '')
      setLoading(false)
    }

    loadBien()
    return () => { cancelled = true }
  }, [modo, bienId, ubicaciones])

  const handleNombreSelect = (row: SigaSugerencia) => {
    setNombre(row.descripcion)
    if (!marca && row.marca) setMarca(row.marca)
    if (!modelo && row.modelo) setModelo(row.modelo)
    if (!serie && row.serie) setSerie(row.serie)
    if (!ordenCompra && row.orden_compra) setOrdenCompra(row.orden_compra)
    if (!valor && row.valor != null) setValor(String(row.valor))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!codigo.trim()) { setError('El código patrimonial es obligatorio.'); return }
    if (!nombre.trim()) { setError('El nombre o modelo del bien es obligatorio.'); return }
    if (!idTrabajador) { setError('Debes seleccionar un responsable.'); return }

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
          creado_por: user?.id ?? null,
          creado_por_email: user?.email ?? null,
        })
        .select('id')
        .maybeSingle()

      setLoading(false)

      if (supaError) { setError('No se pudo registrar el bien. Intenta nuevamente.'); return }
      if (!data) { setError('No se recibió respuesta del servidor al registrar el bien.'); return }

      const nuevoId = data.id as number
      await supabase.from('bien_historial').insert({
        bien_id: nuevoId, campo: 'creacion', valor_antes: null,
        valor_despues: nombre.trim(), usuario_id: user?.id ?? null,
        usuario_email: user?.email ?? null, accion: 'creacion',
      })
      navigate(`/bienes/${nuevoId}`, { replace: true })
    } else {
      const { data: anterior } = await supabase
        .from('bienes')
        .select('estado, id_trabajador, ubicacion')
        .eq('id', bienId)
        .maybeSingle()

      const { error: supaError } = await supabase
        .from('bienes')
        .update({
          codigo_patrimonial: codigo.trim(),
          nombre_mueble_equipo: nombre.trim(),
          tipo_mueble_equipo: tipo.trim() || null,
          estado, id_trabajador: idTrabajador, ubicacion: ubicacionNombre,
          marca: marca.trim() || null, modelo: modelo.trim() || null,
          serie: serie.trim() || null, orden_compra: ordenCompra.trim() || null,
          valor: valorNum != null && !Number.isNaN(valorNum) ? valorNum : null,
        })
        .eq('id', bienId)

      setLoading(false)
      if (supaError) { setError('No se pudo actualizar el bien. Intenta nuevamente.'); return }

      if (anterior && bienId) {
        const prev = anterior as { estado: string; id_trabajador: number | null; ubicacion: string | null }
        const resolveUbicacion = (val: string | null): string | null => {
          if (!val) return null
          const asNum = Number(val)
          return !Number.isNaN(asNum) ? (ubicaciones.find((u) => u.id === asNum)?.nombre ?? val) : val
        }
        const resolveTrabajador = (id: number | null): string | null =>
          id ? (trabajadores.find((t) => t.id === id)?.nombre ?? String(id)) : null

        type HistorialFila = { bien_id: number; campo: string; valor_antes: string | null; valor_despues: string | null; usuario_id: string | null; usuario_email: string | null; accion: 'edicion' }
        const uid = user?.id ?? null
        const uemail = user?.email ?? null
        const filas: HistorialFila[] = []
        if (prev.estado !== estado) filas.push({ bien_id: bienId, campo: 'estado', valor_antes: prev.estado ?? null, valor_despues: estado, usuario_id: uid, usuario_email: uemail, accion: 'edicion' })
        if (prev.id_trabajador !== idTrabajador) filas.push({ bien_id: bienId, campo: 'responsable', valor_antes: resolveTrabajador(prev.id_trabajador), valor_despues: resolveTrabajador(idTrabajador), usuario_id: uid, usuario_email: uemail, accion: 'edicion' })
        const ubicAntes = resolveUbicacion(prev.ubicacion)
        if (ubicAntes !== ubicacionNombre) filas.push({ bien_id: bienId, campo: 'ubicacion', valor_antes: ubicAntes, valor_despues: ubicacionNombre, usuario_id: uid, usuario_email: uemail, accion: 'edicion' })
        if (filas.length > 0) await supabase.from('bien_historial').insert(filas)
      }

      navigate(bienId ? `/bienes/${bienId}` : '/', { replace: true })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="form-codigo">Código patrimonial *</Label>
        <Input
          id="form-codigo"
          type="text"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="Código leído del código de barras"
        />
      </div>

      <NombreSearchableInput
        value={nombre}
        onChange={setNombre}
        onSelect={handleNombreSelect}
      />

      <div className="space-y-1.5">
        <Label htmlFor="form-estado">Estado *</Label>
        <Select value={estado} onValueChange={setEstado}>
          <SelectTrigger id="form-estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ESTADOS.map((op) => (
              <SelectItem key={op} value={op}>{op}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <TrabajadorSearchableSelect
        value={idTrabajador}
        onChange={(v) => setIdTrabajador(v === '' || v === null ? null : v)}
        label="Responsable *"
      />
      <UbicacionSelect value={idUbicacion} onChange={setIdUbicacion} />

      {/* Sección datos SIGA */}
      <fieldset className="space-y-3 rounded-xl border border-border p-4">
        <legend className="flex items-center gap-2 px-1 text-sm font-semibold text-foreground">
          <Database className="h-4 w-4 text-muted-foreground" />
          Datos del bien (SIGA)
          {tieneSiga && modo === 'create' && (
            <Badge variant="warning" className="ml-1">Desde SIGA</Badge>
          )}
        </legend>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="form-marca">Marca</Label>
            <Input id="form-marca" type="text" value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Ej. HP, Dell, Lenovo" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="form-modelo">Modelo</Label>
            <Input id="form-modelo" type="text" value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Ej. ProBook 440 G8" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="form-serie">N° Serie</Label>
            <Input id="form-serie" type="text" value={serie} onChange={(e) => setSerie(e.target.value)} placeholder="Número de serie" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="form-oc">Orden de compra</Label>
            <Input id="form-oc" type="text" value={ordenCompra} onChange={(e) => setOrdenCompra(e.target.value)} placeholder="Ej. OC-2023-001" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="form-valor">Valor (S/.)</Label>
            <Input id="form-valor" type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ej. 3500.00" />
          </div>
        </div>
      </fieldset>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Guardando…
          </>
        ) : (
          modo === 'create' ? 'Registrar bien' : 'Guardar cambios'
        )}
      </Button>
    </form>
  )
}
