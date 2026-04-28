import type { FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ScanLine, Copy, Check, FileJson, FileSpreadsheet, ChevronLeft, ChevronRight,
  Loader2, X, Search as SearchIcon, MoreHorizontal, Eye, Tag, User, MapPin,
  Filter, ChevronDown, ChevronUp, Share2, Star, Clock,
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { BarcodeScanModal } from '../components/BarcodeScanModal'
import { TrabajadorSearchableSelect } from '../components/TrabajadorSearchableSelect'
import { QuickEditBienDialog } from '../components/QuickEditBienDialog'
import { BulkEditBienDialog } from '../components/BulkEditBienDialog'
import { useCatalogs } from '../context/CatalogContext'
import { useSede } from '../context/SedeContext'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Skeleton } from '../components/ui/skeleton'
import { Separator } from '../components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../components/ui/dialog'
import { cn } from '../lib/utils'
import type { BienResumen } from '../types'

const PAGE_SIZE = 20
const NOMBRE_SUGGEST_DEBOUNCE_MS = 300
const NOMBRE_SUGGEST_MIN_CHARS = 2
const NOMBRE_SUGGEST_FETCH_LIMIT = 40
const NOMBRE_SUGGEST_SHOW = 18

const RECENT_KEY = 'inv:recent_searches'
const FAVS_KEY = 'inv:saved_views'
const RECENT_MAX = 5

type SavedView = { name: string; query: string }

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((s) => typeof s === 'string') : []
  } catch { return [] }
}

function saveRecent(list: string[]) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)) } catch { /* noop */ }
}

function loadSavedViews(): SavedView[] {
  try {
    const raw = localStorage.getItem(FAVS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((v) => v && typeof v.name === 'string' && typeof v.query === 'string') : []
  } catch { return [] }
}

function saveSavedViews(list: SavedView[]) {
  try { localStorage.setItem(FAVS_KEY, JSON.stringify(list)) } catch { /* noop */ }
}

function describeQuery(qs: string, trabajadores: { id: number; nombre: string }[] = []): string {
  const sp = new URLSearchParams(qs)
  const parts: string[] = []
  if (sp.get('codigo')) parts.push(`código=${sp.get('codigo')}`)
  const nombres = sp.get('nombres')
  if (nombres) parts.push(`nombres=${nombres.split('|').slice(0, 2).join(', ')}${nombres.split('|').length > 2 ? '…' : ''}`)
  if (sp.get('trabajador')) {
    const tId = Number(sp.get('trabajador'))
    const t = trabajadores.find((w) => w.id === tId)
    parts.push(t ? t.nombre : 'responsable')
  }
  if (sp.get('ubicacion')) parts.push(`ubic=${sp.get('ubicacion')}`)
  if (sp.get('marca')) parts.push(`marca=${sp.get('marca')}`)
  if (sp.get('modelo')) parts.push(`modelo=${sp.get('modelo')}`)
  if (sp.get('todas') === '1') parts.push('todas sedes')
  return parts.join(' · ') || 'búsqueda vacía'
}

function parseNombreTerminos(raw: string): string[] {
  return raw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean)
}

function escapeIlikeTerm(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function estadoBadgeVariant(estado: string): 'success' | 'warning' | 'destructive' | 'secondary' | 'default' {
  switch (estado) {
    case 'Nuevo': return 'success'
    case 'Bueno': return 'default'
    case 'Regular': return 'warning'
    case 'Malo': return 'destructive'
    case 'Muy malo': return 'destructive'
    default: return 'secondary'
  }
}

export function Search() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { trabajadores, ubicaciones, sedes } = useCatalogs()
  const { sedeActiva } = useSede()
  const { perfil } = useAuth()
  const role = perfil?.app_role ?? 'consulta'
  const canBulkEdit = role === 'admin' || role === 'operador'

  const initialLoadRef = useRef(true)
  const [pendingSearch, setPendingSearch] = useState(false)

  const [codigo, setCodigo] = useState('')
  const [idTrabajador, setIdTrabajador] = useState<number | ''>('')
  const [textoUbicacion, setTextoUbicacion] = useState('')
  const [textoMarca, setTextoMarca] = useState('')
  const [textoModelo, setTextoModelo] = useState('')
  const [nombreChips, setNombreChips] = useState<string[]>([])
  const [nombreDraft, setNombreDraft] = useState('')
  const [nombreSugerencias, setNombreSugerencias] = useState<string[]>([])
  const [nombreSuggestOpen, setNombreSuggestOpen] = useState(false)
  const [nombreSuggestLoading, setNombreSuggestLoading] = useState(false)
  const nombreSuggestReq = useRef(0)

  const [showScanModal, setShowScanModal] = useState(false)
  const [todasLasSedes, setTodasLasSedes] = useState(false)

  const [page, setPage] = useState(0)
  const [resultados, setResultados] = useState<BienResumen[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exportingAll, setExportingAll] = useState(false)
  const [copied, setCopied] = useState(false)

  type QuickEditTarget = {
    bien: BienResumen
    campo: 'estado' | 'responsable' | 'ubicacion'
  } | null
  const [quickEdit, setQuickEdit] = useState<QuickEditTarget>(null)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  // Recientes y favoritas
  const [recent, setRecent] = useState<string[]>(() => loadRecent())
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => loadSavedViews())
  const [showSaveViewDialog, setShowSaveViewDialog] = useState(false)
  const [saveViewName, setSaveViewName] = useState('')

  // Selección masiva
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkEdit, setBulkEdit] = useState<{ campo: 'estado' | 'responsable' | 'ubicacion'; targets: BienResumen[] } | null>(null)

  // Flag para diferenciar código escaneado (eq exacto) vs tipeado (ilike)
  const codigoFromScanRef = useRef(false)

  const findResponsableNombre = (idTrab: number | null) =>
    idTrab ? (trabajadores.find((tr) => tr.id === idTrab)?.nombre ?? null) : null

  const findUbicacionNombre = (ubicacionRaw: string | null) => {
    if (!ubicacionRaw) return null
    const asNumber = Number(ubicacionRaw)
    if (!Number.isNaN(asNumber)) return ubicaciones.find((u) => u.id === asNumber)?.nombre ?? ubicacionRaw
    return ubicacionRaw
  }

  const findSedeNombre = (sedeId: number | null | undefined) =>
    sedeId ? (sedes.find((s) => s.id === sedeId)?.nombre ?? `Sede ${sedeId}`) : null

  const handleQuickEditSaved = (bienId: number, updates: Partial<BienResumen>) => {
    setResultados((prev) =>
      prev.map((b) => (b.id === bienId ? { ...b, ...updates } : b))
    )
  }

  const writeFiltersToUrl = () => {
    const sp = new URLSearchParams()
    if (codigo.trim()) sp.set('codigo', codigo.trim())
    if (idTrabajador !== '') sp.set('trabajador', String(idTrabajador))
    if (textoUbicacion.trim()) sp.set('ubicacion', textoUbicacion.trim())
    if (textoMarca.trim()) sp.set('marca', textoMarca.trim())
    if (textoModelo.trim()) sp.set('modelo', textoModelo.trim())
    if (nombreChips.length > 0) sp.set('nombres', nombreChips.join('|'))
    if (todasLasSedes) sp.set('todas', '1')
    if (page > 0) sp.set('p', String(page))
    setSearchParams(sp, { replace: true })
  }

  // Restaurar filtros desde URL al montar (al volver desde detalle)
  useEffect(() => {
    if (!initialLoadRef.current) return
    initialLoadRef.current = false
    const sp = searchParams
    const keys = ['codigo', 'trabajador', 'ubicacion', 'marca', 'modelo', 'nombres', 'todas', 'p']
    if (!keys.some((k) => sp.has(k))) return

    setCodigo(sp.get('codigo') || '')
    const trab = sp.get('trabajador')
    setIdTrabajador(trab ? Number(trab) : '')
    setTextoUbicacion(sp.get('ubicacion') || '')
    setTextoMarca(sp.get('marca') || '')
    setTextoModelo(sp.get('modelo') || '')
    const nombres = sp.get('nombres')
    setNombreChips(nombres ? nombres.split('|').filter(Boolean) : [])
    setTodasLasSedes(sp.get('todas') === '1')
    setPage(Number(sp.get('p') || '0'))
    if ((sp.get('p') ? Number(sp.get('p')) : 0) > 0 || keys.some((k) => k !== 'p' && sp.has(k))) {
      setPendingSearch(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Ejecuta búsqueda pendiente tras el flush de estado
  useEffect(() => {
    if (!pendingSearch) return
    setPendingSearch(false)
    void handleSearch()
  }, [pendingSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const q = nombreDraft.trim()
    if (q.length < NOMBRE_SUGGEST_MIN_CHARS) {
      nombreSuggestReq.current += 1
      setNombreSugerencias([])
      setNombreSuggestOpen(false)
      setNombreSuggestLoading(false)
      return
    }

    const timer = window.setTimeout(() => {
      const reqId = ++nombreSuggestReq.current
      setNombreSuggestLoading(true)
      ;(async () => {
        let qy = supabase
          .from('bienes')
          .select('nombre_mueble_equipo')
          .is('eliminado_at', null)
          .ilike('nombre_mueble_equipo', `%${escapeIlikeTerm(q)}%`)
          .order('nombre_mueble_equipo', { ascending: true })
          .limit(NOMBRE_SUGGEST_FETCH_LIMIT)

        if (sedeActiva && !todasLasSedes) qy = qy.eq('sede_id', sedeActiva.id)

        const { data, error } = await qy
        if (nombreSuggestReq.current !== reqId) return
        setNombreSuggestLoading(false)
        if (error) { setNombreSugerencias([]); setNombreSuggestOpen(false); return }

        const rows = (data ?? []) as { nombre_mueble_equipo: string | null }[]
        const uniq = [...new Set(rows.map((r) => r.nombre_mueble_equipo).filter((n): n is string => Boolean(n?.trim())))]
        const sinChips = uniq.filter((n) => !nombreChips.includes(n)).slice(0, NOMBRE_SUGGEST_SHOW)
        setNombreSugerencias(sinChips)
        setNombreSuggestOpen(sinChips.length > 0)
      })()
    }, NOMBRE_SUGGEST_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [nombreDraft, sedeActiva, todasLasSedes, nombreChips])

  const agregarNombreChip = (texto: string) => {
    const t = texto.trim()
    if (!t || nombreChips.includes(t)) return
    setNombreChips((prev) => [...prev, t])
    setNombreDraft('')
    setNombreSugerencias([])
    setNombreSuggestOpen(false)
  }

  const quitarNombreChip = (texto: string) => {
    setNombreChips((prev) => prev.filter((c) => c !== texto))
  }

  function terminosNombreMueble(): string[] {
    const manual = parseNombreTerminos(nombreDraft)
    return [...new Set([...nombreChips, ...manual])]
  }

  type RowWithExtras = BienResumen & { responsableNombre?: string | null; serie?: string | null; orden_compra?: string | null; valor?: number | null }

  const buildCsv = (rows: RowWithExtras[]) => {
    const header = ['id', 'codigo_patrimonial', 'nombre_mueble_equipo', 'estado', 'responsable', 'ubicacion', 'sede', 'marca', 'modelo', 'serie', 'orden_compra', 'valor']
    const lines = rows.map((b) => {
      const values = [String(b.id), b.codigo_patrimonial ?? '', b.nombre_mueble_equipo ?? '', b.estado ?? '',
        b.responsableNombre ?? findResponsableNombre(b.id_trabajador) ?? '',
        findUbicacionNombre(b.ubicacion) ?? '', findSedeNombre(b.sede_id) ?? '',
        b.marca ?? '', b.modelo ?? '', b.serie ?? '', b.orden_compra ?? '',
        b.valor != null ? String(b.valor) : '']
      return values.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
    })
    return [header.join(','), ...lines].join('\n')
  }

  const downloadFile = (filename: string, mime: string, content: string) => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.download = filename
    document.body.appendChild(link); link.click()
    document.body.removeChild(link); URL.revokeObjectURL(url)
  }

  const handleSearch = async (event?: FormEvent) => {
    if (event) event.preventDefault()
    writeFiltersToUrl()
    setError(null); setLoading(true)

    let query = supabase.from('bienes')
      .select('id, codigo_patrimonial, nombre_mueble_equipo, estado, id_trabajador, ubicacion, sede_id, marca, modelo, serie, orden_compra, valor', { count: 'exact' })
      .is('eliminado_at', null)

    if (sedeActiva && !todasLasSedes) query = query.eq('sede_id', sedeActiva.id)
    if (codigo.trim()) {
      // Si el código vino de un scan, búsqueda exacta (rápida e indexada).
      // Si fue tipeado manualmente, usar ilike para tolerar variaciones (ej. PRE-001 ↔ PRE-0001).
      if (codigoFromScanRef.current) {
        query = query.eq('codigo_patrimonial', codigo.trim())
      } else {
        query = query.ilike('codigo_patrimonial', `%${escapeIlikeTerm(codigo.trim())}%`)
      }
    }
    if (idTrabajador !== '') query = query.eq('id_trabajador', idTrabajador)
    if (textoUbicacion.trim()) query = query.ilike('ubicacion', `%${textoUbicacion.trim()}%`)
    if (textoMarca.trim()) query = query.ilike('marca', `%${escapeIlikeTerm(textoMarca.trim())}%`)
    if (textoModelo.trim()) query = query.ilike('modelo', `%${escapeIlikeTerm(textoModelo.trim())}%`)

    const terminosNombre = terminosNombreMueble()
    if (terminosNombre.length === 1) query = query.ilike('nombre_mueble_equipo', `%${escapeIlikeTerm(terminosNombre[0])}%`)
    else if (terminosNombre.length > 1) {
      const orStr = terminosNombre.map((t) => `nombre_mueble_equipo.ilike.%${escapeIlikeTerm(t)}%`).join(',')
      query = query.or(orStr)
    }

    const from = page * PAGE_SIZE
    const { data, error: supaError, count } = await query
      .order('fecha_registro', { ascending: false }).range(from, from + PAGE_SIZE - 1)

    setLoading(false)
    if (supaError) {
      setError('No se pudieron cargar los resultados. Intenta nuevamente.')
      setResultados([]); setTotal(null); return
    }
    setResultados((data ?? []) as BienResumen[])
    setTotal(typeof count === 'number' ? count : null)
  }

  // Persistir la búsqueda actual en el listado de recientes (max 5, dedupe por query string)
  const pushRecent = () => {
    const sp = new URLSearchParams()
    if (codigo.trim()) sp.set('codigo', codigo.trim())
    if (idTrabajador !== '') sp.set('trabajador', String(idTrabajador))
    if (textoUbicacion.trim()) sp.set('ubicacion', textoUbicacion.trim())
    if (textoMarca.trim()) sp.set('marca', textoMarca.trim())
    if (textoModelo.trim()) sp.set('modelo', textoModelo.trim())
    if (nombreChips.length > 0) sp.set('nombres', nombreChips.join('|'))
    if (todasLasSedes) sp.set('todas', '1')
    const qs = sp.toString()
    if (!qs) return
    setRecent((prev) => {
      const next = [qs, ...prev.filter((s) => s !== qs)].slice(0, RECENT_MAX)
      saveRecent(next)
      return next
    })
  }

  const applyQueryString = (qs: string) => {
    const sp = new URLSearchParams(qs)
    setCodigo(sp.get('codigo') || '')
    const trab = sp.get('trabajador')
    setIdTrabajador(trab ? Number(trab) : '')
    setTextoUbicacion(sp.get('ubicacion') || '')
    setTextoMarca(sp.get('marca') || '')
    setTextoModelo(sp.get('modelo') || '')
    const nombres = sp.get('nombres')
    setNombreChips(nombres ? nombres.split('|').filter(Boolean) : [])
    setTodasLasSedes(sp.get('todas') === '1')
    setPage(0)
    codigoFromScanRef.current = false
    setSelectedIds(new Set())
    setPendingSearch(true)
  }

  const handleShareSearch = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Enlace de búsqueda copiado')
    } catch { toast.error('No se pudo copiar el enlace') }
  }

  const handleSaveView = () => {
    const name = saveViewName.trim()
    if (!name) return
    const sp = new URLSearchParams()
    if (codigo.trim()) sp.set('codigo', codigo.trim())
    if (idTrabajador !== '') sp.set('trabajador', String(idTrabajador))
    if (textoUbicacion.trim()) sp.set('ubicacion', textoUbicacion.trim())
    if (textoMarca.trim()) sp.set('marca', textoMarca.trim())
    if (textoModelo.trim()) sp.set('modelo', textoModelo.trim())
    if (nombreChips.length > 0) sp.set('nombres', nombreChips.join('|'))
    if (todasLasSedes) sp.set('todas', '1')
    const qs = sp.toString()
    setSavedViews((prev) => {
      const next = [{ name, query: qs }, ...prev.filter((v) => v.name !== name)].slice(0, 20)
      saveSavedViews(next)
      return next
    })
    setShowSaveViewDialog(false)
    setSaveViewName('')
    toast.success(`Vista "${name}" guardada`)
  }

  const handleDeleteSavedView = (name: string) => {
    setSavedViews((prev) => {
      const next = prev.filter((v) => v.name !== name)
      saveSavedViews(next)
      return next
    })
  }

  const hasActiveFilters =
    codigo.trim() !== '' ||
    idTrabajador !== '' ||
    textoUbicacion.trim() !== '' ||
    textoMarca.trim() !== '' ||
    textoModelo.trim() !== '' ||
    nombreChips.length > 0

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const selectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const allSelected = resultados.every((b) => next.has(b.id))
      if (allSelected) {
        resultados.forEach((b) => next.delete(b.id))
      } else {
        resultados.forEach((b) => next.add(b.id))
      }
      return next
    })
  }

  const selectedTargets = (): BienResumen[] =>
    resultados.filter((b) => selectedIds.has(b.id))

  const handleBulkSaved = (ids: number[], updates: Partial<BienResumen>) => {
    setResultados((prev) => prev.map((b) => (ids.includes(b.id) ? { ...b, ...updates } : b)))
    setSelectedIds(new Set())
    setBulkEdit(null)
    toast.success(`${ids.length} bien${ids.length === 1 ? '' : 'es'} actualizado${ids.length === 1 ? '' : 's'}`)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault(); setPage(0); setSelectedIds(new Set())
    pushRecent()
    setPendingSearch(true)
  }

  const handleNextPage = () => { setPage((prev) => prev + 1); setSelectedIds(new Set()); setPendingSearch(true) }
  const handlePrevPage = () => { setPage((prev) => Math.max(0, prev - 1)); setSelectedIds(new Set()); setPendingSearch(true) }
  const handleCodeScanned = (code: string) => {
    setCodigo(code.trim()); setPage(0); setSelectedIds(new Set())
    codigoFromScanRef.current = true
    setPendingSearch(true)
  }

  const totalPages = total !== null ? Math.ceil(total / PAGE_SIZE) : null

  const handleCopyResultados = async () => {
    if (!resultados.length) return
    const bloques = (resultados as RowWithExtras[]).map((b, i) => {
      const resp = findResponsableNombre(b.id_trabajador)
      const lineas = [`#${i + 1}`, `Código: ${b.codigo_patrimonial}`, `Nombre: ${b.nombre_mueble_equipo || 'Sin nombre'}`]
      if (b.estado) lineas.push(`Estado: ${b.estado}`)
      const sede = findSedeNombre(b.sede_id); if (sede) lineas.push(`Sede: ${sede}`)
      if (resp) lineas.push(`Responsable: ${resp}`)
      if (b.ubicacion) lineas.push(`Ubicación: ${findUbicacionNombre(b.ubicacion) ?? b.ubicacion}`)
      const sigaParts: string[] = []
      if (b.marca) sigaParts.push(`Marca: ${b.marca}`)
      if (b.modelo) sigaParts.push(`Modelo: ${b.modelo}`)
      if (b.serie) sigaParts.push(`Serie: ${b.serie}`)
      if (b.orden_compra) sigaParts.push(`OC: ${b.orden_compra}`)
      if (b.valor != null) sigaParts.push(`Valor: S/. ${b.valor.toLocaleString()}`)
      if (sigaParts.length) lineas.push(sigaParts.join(' | '))
      return lineas.join('\n')
    })
    const texto = [`Resultados (${resultados.length} bien${resultados.length === 1 ? '' : 'es'})`, ...bloques].join('\n\n')
    try {
      await navigator.clipboard.writeText(texto)
      setCopied(true)
      toast.success('Copiado al portapapeles')
      window.setTimeout(() => setCopied(false), 2500)
    } catch { /* ignore */ }
  }

  const handleExportAll = async (format: 'json' | 'csv') => {
    setExportingAll(true); setError(null)
    try {
      const pageSize = 1000; let from = 0; const all: RowWithExtras[] = []; let hasMore = true
      while (hasMore) {
        const { data, error: supaError } = await supabase.from('bienes')
          .select('id, codigo_patrimonial, nombre_mueble_equipo, id_trabajador, ubicacion, estado, sede_id, fecha_registro, marca, modelo, serie, orden_compra, valor')
          .is('eliminado_at', null).order('id', { ascending: true }).range(from, from + pageSize - 1)
        if (supaError) { setError('No se pudo exportar. Intenta nuevamente.'); hasMore = false; break }
        if (!data || data.length === 0) { hasMore = false; break }
        all.push(...(data as RowWithExtras[]))
        if (data.length < pageSize) hasMore = false; else from += pageSize
      }
      if (!all.length) return
      if (format === 'json') {
        downloadFile('bienes-todos.json', 'application/json', JSON.stringify(all.map((b) => ({ ...b, ubicacion: findUbicacionNombre(b.ubicacion ?? null), responsable: findResponsableNombre(b.id_trabajador ?? null), sede: findSedeNombre(b.sede_id ?? null) })), null, 2))
      } else {
        downloadFile('bienes-todos.csv', 'text/csv;charset=utf-8;', buildCsv(all.map((b) => ({ ...b, responsableNombre: findResponsableNombre(b.id_trabajador ?? null) }))))
      }
    } finally {
      setExportingAll(false)
    }
  }

  return (
    <div>
      <h1 className="page-title">Buscar bienes</h1>
      <p className="page-subtitle">
        Filtra por código, nombre, marca, modelo, responsable o ubicación.
      </p>

      <div className="mt-6 lg:grid lg:grid-cols-10 lg:gap-6 lg:items-start">
        {/* Panel de filtros */}
        <div className="lg:col-span-3 lg:sticky lg:top-6 min-w-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <SearchIcon className="h-4 w-4 text-muted-foreground" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(recent.length > 0 || savedViews.length > 0) && (
                <div className="space-y-2 mb-4">
                  {savedViews.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
                        <Star className="h-3 w-3" /> Mis vistas
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {savedViews.map((v) => (
                          <Badge
                            key={v.name}
                            variant="outline"
                            className="gap-1 cursor-pointer hover:bg-accent pr-1 group"
                            onClick={() => applyQueryString(v.query)}
                            title={describeQuery(v.query, trabajadores)}
                          >
                            {v.name}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleDeleteSavedView(v.name) }}
                              className="rounded-full hover:bg-destructive/20 p-0.5 opacity-50 group-hover:opacity-100 transition-opacity"
                              aria-label={`Eliminar vista ${v.name}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {recent.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
                        <Clock className="h-3 w-3" /> Recientes
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {recent.map((qs) => (
                          <Badge
                            key={qs}
                            variant="secondary"
                            className="cursor-pointer hover:bg-accent text-xs font-normal max-w-[14rem] truncate"
                            onClick={() => applyQueryString(qs)}
                            title={describeQuery(qs, trabajadores)}
                          >
                            {describeQuery(qs, trabajadores)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="search-codigo">Código patrimonial</Label>
                  <div className="flex gap-2">
                    <Input
                      id="search-codigo"
                      value={codigo}
                      onChange={(e) => { setCodigo(e.target.value); codigoFromScanRef.current = false }}
                      placeholder="Código (parcial o exacto)"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowScanModal(true)}
                      title="Escanear código de barras"
                    >
                      <ScanLine className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Botón toggle filtros avanzados — solo móvil */}
                {(() => {
                  const activeFilterCount = [
                    nombreChips.length > 0,
                    idTrabajador !== '',
                    textoUbicacion.trim() !== '',
                    textoMarca.trim() !== '',
                    textoModelo.trim() !== '',
                    todasLasSedes,
                  ].filter(Boolean).length
                  return (
                    <button
                      type="button"
                      className="lg:hidden flex items-center gap-2 text-sm text-primary font-medium py-1"
                      onClick={() => setShowAdvancedFilters(v => !v)}
                    >
                      <Filter className="h-3.5 w-3.5" />
                      Filtros avanzados
                      {activeFilterCount > 0 && (
                        <Badge variant="secondary" className="h-5 px-1.5 text-xs">{activeFilterCount}</Badge>
                      )}
                      {showAdvancedFilters
                        ? <ChevronUp className="h-3.5 w-3.5 ml-auto" />
                        : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
                    </button>
                  )
                })()}

                {/* Filtros avanzados: ocultos en móvil por defecto, siempre visibles en desktop */}
                <div className={cn('space-y-4', !showAdvancedFilters && 'hidden lg:block', showAdvancedFilters && 'block')}>
                  <TrabajadorSearchableSelect
                    value={idTrabajador}
                    onChange={(v) => setIdTrabajador(v === null ? '' : v)}
                    label="Responsable"
                    allowAll
                  />

                  <div className="space-y-1.5">
                    <Label htmlFor="search-nombre-modelo">Nombre / modelo del bien</Label>
                    {nombreChips.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {nombreChips.map((c) => (
                          <Badge key={c} variant="outline" className="gap-1 text-primary border-primary/30 bg-primary/5 pr-1">
                            {c}
                            <button
                              type="button"
                              onClick={() => quitarNombreChip(c)}
                              className="rounded-full hover:bg-primary/20 p-0.5"
                              aria-label={`Quitar ${c}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="relative">
                      <Input
                        id="search-nombre-modelo"
                        value={nombreDraft}
                        onChange={(e) => setNombreDraft(e.target.value)}
                        onFocus={() => { if (nombreSugerencias.length > 0) setNombreSuggestOpen(true) }}
                        onBlur={() => { window.setTimeout(() => setNombreSuggestOpen(false), 200) }}
                        placeholder="Escribe para ver sugerencias…"
                        autoComplete="off"
                        className={nombreSuggestLoading ? 'pr-8' : ''}
                      />
                      {nombreSuggestLoading && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </span>
                      )}
                      {nombreSuggestOpen && nombreSugerencias.length > 0 && (
                        <ul
                          className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-border bg-popover py-1 shadow-lg"
                          role="listbox"
                        >
                          {nombreSugerencias.map((s) => (
                            <li key={s} role="option">
                              <button
                                type="button"
                                className="w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => agregarNombreChip(s)}
                              >
                                {s}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="search-ubicacion">Ubicación (contiene)</Label>
                    <Input id="search-ubicacion" value={textoUbicacion} onChange={(e) => setTextoUbicacion(e.target.value)} placeholder="Texto parcial" />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="search-marca">Marca (contiene)</Label>
                    <Input id="search-marca" value={textoMarca} onChange={(e) => setTextoMarca(e.target.value)} placeholder="Texto parcial" />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="search-modelo-siga">Modelo SIGA (contiene)</Label>
                    <Input id="search-modelo-siga" value={textoModelo} onChange={(e) => setTextoModelo(e.target.value)} placeholder="Texto parcial" />
                  </div>

                  <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={todasLasSedes}
                      onChange={(e) => setTodasLasSedes(e.target.checked)}
                      className="h-4 w-4 rounded border-input accent-primary"
                    />
                    Buscar en todas las sedes
                    {!todasLasSedes && sedeActiva && (
                      <span className="text-muted-foreground text-xs">({sedeActiva.nombre})</span>
                    )}
                  </label>
                </div>

                <Button type="submit" disabled={loading} className="w-full gap-2 min-h-11">
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Buscando…</> : <><SearchIcon className="h-4 w-4" />Buscar</>}
                </Button>

                {hasActiveFilters && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowSaveViewDialog(true)}
                    className="w-full gap-2"
                  >
                    <Star className="h-4 w-4" />
                    Guardar esta vista
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Resultados */}
        <div className="mt-6 lg:mt-0 lg:col-span-7 min-w-0">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading && (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          )}

          {!loading && resultados.length > 0 && (
            <div className="space-y-4">
              {/* Header de resultados */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="font-semibold text-foreground">Resultados</span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    Pág. {page + 1}{totalPages ? ` de ${totalPages}` : ''}
                    {total !== null ? ` · ${total.toLocaleString()} bienes` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleShareSearch}
                    className="gap-1.5 h-8 text-xs"
                    title="Copiar enlace a esta búsqueda"
                  >
                    <Share2 className="h-3.5 w-3.5" /> Compartir
                  </Button>
                  <Button
                    variant={copied ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={handleCopyResultados}
                    className={cn('gap-1.5 h-8 text-xs transition-colors', copied && 'text-green-600 dark:text-green-400')}
                  >
                    {copied
                      ? <><Check className="h-3.5 w-3.5" /> Copiado</>
                      : <><Copy className="h-3.5 w-3.5" /> Copiar</>}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDownloadResultadosJson()} className="gap-1.5 h-8 text-xs">
                    <FileJson className="h-3.5 w-3.5" /> JSON
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDownloadResultadosCsv()} className="gap-1.5 h-8 text-xs">
                    <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                  </Button>
                </div>
              </div>

              {/* Lista móvil */}
              <div className="lg:hidden divide-y divide-border border border-border rounded-2xl overflow-hidden bg-card">
                {resultados.map((b) => (
                  <div key={b.id} className={cn(
                    'flex items-stretch hover:bg-muted/50 transition-colors',
                    selectedIds.has(b.id) && 'bg-primary/5'
                  )}>
                    {canBulkEdit && (
                      <label
                        className="flex items-center px-3 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(b.id)}
                          onChange={() => toggleSelected(b.id)}
                          className="h-4 w-4 rounded border-input accent-primary"
                          aria-label={`Seleccionar ${b.codigo_patrimonial}`}
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      onClick={() => navigate(`/bienes/${b.id}`)}
                      className="flex-1 text-left px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold text-foreground text-sm">{b.codigo_patrimonial}</div>
                        {b.estado && <Badge variant={estadoBadgeVariant(b.estado)} className="shrink-0 text-xs">{b.estado}</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground mt-0.5">{b.nombre_mueble_equipo || 'Sin nombre'}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {[findUbicacionNombre(b.ubicacion), findResponsableNombre(b.id_trabajador), findSedeNombre(b.sede_id)].filter(Boolean).join(' · ')}
                      </div>
                    </button>
                    <div className="flex items-center pr-2" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/bienes/${b.id}`)}>
                            <Eye className="h-4 w-4 mr-2" /> Ver detalle
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setQuickEdit({ bien: b, campo: 'estado' })}>
                            <Tag className="h-4 w-4 mr-2" /> Editar estado
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setQuickEdit({ bien: b, campo: 'responsable' })}>
                            <User className="h-4 w-4 mr-2" /> Editar responsable
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setQuickEdit({ bien: b, campo: 'ubicacion' })}>
                            <MapPin className="h-4 w-4 mr-2" /> Editar ubicación
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tabla desktop */}
              <Card className="hidden lg:block overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {canBulkEdit && (
                        <TableHead className="w-10">
                          <input
                            type="checkbox"
                            checked={resultados.length > 0 && resultados.every((b) => selectedIds.has(b.id))}
                            onChange={selectAllOnPage}
                            className="h-4 w-4 rounded border-input accent-primary"
                            aria-label="Seleccionar todos los de la página"
                          />
                        </TableHead>
                      )}
                      <TableHead className="whitespace-nowrap">Código</TableHead>
                      <TableHead className="min-w-[12rem]">Nombre</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="min-w-[8rem]">Marca / Modelo</TableHead>
                      <TableHead className="min-w-[10rem]">Ubicación</TableHead>
                      <TableHead>Responsable</TableHead>
                      <TableHead>Sede</TableHead>
                      <TableHead className="w-10 text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultados.map((b) => {
                      const nombreResp = findResponsableNombre(b.id_trabajador)
                      return (
                        <TableRow
                          key={b.id}
                          tabIndex={0}
                          role="link"
                          aria-label={`Ver bien ${b.codigo_patrimonial ?? b.id}`}
                          onClick={() => navigate(`/bienes/${b.id}`)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/bienes/${b.id}`) } }}
                          className={cn(
                            'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                            selectedIds.has(b.id) && 'bg-primary/5',
                          )}
                        >
                          {canBulkEdit && (
                            <TableCell className="align-top" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedIds.has(b.id)}
                                onChange={() => toggleSelected(b.id)}
                                className="h-4 w-4 rounded border-input accent-primary"
                                aria-label={`Seleccionar ${b.codigo_patrimonial}`}
                              />
                            </TableCell>
                          )}
                          <TableCell className="font-semibold whitespace-nowrap align-top">{b.codigo_patrimonial}</TableCell>
                          <TableCell className="align-top">{b.nombre_mueble_equipo || 'Sin nombre'}</TableCell>
                          <TableCell className="align-top">
                            {b.estado && <Badge variant={estadoBadgeVariant(b.estado)} className="text-xs">{b.estado}</Badge>}
                          </TableCell>
                          <TableCell className="align-top text-sm">
                            <span className="block text-foreground">{b.marca?.trim() || '—'}</span>
                            <span className="block text-muted-foreground text-xs">{b.modelo?.trim() || '—'}</span>
                          </TableCell>
                          <TableCell className="align-top text-sm text-muted-foreground">{findUbicacionNombre(b.ubicacion) || '—'}</TableCell>
                          <TableCell className="align-top text-sm text-muted-foreground">{nombreResp ?? '—'}</TableCell>
                          <TableCell className="align-top text-sm text-muted-foreground">{findSedeNombre(b.sede_id) ?? '—'}</TableCell>
                          <TableCell className="align-top" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => navigate(`/bienes/${b.id}`)}>
                                  <Eye className="h-4 w-4 mr-2" /> Ver detalle
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setQuickEdit({ bien: b, campo: 'estado' })}>
                                  <Tag className="h-4 w-4 mr-2" /> Editar estado
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setQuickEdit({ bien: b, campo: 'responsable' })}>
                                  <User className="h-4 w-4 mr-2" /> Editar responsable
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setQuickEdit({ bien: b, campo: 'ubicacion' })}>
                                  <MapPin className="h-4 w-4 mr-2" /> Editar ubicación
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </Card>

              {/* Paginación */}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 gap-1" onClick={handlePrevPage} disabled={loading || page === 0}>
                  <ChevronLeft className="h-4 w-4" /> Anterior
                </Button>
                <Button className="flex-1 gap-1" onClick={handleNextPage} disabled={loading || (totalPages !== null && page + 1 >= totalPages)}>
                  Siguiente <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {!loading && !error && resultados.length === 0 && total === null && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <SearchIcon className="h-12 w-12 mb-3 opacity-20" />
              <p className="text-sm">Realiza una búsqueda para ver resultados.</p>
            </div>
          )}

          {!loading && !error && resultados.length === 0 && total === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <p className="text-sm">No se encontraron bienes con esos filtros.</p>
              {codigo.trim() && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/scan?codigo=${encodeURIComponent(codigo.trim())}`)}
                  className="gap-2"
                >
                  <ScanLine className="h-4 w-4" />
                  ¿Registrar bien con código {codigo.trim()}?
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {showScanModal && (
        <BarcodeScanModal
          onDetected={handleCodeScanned}
          onClose={() => setShowScanModal(false)}
        />
      )}

      <Separator className="my-8" />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">Exportar todos los bienes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Exporta el inventario completo en bloques de hasta 1000 registros.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => handleExportAll('csv')} disabled={exportingAll} className="gap-2">
              {exportingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              {exportingAll ? 'Preparando…' : 'Descargar Excel (CSV)'}
            </Button>
            <Button variant="secondary" onClick={() => handleExportAll('json')} disabled={exportingAll} className="gap-2">
              <FileJson className="h-4 w-4" />
              Descargar JSON
            </Button>
          </div>
        </CardContent>
      </Card>

      <QuickEditBienDialog
        target={quickEdit}
        onClose={() => setQuickEdit(null)}
        onSaved={handleQuickEditSaved}
      />

      <BulkEditBienDialog
        bulk={bulkEdit}
        onClose={() => setBulkEdit(null)}
        onSaved={handleBulkSaved}
      />

      {/* Barra fija de acciones masivas */}
      {canBulkEdit && selectedIds.size > 0 && (
        <div className={cn(
          'fixed bottom-0 left-0 right-0 z-40 md:left-64',
          'bg-background/95 backdrop-blur border-t border-border',
          'px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]',
          'flex flex-wrap items-center gap-2 transition-all duration-200',
        )}>
          <span className="text-sm font-semibold text-foreground mr-1">
            {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <Button
            size="sm"
            variant="secondary"
            className="gap-1.5"
            onClick={() => setBulkEdit({ campo: 'estado', targets: selectedTargets() })}
          >
            <Tag className="h-4 w-4" /> Estado
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="gap-1.5"
            onClick={() => setBulkEdit({ campo: 'responsable', targets: selectedTargets() })}
          >
            <User className="h-4 w-4" /> Responsable
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="gap-1.5"
            onClick={() => setBulkEdit({ campo: 'ubicacion', targets: selectedTargets() })}
          >
            <MapPin className="h-4 w-4" /> Ubicación
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto gap-1.5 text-muted-foreground"
            onClick={() => setSelectedIds(new Set())}
          >
            <X className="h-4 w-4" /> Limpiar
          </Button>
        </div>
      )}

      {/* Dialog guardar vista */}
      <Dialog open={showSaveViewDialog} onOpenChange={setShowSaveViewDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Guardar vista</DialogTitle>
            <DialogDescription>
              Ponle un nombre para encontrarla rápidamente después.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={saveViewName}
              onChange={(e) => setSaveViewName(e.target.value)}
              placeholder="Ej: Mis bienes en Almacén"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveView() } }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveViewDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveView} disabled={!saveViewName.trim()}>
              <Star className="h-4 w-4 mr-2" /> Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )

  function handleDownloadResultadosJson() {
    if (!resultados.length) return
    const normalized = (resultados as RowWithExtras[]).map((b) => ({ ...b, ubicacion: findUbicacionNombre(b.ubicacion), responsable: findResponsableNombre(b.id_trabajador), sede: findSedeNombre(b.sede_id) }))
    downloadFile('bienes-busqueda.json', 'application/json', JSON.stringify(normalized, null, 2))
  }

  function handleDownloadResultadosCsv() {
    if (!resultados.length) return
    downloadFile('bienes-busqueda.csv', 'text/csv;charset=utf-8;', buildCsv((resultados as RowWithExtras[]).map((b) => ({ ...b, responsableNombre: findResponsableNombre(b.id_trabajador) }))))
  }
}
