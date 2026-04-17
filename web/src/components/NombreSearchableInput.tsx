import { Loader2 } from 'lucide-react'
import { startTransition, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Popover, PopoverContent, PopoverAnchor } from './ui/popover'
import { cn } from '../lib/utils'

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      setOpen(rows.length > 0 || rows.length === 0)
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

  return (
    <div className="space-y-1.5">
      <Label htmlFor="form-nombre">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="relative">
            <Input
              id="form-nombre"
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
              placeholder="Ej. Escritorio de oficina, Laptop Dell…"
              autoComplete="off"
            />
            {buscando && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </span>
            )}
          </div>
        </PopoverAnchor>
        <PopoverContent
          className="p-1 w-[var(--radix-popover-trigger-width)]"
          onOpenAutoFocus={(e) => e.preventDefault()}
          align="start"
          sideOffset={4}
        >
          {sugerencias.length > 0 && (
            <ul className="max-h-56 overflow-y-auto">
              {sugerencias.map((row, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => handleSelect(row)}
                    className={cn(
                      'w-full rounded-lg px-3 py-2 text-left text-sm text-foreground',
                      'hover:bg-accent hover:text-accent-foreground transition-colors',
                    )}
                  >
                    {row.descripcion}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {sinResultados && (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              Sin coincidencias en SIGA — se guardará el nombre ingresado
            </p>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
