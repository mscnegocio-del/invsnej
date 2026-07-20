import { Link } from 'react-router-dom'
import { Hash, MapPin, User, Package, ListOrdered, Sigma, ChevronRight } from 'lucide-react'
import { Badge } from './ui/badge'
import { cn } from '../lib/utils'
import type { AgentCard } from '../hooks/useAIChat'

const ESTADO_STYLES: Record<string, string> = {
  Nuevo: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  Bueno: 'bg-green-500/15 text-green-600 dark:text-green-400',
  Regular: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  Malo: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  'Muy malo': 'bg-red-500/15 text-red-600 dark:text-red-400',
}

function EstadoBadge({ estado }: { estado?: string | null }) {
  if (!estado) return null
  return (
    <Badge variant="outline" className={cn('border-transparent text-[10px]', ESTADO_STYLES[estado])}>
      {estado}
    </Badge>
  )
}

function responsableDe(item: Record<string, unknown>): string | null {
  const t = item.trabajadores as { nombre?: string } | null | undefined
  return t?.nombre ?? null
}

function BienCard({ bien }: { bien: Record<string, unknown> }) {
  const responsable = responsableDe(bien)
  return (
    <Link
      to={`/bienes/${bien.id}`}
      className="block rounded-xl border border-border bg-card p-3 hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {String(bien.nombre_mueble_equipo ?? 'Bien')}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <Hash className="h-3 w-3 shrink-0" />
            {String(bien.codigo_patrimonial ?? '')}
          </p>
        </div>
        <EstadoBadge estado={bien.estado as string} />
      </div>
      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        {Boolean(bien.marca || bien.modelo) && (
          <p className="flex items-center gap-1.5">
            <Package className="h-3 w-3 shrink-0" />
            {[bien.marca, bien.modelo].filter(Boolean).map(String).join(' · ')}
          </p>
        )}
        {bien.ubicacion ? (
          <p className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 shrink-0" />
            {String(bien.ubicacion)}
          </p>
        ) : null}
        {responsable && (
          <p className="flex items-center gap-1.5">
            <User className="h-3 w-3 shrink-0" />
            {responsable}
          </p>
        )}
      </div>
      <p className="mt-2 text-[10px] text-primary flex items-center gap-0.5 font-medium">
        Ver detalle <ChevronRight className="h-3 w-3" />
      </p>
    </Link>
  )
}

function ListaCard({ payload }: { payload: { resultados: Record<string, unknown>[]; total: number } }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <ListOrdered className="h-3.5 w-3.5" />
        {payload.total} resultado{payload.total === 1 ? '' : 's'}
        {payload.total > payload.resultados.length && ` · mostrando ${payload.resultados.length}`}
      </div>
      <ul className="divide-y divide-border">
        {payload.resultados.map((item) => (
          <li key={String(item.id)}>
            <Link
              to={`/bienes/${item.id}`}
              className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground truncate">
                  {String(item.nombre_mueble_equipo ?? '')}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {String(item.codigo_patrimonial ?? '')}
                  {item.ubicacion ? ` · ${item.ubicacion}` : ''}
                  {responsableDe(item) ? ` · ${responsableDe(item)}` : ''}
                </p>
              </div>
              <EstadoBadge estado={item.estado as string} />
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ConteoCard({ payload }: { payload: { total: number; filtros: Record<string, unknown> } }) {
  const filtros = Object.entries(payload.filtros || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')
  return (
    <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        <Sigma className="h-5 w-5 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none text-foreground">{payload.total}</p>
        <p className="text-[11px] text-muted-foreground mt-1 truncate">
          {filtros.length > 0
            ? filtros.map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(' · ')
            : 'bienes en total'}
        </p>
      </div>
    </div>
  )
}

export function AgentCards({ cards }: { cards: AgentCard[] }) {
  if (cards.length === 0) return null
  return (
    <div className="space-y-2 w-full max-w-[85%]">
      {cards.map((card, i) => {
        if (card.tipo === 'bien') return <BienCard key={i} bien={card.payload} />
        if (card.tipo === 'lista') return <ListaCard key={i} payload={card.payload} />
        if (card.tipo === 'conteo') return <ConteoCard key={i} payload={card.payload} />
        return null
      })}
    </div>
  )
}
