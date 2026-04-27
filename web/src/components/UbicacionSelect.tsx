import { useCallback, useState } from 'react'
import { Check, ChevronsUpDown, Plus, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useCatalogs } from '../context/CatalogContext'
import { useAuth } from '../context/AuthContext'
import { Button } from './ui/button'
import { Label } from './ui/label'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { cn } from '../lib/utils'

type Props = {
  value: number | null
  onChange: (value: number | null) => void
  label?: string
  required?: boolean
}

export function UbicacionSelect({ value, onChange, label = 'Ubicación', required }: Props) {
  const { ubicaciones, loading, error, reload } = useCatalogs()
  const { canEdit } = useAuth()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const selected = value != null ? ubicaciones.find((u) => u.id === value) : undefined

  const filtered = query.trim()
    ? ubicaciones.filter((u) =>
        u.nombre.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : ubicaciones

  const queryTrimmed = query.trim()
  const exactMatch = ubicaciones.some(
    (u) => u.nombre.toLowerCase() === queryTrimmed.toLowerCase(),
  )
  const puedeCrear = canEdit && queryTrimmed.length > 0 && !exactMatch && filtered.length === 0

  const handleSelect = useCallback(
    (id: number | null) => {
      onChange(id)
      setOpen(false)
      setQuery('')
      setSaveError(null)
    },
    [onChange],
  )

  const handleCrear = async () => {
    if (!queryTrimmed || saving) return
    setSaving(true)
    setSaveError(null)

    const { data, error: insertError } = await supabase
      .from('ubicaciones')
      .insert({ nombre: queryTrimmed })
      .select('id')
      .maybeSingle()

    if (insertError || !data) {
      setSaveError('No se pudo crear la ubicación. Intenta nuevamente.')
      setSaving(false)
      return
    }

    reload()
    handleSelect((data as { id: number }).id)
    setSaving(false)
  }

  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required ? ' *' : ''}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={loading || !!error}
            className="w-full justify-between font-normal"
          >
            <span className="truncate">
              {selected?.nombre ?? (loading ? 'Cargando…' : 'Buscar ubicación…')}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 z-50" align="start" sideOffset={8} avoidCollisions>
          <Command>
            <CommandInput
              placeholder="Buscar ubicación…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>
                {puedeCrear ? (
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 text-primary"
                    onClick={handleCrear}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {saving ? 'Guardando…' : `Crear "${queryTrimmed}"`}
                  </Button>
                ) : (
                  'No hay ubicaciones'
                )}
              </CommandEmpty>
              <CommandGroup>
                {filtered.map((u) => (
                  <CommandItem
                    key={u.id}
                    value={u.nombre}
                    onSelect={() => handleSelect(u.id)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === u.id ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    {u.nombre}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {saveError && <p className="text-xs text-destructive">{saveError}</p>}
      {error && (
        <p className="text-xs text-destructive">Error cargando ubicaciones: {error}</p>
      )}
    </div>
  )
}
