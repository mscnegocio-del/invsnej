import { startTransition, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export type SigaSugerencia = {
  descripcion: string
  marca: string | null
  modelo: string | null
  serie: string | null
  orden_compra: string | null
  valor: number | null
}

type Props = {
  value: string
  onChange: (val: string) => void
  onSelect: (row: SigaSugerencia) => void
  label?: string
}

const DEBOUNCE_MS = 300
const MIN_CHARS = 2
const MAX_RESULTS = 8

export function NombreSearchableInput({
  value,
  onChange,
  onSelect,
  label = 'Nombre / modelo del bien *',
}: Props) {
  const [sugerencias, setSugerencias] = useState<SigaSugerencia[]>([])
  const [open, setOpen] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [sinResultados, setSinResultados] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const trimmed = value.trim()
    if (trimmed.length < MIN_CHARS) {
      startTransition(() => {
        setSugerencias([])
        setSinResultados(false)
        setOpen(false)
      })
      return
    }

    debounceRef.current = setTimeout(async () => {
      setBuscando(true)
      const { data, error } = await supabase
        .from('siga_bienes')
        .select('descripcion, marca, modelo, serie, orden_compra, valor')
        .ilike('descripcion', `%${trimmed}%`)
        .limit(MAX_RESULTS)

      setBuscando(false)

      if (error) {
        console.error('Error buscando en siga_bienes:', error)
        return
      }

      const rows = (data ?? []) as SigaSugerencia[]
      setSugerencias(rows)
      setSinResultados(rows.length === 0)
      setOpen(true)
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value])

  const handleSelect = (row: SigaSugerencia) => {
    onChange(row.descripcion)
    onSelect(row)
    setOpen(false)
    setSugerencias([])
    setSinResultados(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="label" htmlFor="form-nombre">
        {label}
      </label>
      <div className="relative">
        <input
          id="form-nombre"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ej. Escritorio de oficina, Laptop Dell..."
          className="input pr-8"
          autoComplete="off"
        />
        {buscando && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className="size-4 animate-spin rounded-full border-2 border-teal-400 border-t-transparent block" />
          </span>
        )}
      </div>

      {open && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {sugerencias.map((row, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => handleSelect(row)}
                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-800"
              >
                {row.descripcion}
              </button>
            </li>
          ))}
          {sinResultados && (
            <li className="px-4 py-3 text-sm text-slate-500">
              Sin coincidencias en SIGA — se guardará el nombre ingresado
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
