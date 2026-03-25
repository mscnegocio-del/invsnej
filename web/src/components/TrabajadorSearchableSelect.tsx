import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
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
  const { trabajadores, loading, error, reload } = useCatalogs()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected =
    typeof value === 'number'
      ? trabajadores.find((t) => t.id === value)
      : undefined

  const queryNorm = query.trim().toUpperCase()

  const filtered = trabajadores.filter((t) =>
    t.nombre.toLowerCase().includes(query.trim().toLowerCase()),
  )

  // Mostrar "agregar" solo en modo selección (no en modo "todos"), cuando hay texto y sin resultados
  const puedeAgregar = !allowAll && queryNorm.length > 0 && filtered.length === 0

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
      setSaveError(null)
    },
    [onChange],
  )

  const handleAgregar = async () => {
    if (!queryNorm || saving) return
    setSaving(true)
    setSaveError(null)

    // Anti-duplicado: si ya existe en el catálogo cargado, seleccionar en lugar de insertar
    const existente = trabajadores.find((t) => t.nombre === queryNorm)
    if (existente) {
      handleSelect(existente.id)
      setSaving(false)
      return
    }

    const { data, error: insertError } = await supabase
      .from('trabajadores')
      .insert({ nombre: queryNorm })
      .select('id')
      .maybeSingle()

    if (insertError || !data) {
      console.error(insertError)
      setSaveError('No se pudo agregar el responsable. Intenta nuevamente.')
      setSaving(false)
      return
    }

    // Refrescar catálogo para que el nuevo responsable aparezca en todos los selectores
    reload()
    handleSelect((data as { id: number }).id)
    setSaving(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="label">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={open ? query : (selected?.nombre ?? (allowAll && (value === '' || value === null) ? 'Todos' : ''))}
          onChange={(e) => {
            setQuery(e.target.value)
            setSaveError(null)
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
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
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
          {filtered.length === 0 && !puedeAgregar && (
            <li className="px-4 py-3 text-sm text-slate-500">No hay resultados</li>
          )}
          {filtered.map((t) => (
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
          ))}
          {puedeAgregar && (
            <li className="border-t border-slate-100">
              <button
                type="button"
                onClick={handleAgregar}
                disabled={saving}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <span className="size-3 shrink-0 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
                    Guardando...
                  </>
                ) : (
                  `+ Agregar "${queryNorm}"`
                )}
              </button>
            </li>
          )}
        </ul>
      )}

      {saveError && (
        <small className="mt-1 block text-sm text-red-600">{saveError}</small>
      )}
      {error && (
        <small className="mt-1 block text-sm text-red-600">
          Error cargando responsables: {error}
        </small>
      )}
    </div>
  )
}
