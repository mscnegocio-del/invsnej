import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Hash,
  MapPin,
  User,
  Package,
  ListOrdered,
  Sigma,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Loader2,
  PencilLine,
  PackagePlus,
} from 'lucide-react'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { cn } from '../lib/utils'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import type { AgentCard, CambioPropuesto, RegistroPropuesto } from '../hooks/useAIChat'
import iconLaptop from '../assets/icons/bienes/laptop.png'
import iconDesktopComputer from '../assets/icons/bienes/desktop-computer.png'
import iconPrinter from '../assets/icons/bienes/printer.png'
import iconFilmProjector from '../assets/icons/bienes/film-projector.png'
import iconChair from '../assets/icons/bienes/chair.png'
import iconTelevision from '../assets/icons/bienes/television.png'
import iconMobilePhone from '../assets/icons/bienes/mobile-phone.png'
import iconAutomobile from '../assets/icons/bienes/automobile.png'
import iconPackage from '../assets/icons/bienes/package.png'

// Coincide por palabra clave con los sinónimos de tipo que ya usa el
// SYSTEM_PROMPT de ai-chat (laptop/PC, impresora, proyector, silla,
// televisor, teléfono, vehículo). Sin match → ícono genérico de bien.
const TIPO_ICONOS: [RegExp, string][] = [
  [/laptop|port[aá]til|notebook/i, iconLaptop],
  [/impresora/i, iconPrinter],
  [/proyector/i, iconFilmProjector],
  [/\bsilla/i, iconChair],
  [/televisor|\btv\b/i, iconTelevision],
  [/tel[eé]fono|celular|smartphone/i, iconMobilePhone],
  [/veh[ií]culo|autom[oó]vil|\bauto\b|\bcarro\b/i, iconAutomobile],
  [/computadora|\bcpu\b|\btorre\b/i, iconDesktopComputer],
]

function iconoBien(...textos: (string | null | undefined)[]): string {
  const texto = textos.filter(Boolean).join(' ')
  return TIPO_ICONOS.find(([re]) => re.test(texto))?.[1] ?? iconPackage
}

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
  const icono = iconoBien(bien.nombre_mueble_equipo as string, bien.tipo_mueble_equipo as string)
  return (
    <Link
      to={`/bienes/${bien.id}`}
      className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-3 hover:bg-muted/50 transition-colors"
    >
      <img src={icono} alt="" className="h-9 w-9 shrink-0 object-contain" />
      <div className="flex-1 min-w-0">
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
      </div>
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
              <img
                src={iconoBien(item.nombre_mueble_equipo as string)}
                alt=""
                className="h-5 w-5 shrink-0 object-contain"
              />
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
  const tipoConsultado = [payload.filtros?.nombre, payload.filtros?.tipo].filter(Boolean).join(' ') as string
  return (
    <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        {tipoConsultado ? (
          <img src={iconoBien(tipoConsultado)} alt="" className="h-7 w-7 object-contain" />
        ) : (
          <Sigma className="h-5 w-5 text-primary" />
        )}
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

const CAMPO_LABEL: Record<string, string> = {
  estado: 'Estado',
  ubicacion: 'Ubicación',
  responsable: 'Responsable',
}

type ConfirmEstado = 'pendiente' | 'ejecutando' | 'aplicado' | 'cancelado' | 'error'

function ConfirmacionCard({
  payload,
}: {
  payload: { bien: Record<string, unknown>; cambios: CambioPropuesto[] }
}) {
  const { user, canEdit } = useAuth()
  const [estado, setEstado] = useState<ConfirmEstado>('pendiente')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const { bien, cambios } = payload

  const ejecutar = async () => {
    setEstado('ejecutando')
    setErrorMsg(null)
    try {
      const updateData = cambios.reduce(
        (acc, c) => ({ ...acc, ...c.update }),
        {} as Record<string, unknown>
      )
      const { error } = await supabase.from('bienes').update(updateData).eq('id', bien.id)
      if (error) throw new Error(error.message)

      for (const c of cambios) {
        await supabase.from('bien_historial').insert({
          bien_id: bien.id,
          campo: c.campo,
          valor_antes: c.valor_antes,
          valor_despues: c.valor_despues,
          usuario_id: user?.id ?? null,
          usuario_email: user?.email ?? null,
          accion: 'edicion',
        })
      }
      setEstado('aplicado')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Error inesperado')
      setEstado('error')
    }
  }

  return (
    <div
      className={cn(
        'rounded-xl border p-3 space-y-2',
        estado === 'aplicado'
          ? 'border-emerald-500/40 bg-emerald-500/5'
          : estado === 'cancelado'
            ? 'border-border bg-muted/30 opacity-70'
            : 'border-amber-500/40 bg-amber-500/5'
      )}
    >
      <div className="flex items-center gap-2">
        <PencilLine className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <p className="text-xs font-semibold text-foreground flex-1 min-w-0 truncate">
          Edición propuesta · {String(bien.codigo_patrimonial ?? '')}
        </p>
      </div>
      <p className="text-xs text-muted-foreground truncate">
        {String(bien.nombre_mueble_equipo ?? '')}
      </p>
      <ul className="space-y-1">
        {cambios.map((c) => (
          <li key={c.campo} className="flex items-center gap-1.5 text-xs">
            <span className="font-medium text-foreground shrink-0">{CAMPO_LABEL[c.campo] ?? c.campo}:</span>
            <span className="text-muted-foreground line-through truncate">{c.valor_antes ?? '—'}</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="font-medium text-foreground truncate">{c.valor_despues ?? '—'}</span>
          </li>
        ))}
      </ul>

      {estado === 'pendiente' && !canEdit && (
        <p className="text-[11px] text-muted-foreground">
          Tu rol es de consulta: no puedes aplicar ediciones.
        </p>
      )}

      {estado === 'pendiente' && canEdit && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" className="h-8 flex-1" onClick={() => void ejecutar()}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Confirmar
          </Button>
          <Button size="sm" variant="outline" className="h-8 flex-1" onClick={() => setEstado('cancelado')}>
            <XCircle className="h-3.5 w-3.5 mr-1" />
            Cancelar
          </Button>
        </div>
      )}

      {estado === 'ejecutando' && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Aplicando cambios…
        </p>
      )}
      {estado === 'aplicado' && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" /> Cambios aplicados y registrados en el historial
        </p>
      )}
      {estado === 'cancelado' && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <XCircle className="h-3.5 w-3.5" /> Edición cancelada — no se cambió nada
        </p>
      )}
      {estado === 'error' && (
        <div className="space-y-1.5">
          <p className="text-xs text-destructive">No se pudo aplicar: {errorMsg}</p>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void ejecutar()}>
            Reintentar
          </Button>
        </div>
      )}
    </div>
  )
}

function registroUrl(p: RegistroPropuesto, retorno: string): string {
  const params = new URLSearchParams()
  params.set('retorno', retorno)
  if (p.codigo) params.set('codigo', p.codigo)
  if (p.tipo) params.set('pre_tipo', p.tipo)
  if (p.estado) params.set('pre_estado', p.estado)
  if (p.id_trabajador != null) params.set('pre_trabajador', String(p.id_trabajador))
  if (p.id_ubicacion != null) params.set('pre_ubicacion', String(p.id_ubicacion))
  // Si el código coincidió en SIGA, los datos técnicos van como siga_* — igual que
  // el registro manual (Scan.tsx) — para que BienForm muestre el badge "Desde SIGA"
  // y priorice estos valores sobre cualquier otro dato.
  if (p.desde_siga) {
    params.set('siga_descripcion', p.nombre)
    if (p.marca) params.set('siga_marca', p.marca)
    if (p.modelo) params.set('siga_modelo', p.modelo)
    if (p.serie) params.set('siga_serie', p.serie)
    if (p.orden_compra) params.set('siga_oc', p.orden_compra)
    if (p.valor != null) params.set('siga_valor', String(p.valor))
  } else {
    params.set('pre_nombre', p.nombre)
    if (p.marca) params.set('pre_marca', p.marca)
    if (p.modelo) params.set('pre_modelo', p.modelo)
    if (p.serie) params.set('pre_serie', p.serie)
    if (p.orden_compra) params.set('pre_oc', p.orden_compra)
    if (p.valor != null) params.set('pre_valor', String(p.valor))
  }
  return `/registro?${params.toString()}`
}

function RegistroCard({ payload }: { payload: RegistroPropuesto }) {
  const { canEdit } = useAuth()
  const location = useLocation()
  const detalles: [string, string][] = []
  if (payload.codigo) detalles.push(['Código', payload.codigo])
  if (payload.tipo) detalles.push(['Tipo', payload.tipo])
  if (payload.estado) detalles.push(['Estado', payload.estado])
  if (payload.marca) detalles.push(['Marca', payload.marca])
  if (payload.modelo) detalles.push(['Modelo', payload.modelo])
  if (payload.serie) detalles.push(['N° Serie', payload.serie])
  if (payload.orden_compra) detalles.push(['Orden de compra', payload.orden_compra])
  if (payload.valor != null) detalles.push(['Valor', `S/. ${payload.valor}`])
  if (payload.nombre_responsable) detalles.push(['Responsable', payload.nombre_responsable])
  if (payload.ubicacion_nombre) detalles.push(['Ubicación', payload.ubicacion_nombre])

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <PackagePlus className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <p className="text-xs font-semibold text-foreground flex-1 min-w-0 truncate">
          Registro propuesto
        </p>
        {payload.desde_siga && (
          <Badge variant="warning" className="shrink-0">Desde SIGA</Badge>
        )}
      </div>
      <p className="text-sm font-medium text-foreground">{payload.nombre}</p>
      {detalles.length > 0 && (
        <ul className="space-y-0.5">
          {detalles.map(([label, valor]) => (
            <li key={label} className="flex items-center gap-1.5 text-xs">
              <span className="font-medium text-foreground shrink-0">{label}:</span>
              <span className="text-muted-foreground truncate">{valor}</span>
            </li>
          ))}
        </ul>
      )}
      {canEdit ? (
        <div className="pt-1 space-y-1">
          <Button asChild size="sm" className="h-8 w-full">
            <Link to={registroUrl(payload, location.pathname)}>
              <PackagePlus className="h-3.5 w-3.5 mr-1" />
              Abrir formulario prellenado
            </Link>
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">
            Revisa, completa lo que falte y guarda en el formulario
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Tu rol es de consulta: no puedes registrar bienes.
        </p>
      )}
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
        if (card.tipo === 'confirmacion') return <ConfirmacionCard key={i} payload={card.payload} />
        if (card.tipo === 'registro') return <RegistroCard key={i} payload={card.payload} />
        return null
      })}
    </div>
  )
}
