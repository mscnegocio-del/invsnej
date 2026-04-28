import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, MapPin, User } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useCatalogs } from '../context/CatalogContext'
import { useSede } from '../context/SedeContext'
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from './ui/command'
import { Badge } from './ui/badge'
import { cn } from '../lib/utils'

type BienHit = {
  id: number
  codigo_patrimonial: string | null
  nombre_mueble_equipo: string | null
  estado: string | null
  marca: string | null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function estadoColor(estado: string | null): string {
  switch (estado) {
    case 'Nuevo': return 'success'
    case 'Bueno': return 'default'
    case 'Regular': return 'warning'
    case 'Malo': return 'destructive'
    case 'Muy malo': return 'destructive'
    default: return 'secondary'
  }
}

export function CommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate()
  const { trabajadores, ubicaciones } = useCatalogs()
  const { sedeActiva } = useSede()

  const [query, setQuery] = useState('')
  const [bienes, setBienes] = useState<BienHit[]>([])
  const [searching, setSearching] = useState(false)
  const reqRef = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Búsqueda de bienes con debounce — solo si query >= 2 chars
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const reqId = ++reqRef.current
      setSearching(true)

      const esc = q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
      let qy = supabase
        .from('bienes')
        .select('id, codigo_patrimonial, nombre_mueble_equipo, estado, marca')
        .is('eliminado_at', null)
        .or([
          `codigo_patrimonial.ilike.%${esc}%`,
          `nombre_mueble_equipo.ilike.%${esc}%`,
          `marca.ilike.%${esc}%`,
          `modelo.ilike.%${esc}%`,
          `serie.ilike.%${esc}%`,
        ].join(','))
        .limit(8)

      if (sedeActiva) qy = qy.eq('sede_id', sedeActiva.id)

      const { data } = await qy
      if (reqRef.current !== reqId) return
      setSearching(false)
      setBienes((data ?? []) as BienHit[])
    }, 250)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, sedeActiva])

  const q = query.trim().toLowerCase()
  const hasEnough = q.length >= 2

  // Derivar resultados visibles — si query < 2, mostramos vacío sin setState
  const visibleBienes = hasEnough ? bienes : []
  const filteredTrabajadores = hasEnough
    ? trabajadores.filter((t) => t.nombre?.toLowerCase().includes(q)).slice(0, 4)
    : []
  const filteredUbicaciones = hasEnough
    ? ubicaciones.filter((u) => u.nombre?.toLowerCase().includes(q)).slice(0, 4)
    : []

  const empty = !searching && visibleBienes.length === 0 && filteredTrabajadores.length === 0 && filteredUbicaciones.length === 0

  const handleSelectBien = (id: number) => {
    onOpenChange(false)
    navigate(`/bienes/${id}`)
  }

  const handleSelectTrabajador = (id: number) => {
    onOpenChange(false)
    navigate(`/search?trabajador=${id}`)
  }

  const handleSelectUbicacion = (nombre: string) => {
    onOpenChange(false)
    navigate(`/search?ubicacion=${encodeURIComponent(nombre)}`)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar bienes, responsables, ubicaciones…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {query.trim().length < 2 && (
          <CommandEmpty className="text-muted-foreground text-sm py-8">
            Escribe al menos 2 caracteres para buscar.
          </CommandEmpty>
        )}

        {query.trim().length >= 2 && searching && (
          <div className="py-6 text-center text-sm text-muted-foreground">Buscando…</div>
        )}

        {!searching && query.trim().length >= 2 && empty && (
          <CommandEmpty>Sin resultados para «{query.trim()}».</CommandEmpty>
        )}

        {visibleBienes.length > 0 && (
          <CommandGroup heading="Bienes">
            {visibleBienes.map((b) => (
              <CommandItem
                key={b.id}
                value={`bien-${b.id}-${b.codigo_patrimonial ?? ''}-${b.nombre_mueble_equipo ?? ''}`}
                onSelect={() => handleSelectBien(b.id)}
                className="gap-3 cursor-pointer"
              >
                <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className={cn('font-mono text-xs text-muted-foreground', !b.codigo_patrimonial && 'opacity-40')}>
                    {b.codigo_patrimonial ?? 'Sin código'}
                  </span>
                  <span className="text-sm truncate">
                    {b.nombre_mueble_equipo ?? 'Sin nombre'}
                    {b.marca && <span className="text-muted-foreground ml-1 text-xs">· {b.marca}</span>}
                  </span>
                </div>
                {b.estado && (
                  <Badge variant={estadoColor(b.estado) as Parameters<typeof Badge>[0]['variant']} className="shrink-0 text-xs">
                    {b.estado}
                  </Badge>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {filteredTrabajadores.length > 0 && visibleBienes.length > 0 && <CommandSeparator />}

        {filteredTrabajadores.length > 0 && (
          <CommandGroup heading="Responsables">
            {filteredTrabajadores.map((t) => (
              <CommandItem
                key={t.id}
                value={`trab-${t.id}-${t.nombre ?? ''}`}
                onSelect={() => handleSelectTrabajador(t.id)}
                className="gap-3 cursor-pointer"
              >
                <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm">{t.nombre}</span>
                <span className="ml-auto text-xs text-muted-foreground">Buscar bienes →</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {filteredUbicaciones.length > 0 && (filteredTrabajadores.length > 0 || visibleBienes.length > 0) && (
          <CommandSeparator />
        )}

        {filteredUbicaciones.length > 0 && (
          <CommandGroup heading="Ubicaciones">
            {filteredUbicaciones.map((u) => (
              <CommandItem
                key={u.id}
                value={`ubic-${u.id}-${u.nombre ?? ''}`}
                onSelect={() => handleSelectUbicacion(u.nombre ?? '')}
                className="gap-3 cursor-pointer"
              >
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm">{u.nombre}</span>
                <span className="ml-auto text-xs text-muted-foreground">Filtrar bienes →</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
