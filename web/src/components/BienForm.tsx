import type { FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2, Database, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { cn } from '../lib/utils'
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
import { Switch } from './ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from './ui/alert-dialog'
import type { BienDetalle } from '../types'

const CHAIN_KEY = 'inv:bien_form_chain'
const DRAFT_PREFIX = 'inv:bien_draft:'

type DraftPayload = {
  nombre: string
  estado: string
  idTrabajador: number | null
  idUbicacion: number | null
  marca: string
  modelo: string
  serie: string
  ordenCompra: string
  valor: string
  savedAt: number
}

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

  // Defaults heredados del modo "Seguir registrando"
  const chainTrabajador = searchParams.get('chain_trabajador')
  const chainUbicacion = searchParams.get('chain_ubicacion')
  const chainEstado = searchParams.get('chain_estado')
  const initialTrabajador = chainTrabajador ? Number(chainTrabajador) : null
  const initialUbicacion = chainUbicacion ? Number(chainUbicacion) : null
  const initialEstado = chainEstado && (ESTADOS as readonly string[]).includes(chainEstado)
    ? chainEstado
    : ESTADOS[0]

  const [codigo, setCodigo] = useState(initialCodigo ?? codigoFromQuery)
  const [nombre, setNombre] = useState(sigaDescripcion)
  const [tipo, setTipo] = useState('')
  const [estado, setEstado] = useState<string>(initialEstado)
  const [idTrabajador, setIdTrabajador] = useState<number | null>(initialTrabajador)
  const [idUbicacion, setIdUbicacion] = useState<number | null>(initialUbicacion)
  const [marca, setMarca] = useState(sigaMarca)
  const [modelo, setModelo] = useState(sigaModelo)
  const [serie, setSerie] = useState(sigaSerie)
  const [ordenCompra, setOrdenCompra] = useState(sigaOC)
  const [valor, setValor] = useState(sigaValor)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)
  const [sigaOpen, setSigaOpen] = useState(() => tieneSiga || modo === 'edit')
  const [chainMode, setChainMode] = useState<boolean>(() => {
    try { return localStorage.getItem(CHAIN_KEY) === 'true' } catch { return false }
  })
  const [draftAvailable, setDraftAvailable] = useState<DraftPayload | null>(null)

  // Ref para debounce del lookup SIGA por código patrimonial
  const sigaLookupRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Ref para debounce del autoguardado de draft
  const draftSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Marca para evitar persistir draft tras restaurar/descartar/guardar
  const draftSuppressRef = useRef(false)

  // Persistir preferencia de "Seguir registrando"
  useEffect(() => {
    try { localStorage.setItem(CHAIN_KEY, String(chainMode)) } catch { /* noop */ }
  }, [chainMode])

  // Cargar bien en modo edit
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

  // Detectar draft existente al montar create-mode con código en query
  useEffect(() => {
    if (modo !== 'create') return
    const trimmed = codigo.trim()
    if (!trimmed) return
    try {
      const raw = localStorage.getItem(DRAFT_PREFIX + trimmed)
      if (!raw) return
      const parsed = JSON.parse(raw) as DraftPayload
      if (parsed && typeof parsed === 'object') setDraftAvailable(parsed)
    } catch { /* noop */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo])

  // Autoguardado de draft (debounce 500ms) — solo create-mode con código presente
  useEffect(() => {
    if (modo !== 'create') return
    if (draftSuppressRef.current) return
    const trimmed = codigo.trim()
    if (!trimmed) return
    if (draftSaveRef.current) clearTimeout(draftSaveRef.current)
    draftSaveRef.current = setTimeout(() => {
      const payload: DraftPayload = {
        nombre, estado, idTrabajador, idUbicacion,
        marca, modelo, serie, ordenCompra, valor,
        savedAt: Date.now(),
      }
      try { localStorage.setItem(DRAFT_PREFIX + trimmed, JSON.stringify(payload)) } catch { /* noop */ }
    }, 500)
    return () => { if (draftSaveRef.current) clearTimeout(draftSaveRef.current) }
  }, [modo, codigo, nombre, estado, idTrabajador, idUbicacion, marca, modelo, serie, ordenCompra, valor])

  const restoreDraft = (d: DraftPayload) => {
    setNombre(d.nombre || '')
    setEstado(d.estado || ESTADOS[0])
    setIdTrabajador(d.idTrabajador ?? null)
    setIdUbicacion(d.idUbicacion ?? null)
    setMarca(d.marca || '')
    setModelo(d.modelo || '')
    setSerie(d.serie || '')
    setOrdenCompra(d.ordenCompra || '')
    setValor(d.valor || '')
    setDraftAvailable(null)
  }

  const discardDraft = () => {
    const trimmed = codigo.trim()
    if (trimmed) {
      try { localStorage.removeItem(DRAFT_PREFIX + trimmed) } catch { /* noop */ }
    }
    setDraftAvailable(null)
  }

  // Lookup SIGA por código patrimonial exacto (solo en modo create, silencioso)
  useEffect(() => {
    if (modo !== 'create') return
    const trimmed = codigo.trim()

    if (sigaLookupRef.current) clearTimeout(sigaLookupRef.current)
    if (!trimmed) return

    sigaLookupRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('siga_bienes')
        .select('descripcion, marca, modelo, serie, orden_compra, valor')
        .eq('codigo_patrimonial', trimmed)
        .maybeSingle()

      if (!data) return
      // Solo rellenar campos vacíos para no pisar lo que el usuario ya escribió
      if (!marca && data.marca) setMarca(data.marca)
      if (!modelo && data.modelo) setModelo(data.modelo)
      if (!serie && data.serie) setSerie(data.serie)
      if (!ordenCompra && data.orden_compra) setOrdenCompra(data.orden_compra)
      if (!valor && data.valor != null) setValor(String(data.valor))
    }, 500)

    return () => { if (sigaLookupRef.current) clearTimeout(sigaLookupRef.current) }
  }, [codigo, modo]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleNombreSelect = (row: SigaSugerencia) => {
    setNombre(row.descripcion)
    if (!marca && row.marca) setMarca(row.marca)
    if (!modelo && row.modelo) setModelo(row.modelo)
    if (!serie && row.serie) setSerie(row.serie)
    if (!ordenCompra && row.orden_compra) setOrdenCompra(row.orden_compra)
    if (!valor && row.valor != null) setValor(String(row.valor))
  }

  const runValidation = (): boolean => {
    setError(null)
    if (!codigo.trim()) { setError('El código patrimonial es obligatorio.'); return false }
    if (!nombre.trim()) { setError('El nombre o modelo del bien es obligatorio.'); return false }
    if (!idTrabajador) { setError('Debes seleccionar un responsable.'); return false }
    return true
  }

  const executeSubmit = async () => {
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

      // Limpiar draft del código recién guardado
      draftSuppressRef.current = true
      try { localStorage.removeItem(DRAFT_PREFIX + codigo.trim()) } catch { /* noop */ }

      if (chainMode) {
        // Continuar registrando: persistir defaults y volver al escaneo
        try {
          sessionStorage.setItem('inv:chain_defaults', JSON.stringify({
            id_trabajador: idTrabajador,
            id_ubicacion: idUbicacion,
            estado,
          }))
        } catch { /* noop */ }
        toast.success('Bien guardado · Continúa con el siguiente', {
          action: { label: 'Ver detalle', onClick: () => navigate(`/bienes/${nuevoId}`) },
        })
        navigate('/scan?continuar=1', { replace: true })
        return
      }

      toast.success('Bien registrado correctamente')
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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!runValidation()) return

    if (modo === 'edit') {
      setShowSaveConfirm(true)
      return
    }

    await executeSubmit()
  }

  const formatDraftAge = (ms: number): string => {
    const diff = Date.now() - ms
    if (diff < 60_000) return 'hace unos segundos'
    if (diff < 3_600_000) return `hace ${Math.round(diff / 60_000)} min`
    if (diff < 86_400_000) return `hace ${Math.round(diff / 3_600_000)} h`
    return `hace ${Math.round(diff / 86_400_000)} d`
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5 pb-24 lg:pb-0">
        {modo === 'create' && draftAvailable && (
          <Alert>
            <AlertDescription className="flex flex-wrap items-center gap-3">
              <span className="text-sm">
                Tienes un borrador para <strong>{codigo.trim()}</strong> ({formatDraftAge(draftAvailable.savedAt)}).
              </span>
              <div className="flex gap-2 ml-auto">
                <Button type="button" size="sm" onClick={() => restoreDraft(draftAvailable)}>
                  Restaurar
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={discardDraft}>
                  Descartar
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
        {/* Fila 1: Código + Estado (2 columnas en desktop) */}
        <div className="grid gap-4 md:grid-cols-2">
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
        </div>

        {/* Fila 2: Nombre (ancho completo) */}
        <NombreSearchableInput
          value={nombre}
          onChange={setNombre}
          onSelect={handleNombreSelect}
        />

        {/* Fila 3: Responsable + Ubicación (2 columnas en desktop) */}
        <div className="grid gap-4 md:grid-cols-2">
          <TrabajadorSearchableSelect
            value={idTrabajador}
            onChange={(v) => setIdTrabajador(v === '' || v === null ? null : v)}
            label="Responsable *"
          />
          <UbicacionSelect value={idUbicacion} onChange={setIdUbicacion} />
        </div>

        {/* Fila 4: Datos SIGA — colapsable en móvil, siempre visible en desktop */}
        <div className="rounded-xl border border-border">
          <button
            type="button"
            className="flex w-full items-center gap-2 p-4 text-sm font-semibold text-foreground"
            onClick={() => setSigaOpen((v) => !v)}
          >
            <Database className="h-4 w-4 text-muted-foreground" />
            Datos del bien (SIGA)
            {tieneSiga && modo === 'create' && (
              <Badge variant="warning" className="ml-1">Desde SIGA</Badge>
            )}
            <ChevronDown
              className={cn(
                'ml-auto h-4 w-4 text-muted-foreground transition-transform lg:hidden',
                sigaOpen ? 'rotate-180' : 'rotate-0',
              )}
            />
          </button>
          <div className={cn('px-4 pb-4', sigaOpen ? 'block' : 'hidden', 'lg:block')}>
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
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className={cn(
          'fixed bottom-0 left-0 right-0 z-30 -mx-0 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]',
          'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 border-t border-border space-y-2',
          'lg:static lg:bg-transparent lg:border-0 lg:p-0 lg:m-0 lg:backdrop-blur-none',
        )}>
          {modo === 'create' && (
            <label className="flex items-center justify-between gap-3 text-sm cursor-pointer lg:max-w-md lg:mx-auto">
              <span className="flex flex-col">
                <span className="font-medium text-foreground">Seguir registrando</span>
                <span className="text-xs text-muted-foreground">
                  Mantiene responsable, ubicación y estado para el siguiente bien
                </span>
              </span>
              <Switch
                checked={chainMode}
                onCheckedChange={setChainMode}
                aria-label="Seguir registrando"
              />
            </label>
          )}
          <Button type="submit" disabled={loading} className="w-full min-h-11">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando…
              </>
            ) : (
              modo === 'create' ? 'Registrar bien' : 'Guardar cambios'
            )}
          </Button>
        </div>
      </form>

      {/* AlertDialog de confirmación — solo en modo edit */}
      <AlertDialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Guardar cambios?</AlertDialogTitle>
            <AlertDialogDescription>
              Se actualizarán los datos del bien en el inventario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowSaveConfirm(false); void executeSubmit() }}>
              Sí, guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
