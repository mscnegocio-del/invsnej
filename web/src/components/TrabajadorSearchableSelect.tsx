import { useCallback, useState } from 'react'
import { Check, ChevronsUpDown, Plus, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useCatalogs } from '../context/CatalogContext'
import { Button } from './ui/button'
import { Label } from './ui/label'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from './ui/command'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { cn } from '../lib/utils'

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

  const selected =
    typeof value === 'number'
      ? trabajadores.find((t) => t.id === value)
      : undefined

  const queryNorm = query.trim().toUpperCase()

  const filtered = query.trim()
    ? trabajadores.filter((t) =>
        t.nombre.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : trabajadores

  const puedeAgregar = !allowAll && queryNorm.length > 0 && filtered.length === 0

  const displayLabel = (() => {
    if (allowAll && (value === '' || value === null)) return 'Todos los responsables'
    if (selected) return selected.nombre
    return null
  })()

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

    const existente = trabajadores.find((t) => t.nombre === queryNorm)
    if (existente) {
      handleSelect(existente.id)
      setSaving(false)
      return
    }

    const { data, error: insertError } = await supabase
      .from('trabajadores')
      .insert({ nombre: queryNorm, sede_id: null, cargo: null })
      .select('id')
      .maybeSingle()

    if (insertError || !data) {
      setSaveError('No se pudo agregar el responsable. Intenta nuevamente.')
      setSaving(false)
      return
    }

    reload()
    handleSelect((data as { id: number }).id)
    setSaving(false)
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
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
              {displayLabel ?? (loading ? 'Cargando…' : 'Buscar responsable…')}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Buscar responsable…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>
                {puedeAgregar ? (
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 text-primary"
                    onClick={handleAgregar}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {saving ? 'Guardando…' : `Agregar "${queryNorm}"`}
                  </Button>
                ) : (
                  'No hay resultados'
                )}
              </CommandEmpty>
              <CommandGroup>
                {allowAll && (
                  <>
                    <CommandItem
                      value="__todos__"
                      onSelect={() => handleSelect('')}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          (value === '' || value === null) ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      Todos los responsables
                    </CommandItem>
                    <CommandSeparator />
                  </>
                )}
                {filtered.map((t) => (
                  <CommandItem
                    key={t.id}
                    value={t.nombre}
                    onSelect={() => handleSelect(t.id)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === t.id ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="flex-1">
                      <span className="block">{t.nombre}</span>
                      {t.cargo && (
                        <span className="block text-xs text-muted-foreground">{t.cargo}</span>
                      )}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {saveError && <p className="text-xs text-destructive">{saveError}</p>}
      {error && (
        <p className="text-xs text-destructive">Error cargando responsables: {error}</p>
      )}
    </div>
  )
}
