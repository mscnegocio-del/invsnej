import type { FormEvent } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { BienResumen } from '../types'
import { useCatalogs } from '../context/CatalogContext'

const PAGE_SIZE = 20

export function Search() {
  const navigate = useNavigate()
  const { trabajadores } = useCatalogs()

  const [codigo, setCodigo] = useState('')
  const [idTrabajador, setIdTrabajador] = useState<number | ''>('')
  const [textoUbicacion, setTextoUbicacion] = useState('')

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
    // Disparar búsqueda con la nueva página
    setTimeout(() => {
      void handleSearch()
    }, 0)
  }

  const handlePrevPage = () => {
    setPage((prev) => Math.max(0, prev - 1))
    setTimeout(() => {
      void handleSearch()
    }, 0)
  }

  const totalPages = total !== null ? Math.ceil(total / PAGE_SIZE) : null

  return (
    <main style={{ padding: '1.5rem' }}>
      <h1>Buscar bienes</h1>
      <p>Filtra por código, responsable o ubicación y navega al detalle del bien.</p>

      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          marginTop: '1rem',
          maxWidth: 480,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label>
            Código patrimonial
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ej. código exacto"
            />
          </label>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label>
            Responsable
            <select
              value={idTrabajador}
              onChange={(e) => {
                const v = e.target.value
                setIdTrabajador(v ? Number(v) : '')
              }}
            >
              <option value="">Todos</option>
              {trabajadores.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label>
            Ubicación (contiene)
            <input
              type="text"
              value={textoUbicacion}
              onChange={(e) => setTextoUbicacion(e.target.value)}
              placeholder="Texto parcial de ubicación"
            />
          </label>
        </div>

        <button type="submit" disabled={loading} style={{ padding: '0.5rem 1rem' }}>
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {error && (
        <p style={{ marginTop: '1rem', color: 'red' }}>
          {error}
        </p>
      )}

      {!loading && resultados.length > 0 && (
        <section style={{ marginTop: '1.5rem' }}>
          <h2>Resultados</h2>
          <p>
            Página {page + 1}
            {totalPages ? ` de ${totalPages}` : ''}{' '}
            {total !== null ? `(${total} bienes encontrados)` : ''}
          </p>

          <ul style={{ listStyle: 'none', padding: 0, marginTop: '0.75rem' }}>
            {resultados.map((b) => (
              <li
                key={b.id}
                style={{
                  padding: '0.75rem 0',
                  borderBottom: '1px solid #e5e7eb',
                  cursor: 'pointer',
                }}
                onClick={() => navigate(`/bienes/${b.id}`)}
              >
                <div style={{ fontWeight: 600 }}>{b.codigo_patrimonial}</div>
                <div>{b.nombre_mueble_equipo || 'Sin nombre'}</div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  {b.ubicacion || 'Sin ubicación'}{' '}
                  {b.id_trabajador ? `· Responsable ID ${b.id_trabajador}` : ''}
                </div>
              </li>
            ))}
          </ul>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={loading || page === 0}
              style={{ padding: '0.5rem 1rem' }}
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={handleNextPage}
              disabled={loading || (totalPages !== null && page + 1 >= totalPages)}
              style={{ padding: '0.5rem 1rem' }}
            >
              Siguiente
            </button>
          </div>
        </section>
      )}

      {!loading && !error && resultados.length === 0 && total === null && (
        <p style={{ marginTop: '1.5rem' }}>Realiza una búsqueda para ver resultados.</p>
      )}

      {!loading && !error && resultados.length === 0 && total === 0 && (
        <p style={{ marginTop: '1.5rem' }}>No se encontraron bienes con esos filtros.</p>
      )}
    </main>
  )
}

