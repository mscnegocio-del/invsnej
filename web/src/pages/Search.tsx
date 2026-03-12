import type { FormEvent } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { BarcodeScanModal } from '../components/BarcodeScanModal'
import { TrabajadorSearchableSelect } from '../components/TrabajadorSearchableSelect'
import type { BienResumen } from '../types'
const PAGE_SIZE = 20

export function Search() {
  const navigate = useNavigate()

  const [codigo, setCodigo] = useState('')
  const [idTrabajador, setIdTrabajador] = useState<number | ''>('')
  const [textoUbicacion, setTextoUbicacion] = useState('')
  const [showScanModal, setShowScanModal] = useState(false)

  const [page, setPage] = useState(0)
  const [resultados, setResultados] = useState<BienResumen[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async (event?: FormEvent) => {
    if (event) event.preventDefault()
    setError(null)
    setLoading(true)

    let query = supabase
      .from('bienes')
      .select('id, codigo_patrimonial, nombre_mueble_equipo, id_trabajador, ubicacion', {
        count: 'exact',
      })

    if (codigo.trim()) {
      query = query.eq('codigo_patrimonial', codigo.trim())
    }

    if (idTrabajador !== '') {
      query = query.eq('id_trabajador', idTrabajador)
    }

    if (textoUbicacion.trim()) {
      query = query.ilike('ubicacion', `%${textoUbicacion.trim()}%`)
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

  return (
    <div>
      <h1 className="page-title">Buscar bienes</h1>
      <p className="page-subtitle">Filtra por código, responsable o ubicación y navega al detalle del bien.</p>

      <form onSubmit={handleSubmit} className="mt-6 card p-6 space-y-4 max-w-xl">
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

      {showScanModal && (
        <BarcodeScanModal
          onDetected={handleCodeScanned}
          onClose={() => setShowScanModal(false)}
        />
      )}

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</p>
      )}

      {!loading && resultados.length > 0 && (
        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Resultados</h2>
            <p className="text-sm text-slate-600">
              Página {page + 1}
              {totalPages ? ` de ${totalPages}` : ''}
              {total !== null ? ` · ${total} bienes` : ''}
            </p>
          </div>

          <ul className="space-y-0 divide-y divide-slate-200 card overflow-hidden">
            {resultados.map((b) => (
              <li
                key={b.id}
                onClick={() => navigate(`/bienes/${b.id}`)}
                className="px-4 py-4 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <div className="font-semibold text-slate-900">{b.codigo_patrimonial}</div>
                <div className="text-slate-600">{b.nombre_mueble_equipo || 'Sin nombre'}</div>
                <div className="text-sm text-slate-500 mt-0.5">
                  {b.ubicacion || 'Sin ubicación'}
                  {b.id_trabajador ? ` · Responsable ID ${b.id_trabajador}` : ''}
                </div>
              </li>
            ))}
          </ul>

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
        <p className="mt-8 text-slate-500 text-center py-8">Realiza una búsqueda para ver resultados.</p>
      )}

      {!loading && !error && resultados.length === 0 && total === 0 && (
        <p className="mt-8 text-slate-500 text-center py-8">No se encontraron bienes con esos filtros.</p>
      )}
    </div>
  )
}
