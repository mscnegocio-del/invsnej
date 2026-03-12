import { useCallback, useEffect, useRef, useState } from 'react'
import { useCatalogs } from '../context/CatalogContext'

type Props = {
  value: number | null | ''
  onChange: (value: number | null | '') => void
  label?: string
  allowAll?: boolean
}

export function TrabajadorSearchableSelect({
  value,
  onChange,
  label = 'Responsable',
  allowAll = false,
}: Props) {
  const { trabajadores, loading, error } = useCatalogs()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const selected =
    typeof value === 'number'
      ? trabajadores.find((t) => t.id === value)
      : undefined

  const filtered = trabajadores.filter((t) =>
    t.nombre.toLowerCase().includes(query.trim().toLowerCase()),
  )

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = useCallback(
    (id: number | null | '') => {
      onChange(id)
      setOpen(false)
      setQuery('')
    },
    [onChange],
  )

  return (
    <div ref={containerRef} className="relative">
      <label className="label">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={open ? query : (selected?.nombre ?? (allowAll && (value === '' || value === null) ? 'Todos' : ''))}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!open) setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={allowAll ? 'Todos los responsables' : 'Buscar responsable...'}
          disabled={loading || !!error}
          className={`input pr-10 ${error ? 'input-error' : ''}`}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          tabIndex={-1}
        >
          {open ? '▲' : '▼'}
        </button>
      </div>

      {open && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {allowAll && (
            <li>
              <button
                type="button"
                onClick={() => handleSelect('')}
                className="w-full px-4 py-2 text-left text-slate-700 hover:bg-slate-50"
              >
                Todos
              </button>
            </li>
          )}
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-slate-500">No hay resultados</li>
          ) : (
            filtered.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(t.id)}
                  className={`w-full px-4 py-2 text-left hover:bg-slate-50 ${
                    value === t.id ? 'bg-teal-50 text-teal-700' : 'text-slate-700'
                  }`}
                >
                  {t.nombre}
                </button>
              </li>
            ))
          )}
        </ul>
      )}

      {error && (
        <small className="mt-1 block text-red-600 text-sm">
          Error cargando responsables: {error}
        </small>
      )}
    </div>
  )
}
