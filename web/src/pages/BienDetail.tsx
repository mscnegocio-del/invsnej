import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Loader2, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useCatalogs } from '../context/CatalogContext'
import { useAuth } from '../context/AuthContext'
import type { BienDetalle, BienHistorial } from '../types'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Separator } from '../components/ui/separator'
import { Skeleton } from '../components/ui/skeleton'
import { Avatar, AvatarFallback } from '../components/ui/avatar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'

type EstadoVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'

function estadoBadgeVariant(estado: string): EstadoVariant {
  switch (estado.toLowerCase()) {
    case 'nuevo': return 'success'
    case 'bueno': return 'default'
    case 'regular': return 'warning'
    case 'malo':
    case 'muy malo': return 'destructive'
    default: return 'secondary'
  }
}

const ETIQUETA_CAMPO: Record<string, string> = {
  estado: 'Estado',
  responsable: 'Responsable',
  ubicacion: 'Ubicación',
  creacion: 'Alta',
  eliminacion: 'Baja',
}

export function BienDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { sedes, ubicaciones } = useCatalogs()
  const { user, canEdit, isAdmin } = useAuth()
  const [bien, setBien] = useState<BienDetalle | null>(null)
  const [historial, setHistorial] = useState<BienHistorial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function fetchBien() {
      setLoading(true)
      setError(null)

      const { data, error: supaError } = await supabase
        .from('bienes')
        .select(
          'id, codigo_patrimonial, nombre_mueble_equipo, tipo_mueble_equipo, estado, id_trabajador, ubicacion, fecha_registro, sede_id, marca, modelo, serie, orden_compra, valor, creado_por_email',
        )
        .eq('id', id)
        .is('eliminado_at', null)
        .maybeSingle()

      if (cancelled) return

      if (supaError) {
        console.error(supaError)
        setError('No se pudo cargar la información del bien.')
        setLoading(false)
        return
      }

      if (!data) {
        setError('No se encontró el bien solicitado.')
        setLoading(false)
        return
      }

      const raw = data as {
        id: number
        codigo_patrimonial: string
        nombre_mueble_equipo: string
        estado: string
        id_trabajador: number | null
        ubicacion: string | null
        fecha_registro: string | null
        sede_id: number | null
        marca: string | null
        modelo: string | null
        serie: string | null
        orden_compra: string | null
        valor: number | null
        creado_por_email: string | null
        tipo_mueble_equipo: string | null
      }

      let trabajadorNombre: string | null = null
      if (raw.id_trabajador) {
        const { data: trabajador, error: tErr } = await supabase
          .from('trabajadores')
          .select('nombre')
          .eq('id', raw.id_trabajador)
          .maybeSingle()
        if (!cancelled && !tErr && trabajador) {
          trabajadorNombre = trabajador.nombre as string
        }
      }

      if (cancelled) return

      setBien({
        id: raw.id,
        codigo_patrimonial: raw.codigo_patrimonial,
        nombre_mueble_equipo: raw.nombre_mueble_equipo,
        tipo_mueble_equipo: raw.tipo_mueble_equipo,
        estado: raw.estado,
        id_trabajador: raw.id_trabajador,
        ubicacion: raw.ubicacion,
        fecha_registro: raw.fecha_registro,
        trabajador_nombre: trabajadorNombre,
        sede_id: raw.sede_id,
        marca: raw.marca,
        modelo: raw.modelo,
        serie: raw.serie,
        orden_compra: raw.orden_compra,
        valor: raw.valor,
        creado_por_email: raw.creado_por_email,
      })

      const { data: historialData } = await supabase
        .from('bien_historial')
        .select('id, bien_id, campo, valor_antes, valor_despues, fecha, usuario_email, accion')
        .eq('bien_id', raw.id)
        .order('fecha', { ascending: false })
        .limit(30)

      if (!cancelled) setHistorial((historialData ?? []) as BienHistorial[])
      setLoading(false)
    }

    fetchBien()
    return () => { cancelled = true }
  }, [id])

  const ejecutarDelete = async () => {
    if (!id || !bien) return
    setDeleting(true)
    const { error: histErr } = await supabase.from('bien_historial').insert({
      bien_id: bien.id,
      campo: 'eliminacion',
      valor_antes: bien.nombre_mueble_equipo,
      valor_despues: null,
      usuario_id: user?.id ?? null,
      usuario_email: user?.email ?? null,
      accion: 'eliminacion',
    })
    if (histErr) {
      console.error(histErr)
      setDeleting(false)
      setError('No se pudo registrar la eliminación. Intenta nuevamente.')
      return
    }
    const { error: supaError } = await supabase
      .from('bienes')
      .update({ eliminado_at: new Date().toISOString() })
      .eq('id', id)
    setDeleting(false)
    if (supaError) {
      console.error(supaError)
      setError('No se pudo eliminar el bien. Intenta nuevamente.')
      return
    }
    navigate('/', { replace: true })
  }

  const sedeNombre = bien?.sede_id
    ? (sedes.find((s) => s.id === bien.sede_id)?.nombre ?? `Sede ${bien.sede_id}`)
    : null

  const ubicacionNombre = (() => {
    if (!bien?.ubicacion) return null
    const asNum = Number(bien.ubicacion)
    if (!Number.isNaN(asNum)) return ubicaciones.find((u) => u.id === asNum)?.nombre ?? bien.ubicacion
    return bien.ubicacion
  })()

  return (
    <div className="mx-auto w-full lg:max-w-4xl space-y-6">
      <h1 className="page-title">Detalle de bien</h1>

      {loading && (
        <Card>
          <CardContent className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-5 w-full" />)}
          </CardContent>
        </Card>
      )}

      {error && !loading && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {bien && !loading && (
        <>
          <Card>
            <CardContent className="p-0">
              <dl className="divide-y divide-border">
                {[
                  { term: 'Código patrimonial', value: <span className="font-mono text-sm">{bien.codigo_patrimonial}</span> },
                  { term: 'Nombre / descripción', value: bien.nombre_mueble_equipo },
                  { term: 'Estado', value: <Badge variant={estadoBadgeVariant(bien.estado)}>{bien.estado}</Badge> },
                  { term: 'Responsable', value: bien.trabajador_nombre || 'Sin responsable asignado' },
                  { term: 'Ubicación', value: ubicacionNombre || 'Sin ubicación registrada' },
                  { term: 'Sede', value: sedeNombre || 'Sin sede asignada' },
                  { term: 'Fecha de registro', value: bien.fecha_registro ? new Date(bien.fecha_registro).toLocaleString() : '—' },
                  { term: 'Registrado por', value: bien.creado_por_email || '—' },
                ].map(({ term, value }) => (
                  <div key={term} className="px-6 py-4 sm:grid sm:grid-cols-2 sm:gap-4">
                    <dt className="text-sm font-medium text-muted-foreground">{term}</dt>
                    <dd className="mt-1 text-foreground sm:mt-0">{value}</dd>
                  </div>
                ))}

                {(bien.marca || bien.modelo || bien.serie || bien.orden_compra || bien.valor != null) && (
                  <>
                    <div className="px-6 py-3 bg-amber-50/40 dark:bg-amber-950/20">
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                        Datos SIGA PJ
                      </p>
                    </div>
                    {[
                      { term: 'Marca', value: bien.marca },
                      { term: 'Modelo', value: bien.modelo },
                      { term: 'N° Serie', value: bien.serie },
                      { term: 'Orden de compra', value: bien.orden_compra },
                      { term: 'Valor', value: bien.valor != null ? `S/. ${bien.valor.toLocaleString()}` : null },
                    ]
                      .filter(({ value }) => value != null)
                      .map(({ term, value }) => (
                        <div key={term} className="px-6 py-4 sm:grid sm:grid-cols-2 sm:gap-4">
                          <dt className="text-sm font-medium text-muted-foreground">{term}</dt>
                          <dd className="mt-1 text-foreground sm:mt-0">{value}</dd>
                        </div>
                      ))}
                  </>
                )}
              </dl>

              <Separator />
              <div className="px-6 py-4 flex flex-wrap gap-3">
                {canEdit && (
                  <Button variant="secondary" onClick={() => navigate(`/bienes/${bien.id}/editar`)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                )}
                {isAdmin && (
                  <Button
                    variant="destructive"
                    disabled={deleting}
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    {deleting
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Eliminando…</>
                      : <><Trash2 className="h-4 w-4 mr-2" />Eliminar</>
                    }
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {historial.length > 0 && (
            <Card>
              <div className="px-6 py-3 border-b border-border">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Historial de cambios
                </h2>
              </div>
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  {historial.map((h) => {
                    const accion = h.accion ?? 'edicion'
                    const fecha = new Date(h.fecha).toLocaleString('es-PE', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })
                    const inicial = h.usuario_email ? h.usuario_email[0].toUpperCase() : '?'
                    return (
                      <li key={h.id} className="px-6 py-3 flex items-start gap-3">
                        <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                          <AvatarFallback className="text-[10px]">{inicial}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span
                              className="text-xs font-medium text-foreground truncate max-w-[200px]"
                              title={h.usuario_email ?? undefined}
                            >
                              {h.usuario_email ?? '—'}
                            </span>
                            <span className="text-xs text-muted-foreground shrink-0">{fecha}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">
                              {accion === 'creacion' ? 'Alta'
                                : accion === 'eliminacion' ? 'Baja'
                                : ETIQUETA_CAMPO[h.campo] ?? h.campo}
                            </span>
                            {accion !== 'creacion' && accion !== 'eliminacion' && (
                              <>
                                {' '}
                                <span className="text-muted-foreground/60">{h.valor_antes ?? '—'}</span>
                                <span className="mx-1">→</span>
                                <span className="font-medium text-foreground">{h.valor_despues ?? '—'}</span>
                              </>
                            )}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este bien?</AlertDialogTitle>
            <AlertDialogDescription>
              El bien con código{' '}
              <span className="font-mono font-semibold">{bien?.codigo_patrimonial}</span>{' '}
              quedará marcado como eliminado. Solo los administradores pueden ver bienes eliminados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void ejecutarDelete()}
            >
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
