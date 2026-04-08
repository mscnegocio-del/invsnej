import type { FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { BarcodeScanModal } from '../components/BarcodeScanModal'
import { TrabajadorSearchableSelect } from '../components/TrabajadorSearchableSelect'
import { useCatalogs } from '../context/CatalogContext'
import { useSede } from '../context/SedeContext'
import type { BienResumen } from '../types'
const PAGE_SIZE = 20
const NOMBRE_SUGGEST_DEBOUNCE_MS = 300
const NOMBRE_SUGGEST_MIN_CHARS = 2
const NOMBRE_SUGGEST_FETCH_LIMIT = 40
const NOMBRE_SUGGEST_SHOW = 18

/** Términos separados por coma o salto de línea; OR sobre nombre_mueble_equipo */
function parseNombreTerminos(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function escapeIlikeTerm(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export function Search() {
  const navigate = useNavigate()
  const { trabajadores, ubicaciones, sedes } = useCatalogs()
  const { sedeActiva } = useSede()

  const [codigo, setCodigo] = useState('')
  const [idTrabajador, setIdTrabajador] = useState<number | ''>('')
  const [textoUbicacion, setTextoUbicacion] = useState('')
  /** Términos elegidos desde sugerencias (OR con el texto libre del input) */
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

  const findResponsableNombre = (idTrab: number | null) => {
    if (!idTrab) return null
    const t = trabajadores.find((tr) => tr.id === idTrab)
    return t?.nombre ?? null
  }

  const findUbicacionNombre = (ubicacionRaw: string | null) => {
    if (!ubicacionRaw) return null
    const asNumber = Number(ubicacionRaw)
    if (!Number.isNaN(asNumber)) {
      const byId = ubicaciones.find((u) => u.id === asNumber)
      return byId?.nombre ?? ubicacionRaw
    }
    return ubicacionRaw
  }

  const findSedeNombre = (sedeId: number | null | undefined) => {
    if (!sedeId) return null
    return sedes.find((s) => s.id === sedeId)?.nombre ?? `Sede ${sedeId}`
  }

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

        if (sedeActiva && !todasLasSedes) {
          qy = qy.eq('sede_id', sedeActiva.id)
        }

        const { data, error } = await qy
        if (nombreSuggestReq.current !== reqId) return
        setNombreSuggestLoading(false)
        if (error) {
          console.error(error)
          setNombreSugerencias([])
          setNombreSuggestOpen(false)
          return
        }
        const rows = (data ?? []) as { nombre_mueble_equipo: string | null }[]
        const uniq = [
          ...new Set(rows.map((r) => r.nombre_mueble_equipo).filter((n): n is string => Boolean(n?.trim()))),
        ]
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

  /** Términos finales para la query: chips + texto libre (comas/saltos) */
  function terminosNombreMueble(): string[] {
    const manual = parseNombreTerminos(nombreDraft)
    return [...new Set([...nombreChips, ...manual])]
  }

  type RowWithExtras = BienResumen & {
    responsableNombre?: string | null
    marca?: string | null
    modelo?: string | null
    serie?: string | null
    orden_compra?: string | null
    valor?: number | null
  }

  const buildCsv = (rows: RowWithExtras[]) => {
    const header = ['id', 'codigo_patrimonial', 'nombre_mueble_equipo', 'estado', 'responsable', 'ubicacion', 'sede', 'marca', 'modelo', 'serie', 'orden_compra', 'valor']
    const lines = rows.map((b) => {
      const responsable = b.responsableNombre ?? findResponsableNombre(b.id_trabajador) ?? ''
      const values = [
        String(b.id),
        b.codigo_patrimonial ?? '',
        b.nombre_mueble_equipo ?? '',
        b.estado ?? '',
        responsable,
        findUbicacionNombre(b.ubicacion) ?? '',
        findSedeNombre(b.sede_id) ?? '',
        b.marca ?? '',
        b.modelo ?? '',
        b.serie ?? '',
        b.orden_compra ?? '',
        b.valor != null ? String(b.valor) : '',
      ]
      return values
        .map((v) =>
          `"${String(v).replace(/"/g, '""')}"`,
        )
        .join(',')
    })
    return [header.join(','), ...lines].join('\n')
  }

  const downloadFile = (filename: string, mime: string, content: string) => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleSearch = async (event?: FormEvent) => {
    if (event) event.preventDefault()
    setError(null)
    setLoading(true)

    let query = supabase
      .from('bienes')
      .select('id, codigo_patrimonial, nombre_mueble_equipo, estado, id_trabajador, ubicacion, sede_id, marca, modelo, serie, orden_compra, valor', {
        count: 'exact',
      })
      .is('eliminado_at', null)

    if (sedeActiva && !todasLasSedes) {
      query = query.eq('sede_id', sedeActiva.id)
    }

    if (codigo.trim()) {
      query = query.eq('codigo_patrimonial', codigo.trim())
    }

    if (idTrabajador !== '') {
      query = query.eq('id_trabajador', idTrabajador)
    }

    if (textoUbicacion.trim()) {
      query = query.ilike('ubicacion', `%${textoUbicacion.trim()}%`)
    }

    const terminosNombre = terminosNombreMueble()
    if (terminosNombre.length === 1) {
      query = query.ilike('nombre_mueble_equipo', `%${escapeIlikeTerm(terminosNombre[0])}%`)
    } else if (terminosNombre.length > 1) {
      const orStr = terminosNombre.map((t) => `nombre_mueble_equipo.ilike.%${escapeIlikeTerm(t)}%`).join(',')
      query = query.or(orStr)
    }

    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    const { data, error: supaError, count } = await query
      .order('fecha_registro', { ascending: false })
      .range(from, to)

    setLoading(false)

    if (supaError) {
      console.error(supaError)
      setError('No se pudieron cargar los resultados. Intenta nuevamente.')
      setResultados([])
      setTotal(null)
      return
    }

    setResultados((data ?? []) as BienResumen[])
    setTotal(typeof count === 'number' ? count : null)
  }

  const handleSubmit = (event: FormEvent) => {
    setPage(0)
    handleSearch(event)
  }

  const handleNextPage = () => {
    setPage((prev) => prev + 1)
    setTimeout(() => void handleSearch(), 0)
  }

  const handlePrevPage = () => {
    setPage((prev) => Math.max(0, prev - 1))
    setTimeout(() => void handleSearch(), 0)
  }

  const handleCodeScanned = (code: string) => {
    setCodigo(code.trim())
    setPage(0)
    setTimeout(() => void handleSearch(), 0)
  }

  const totalPages = total !== null ? Math.ceil(total / PAGE_SIZE) : null

  const handleCopyResultados = async () => {
    if (!resultados.length) return

    const encabezado = `Resultados de búsqueda (${resultados.length} bien${resultados.length === 1 ? '' : 'es'})`

    const bloques = (resultados as RowWithExtras[]).map((b, index) => {
      const responsable = findResponsableNombre(b.id_trabajador)
      const lineas: string[] = []
      lineas.push(`#${index + 1}`)
      lineas.push(`Código: ${b.codigo_patrimonial}`)
      lineas.push(`Nombre: ${b.nombre_mueble_equipo || 'Sin nombre'}`)
      if (b.estado) {
        lineas.push(`Estado: ${b.estado}`)
      }
      const sede = findSedeNombre(b.sede_id)
      if (sede) {
        lineas.push(`Sede: ${sede}`)
      }
      if (responsable) {
        lineas.push(`Responsable: ${responsable}`)
      }
      if (b.ubicacion) {
        lineas.push(`Ubicación: ${findUbicacionNombre(b.ubicacion) ?? b.ubicacion}`)
      }
      // Campos SIGA (solo si existen)
      const sigaParts: string[] = []
      if (b.marca) sigaParts.push(`Marca: ${b.marca}`)
      if (b.modelo) sigaParts.push(`Modelo: ${b.modelo}`)
      if (b.serie) sigaParts.push(`Serie: ${b.serie}`)
      if (b.orden_compra) sigaParts.push(`OC: ${b.orden_compra}`)
      if (b.valor != null) sigaParts.push(`Valor: S/. ${b.valor.toLocaleString()}`)
      if (sigaParts.length) lineas.push(sigaParts.join(' | '))
      return lineas.join('\n')
    })

    const texto = [encabezado, ...bloques].join('\n\n')

    try {
      await navigator.clipboard.writeText(texto)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch (e) {
      console.error('No se pudo copiar al portapapeles', e)
    }
  }

  const handleDownloadResultadosJson = () => {
    if (!resultados.length) return
    const normalized = (resultados as RowWithExtras[]).map((b) => ({
      ...b,
      ubicacion: findUbicacionNombre(b.ubicacion),
      responsable: findResponsableNombre(b.id_trabajador),
      sede: findSedeNombre(b.sede_id),
    }))
    downloadFile('bienes-busqueda.json', 'application/json', JSON.stringify(normalized, null, 2))
  }

  const handleDownloadResultadosCsv = () => {
    if (!resultados.length) return
    const rows = (resultados as RowWithExtras[]).map((b) => ({
      ...b,
      responsableNombre: findResponsableNombre(b.id_trabajador),
    }))
    const csv = buildCsv(rows)
    downloadFile('bienes-busqueda.csv', 'text/csv;charset=utf-8;', csv)
  }

  const handleExportAll = async (format: 'json' | 'csv') => {
    setExportingAll(true)
    setError(null)
    try {
      const pageSize = 1000
      let from = 0
      const all: RowWithExtras[] = []
      let hasMore = true

      while (hasMore) {
        const { data, error: supaError } = await supabase
          .from('bienes')
          .select('id, codigo_patrimonial, nombre_mueble_equipo, id_trabajador, ubicacion, estado, sede_id, fecha_registro, marca, modelo, serie, orden_compra, valor')
          .is('eliminado_at', null)
          .order('id', { ascending: true })
          .range(from, from + pageSize - 1)

        if (supaError) {
          console.error(supaError)
          setError('No se pudo exportar todos los bienes. Intenta nuevamente.')
          hasMore = false
          break
        }

        if (!data || data.length === 0) {
          hasMore = false
          break
        }

        all.push(...(data as RowWithExtras[]))

        if (data.length < pageSize) {
          hasMore = false
        } else {
          from += pageSize
        }
      }

      if (all.length === 0) return

      if (format === 'json') {
        const normalized = all.map((b) => ({
          ...(b as RowWithExtras),
          ubicacion: findUbicacionNombre((b as RowWithExtras).ubicacion ?? null),
          responsable: findResponsableNombre((b as RowWithExtras).id_trabajador ?? null),
          sede: findSedeNombre((b as RowWithExtras).sede_id ?? null),
        }))
        downloadFile('bienes-todos.json', 'application/json', JSON.stringify(normalized, null, 2))
      } else {
        const rows = all.map((b) => ({
          ...(b as RowWithExtras),
          responsableNombre: findResponsableNombre((b as RowWithExtras).id_trabajador ?? null),
        }))
        const csv = buildCsv(rows)
        downloadFile('bienes-todos.csv', 'text/csv;charset=utf-8;', csv)
      }
    } finally {
      setExportingAll(false)
    }
  }

  return (
    <div>
      <h1 className="page-title">Buscar bienes</h1>
      <p className="page-subtitle">
        Filtra por código, nombre o modelo (sugerencias al escribir; puedes añadir varias etiquetas; el texto libre
        también admite varios términos por coma o línea — se busca cualquiera), responsable o ubicación.
      </p>

      <div className="mt-6 lg:grid lg:grid-cols-5 lg:gap-6 lg:items-start">
        <div className="lg:col-span-2 lg:sticky lg:top-24">
          <form onSubmit={handleSubmit} className="card p-6 space-y-4 w-full">
            <div>
              <label className="label" htmlFor="search-codigo">
                Código patrimonial
              </label>
              <div className="flex gap-2">
                <input
                  id="search-codigo"
                  type="text"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="Ej. código exacto"
                  className="input flex-1"
                />
                <button
                  type="button"
                  onClick={() => setShowScanModal(true)}
                  className="btn-secondary shrink-0 px-4"
                  title="Buscar por escaneo de código de barras"
                  aria-label="Buscar por escaneo de código de barras"
                >
                  📷
                </button>
              </div>
            </div>

            <TrabajadorSearchableSelect
              value={idTrabajador}
              onChange={(v) => setIdTrabajador(v === null ? '' : v)}
              label="Responsable"
              allowAll
            />

            <div className="relative">
              <label className="label" htmlFor="search-nombre-modelo">
                Nombre / modelo del bien
              </label>
              {nombreChips.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {nombreChips.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1 rounded-full bg-teal-50 text-teal-900 text-sm px-3 py-1 border border-teal-200"
                    >
                      {c}
                      <button
                        type="button"
                        onClick={() => quitarNombreChip(c)}
                        className="rounded-full hover:bg-teal-100 px-1 leading-none"
                        aria-label={`Quitar ${c}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="relative">
                <input
                  id="search-nombre-modelo"
                  type="text"
                  value={nombreDraft}
                  onChange={(e) => setNombreDraft(e.target.value)}
                  onFocus={() => {
                    if (nombreSugerencias.length > 0) setNombreSuggestOpen(true)
                  }}
                  onBlur={() => {
                    window.setTimeout(() => setNombreSuggestOpen(false), 200)
                  }}
                  placeholder="Escribe al menos 2 letras para ver sugerencias…"
                  autoComplete="off"
                  className="input pr-10"
                />
                {nombreSuggestLoading && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
                )}
              </div>
              {nombreSuggestOpen && nombreSugerencias.length > 0 && (
                <ul
                  className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                  role="listbox"
                >
                  {nombreSugerencias.map((s) => (
                    <li key={s} role="option">
                      <button
                        type="button"
                        className="w-full px-4 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => agregarNombreChip(s)}
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-slate-500 mt-1">
                Sugerencias según la sede marcada arriba (&quot;Buscar en todas las sedes&quot;). Puedes añadir más
                términos libres (coma o línea) en el mismo campo antes de buscar.
              </p>
            </div>

            <div>
              <label className="label" htmlFor="search-ubicacion">
                Ubicación (contiene)
              </label>
              <input
                id="search-ubicacion"
                type="text"
                value={textoUbicacion}
                onChange={(e) => setTextoUbicacion(e.target.value)}
                placeholder="Texto parcial de ubicación"
                className="input"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={todasLasSedes}
                onChange={(e) => setTodasLasSedes(e.target.checked)}
                className="size-4 rounded border-slate-300"
              />
              Buscar en todas las sedes
              {!todasLasSedes && sedeActiva && (
                <span className="text-slate-500">({sedeActiva.nombre})</span>
              )}
            </label>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Buscando...
                </>
              ) : (
                'Buscar'
              )}
            </button>
          </form>
        </div>

        <div className="mt-6 lg:mt-0 lg:col-span-3 lg:min-h-[28rem]">
          {error && (
            <p className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm mb-4">{error}</p>
          )}
          {!loading && resultados.length > 0 && (
            <section>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">Resultados</h2>
                  <p className="text-sm text-slate-600">
                    Página {page + 1}
                    {totalPages ? ` de ${totalPages}` : ''}
                    {total !== null ? ` · ${total} bienes` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <button
                    type="button"
                    onClick={handleCopyResultados}
                    className="btn-ghost px-2"
                    title="Copiar resumen de resultados para compartir"
                  >
                    📋 Copiar
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadResultadosJson}
                    className="btn-ghost px-2"
                    title="Descargar resultados en JSON"
                  >
                    🧾 JSON
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadResultadosCsv}
                    className="btn-ghost px-2"
                    title="Descargar resultados en Excel (CSV)"
                  >
                    📑 Excel
                  </button>
                  {copied && (
                    <span className="text-xs text-teal-700">Copiado</span>
                  )}
                </div>
              </div>

              <ul className="lg:hidden space-y-0 divide-y divide-slate-200 card overflow-hidden">
                {resultados.map((b) => (
                  <li
                    key={b.id}
                    onClick={() => navigate(`/bienes/${b.id}`)}
                    className="px-4 py-4 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <div className="font-semibold text-slate-900">{b.codigo_patrimonial}</div>
                    <div className="text-slate-600">{b.nombre_mueble_equipo || 'Sin nombre'}</div>
                    <div className="text-sm text-slate-500 mt-0.5">
                      {findUbicacionNombre(b.ubicacion) || 'Sin ubicación'}
                      {(() => {
                        const nombre = findResponsableNombre(b.id_trabajador)
                        if (!nombre) return ''
                        return ` · Responsable ${nombre}`
                      })()}
                      {(() => {
                        const sede = findSedeNombre(b.sede_id)
                        if (!sede) return ''
                        return ` · ${sede}`
                      })()}
                    </div>
                  </li>
                ))}
              </ul>

              <div className="hidden lg:block card overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                      <th scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                        Código
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold min-w-[12rem]">
                        Nombre
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold min-w-[10rem]">
                        Ubicación
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                        Responsable
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                        Sede
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultados.map((b) => {
                      const go = () => navigate(`/bienes/${b.id}`)
                      const nombreResp = findResponsableNombre(b.id_trabajador)
                      return (
                        <tr
                          key={b.id}
                          tabIndex={0}
                          role="link"
                          aria-label={`Ver bien ${b.codigo_patrimonial ?? b.id}`}
                          onClick={go}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              go()
                            }
                          }}
                          className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500"
                        >
                          <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap align-top">
                            {b.codigo_patrimonial}
                          </td>
                          <td className="px-4 py-3 text-slate-700 align-top">{b.nombre_mueble_equipo || 'Sin nombre'}</td>
                          <td className="px-4 py-3 text-slate-600 align-top">
                            {findUbicacionNombre(b.ubicacion) || 'Sin ubicación'}
                          </td>
                          <td className="px-4 py-3 text-slate-600 align-top">{nombreResp ?? '—'}</td>
                          <td className="px-4 py-3 text-slate-600 align-top">{findSedeNombre(b.sede_id) ?? '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={handlePrevPage}
                  disabled={loading || page === 0}
                  className="btn-secondary flex-1"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={loading || (totalPages !== null && page + 1 >= totalPages)}
                  className="btn-primary flex-1"
                >
                  Siguiente
                </button>
              </div>
            </section>
          )}

          {!loading && !error && resultados.length === 0 && total === null && (
            <p className="text-slate-500 text-center py-10">Realiza una búsqueda para ver resultados.</p>
          )}

          {!loading && !error && resultados.length === 0 && total === 0 && (
            <p className="text-slate-500 text-center py-10">No se encontraron bienes con esos filtros.</p>
          )}
        </div>
      </div>

      {showScanModal && (
        <BarcodeScanModal
          onDetected={handleCodeScanned}
          onClose={() => setShowScanModal(false)}
        />
      )}

      <section className="mt-10 card p-6 space-y-3 max-w-xl mx-auto w-full lg:max-w-none">
        <h2 className="text-lg font-semibold text-slate-900">Descargar todos los bienes</h2>
        <p className="text-sm text-slate-600">
          Exporta el inventario completo en bloques de hasta 1000 registros (límite de Supabase) hasta cubrir
          todos los bienes.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => handleExportAll('csv')}
            disabled={exportingAll}
            className="btn-primary"
          >
            {exportingAll ? 'Preparando Excel…' : 'Descargar todo en Excel (CSV)'}
          </button>
          <button
            type="button"
            onClick={() => handleExportAll('json')}
            disabled={exportingAll}
            className="btn-secondary"
          >
            {exportingAll ? 'Preparando JSON…' : 'Descargar todo en JSON'}
          </button>
        </div>
      </section>
    </div>
  )
}
