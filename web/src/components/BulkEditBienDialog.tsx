import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { BienResumen } from '../types'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useCatalogs } from '../context/CatalogContext'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { TrabajadorSearchableSelect } from './TrabajadorSearchableSelect'
import { UbicacionSelect } from './UbicacionSelect'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from './ui/alert-dialog'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from './ui/dialog'

type BulkEditPayload = {
  campo: 'estado' | 'responsable' | 'ubicacion'
  targets: BienResumen[]
} | null

type Props = {
  bulk: BulkEditPayload
  onClose: () => void
  onSaved: (ids: number[], updates: Partial<BienResumen>) => void
}

const ETIQUETA: Record<string, string> = {
  estado: 'Estado',
  responsable: 'Responsable',
  ubicacion: 'Ubicación',
}

const ESTADO_OPTIONS = ['Nuevo', 'Bueno', 'Regular', 'Malo', 'Muy malo']

export function BulkEditBienDialog({ bulk, onClose, onSaved }: Props) {
  const { user } = useAuth()
  const { trabajadores, ubicaciones } = useCatalogs()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const [nuevoEstado, setNuevoEstado] = useState('')
  const [nuevoIdTrabajador, setNuevoIdTrabajador] = useState<number | null | ''>('')
  const [nuevoIdUbicacion, setNuevoIdUbicacion] = useState<number | null>(null)

  useEffect(() => {
    if (!bulk) return
    setError(null)
    setNuevoEstado(ESTADO_OPTIONS[0])
    setNuevoIdTrabajador('')
    setNuevoIdUbicacion(null)
  }, [bulk])

  if (!bulk) return null
  const { campo, targets } = bulk
  const n = targets.length

  const handleGuardar = async () => {
    if (loading) return
    setLoading(true)
    setError(null)
    setShowConfirm(false)

    try {
      let updateData: Record<string, unknown> = {}
      let updates: Partial<BienResumen> = {}
      let valorDespues: string | null = null
      let updateKey = ''

      if (campo === 'estado') {
        updateData = { estado: nuevoEstado }
        updates = { estado: nuevoEstado }
        valorDespues = nuevoEstado
        updateKey = 'estado'
      } else if (campo === 'responsable') {
        updateData = { id_trabajador: nuevoIdTrabajador || null }
        updates = { id_trabajador: typeof nuevoIdTrabajador === 'number' ? nuevoIdTrabajador : null }
        valorDespues = typeof nuevoIdTrabajador === 'number'
          ? (trabajadores.find((t) => t.id === nuevoIdTrabajador)?.nombre ?? null)
          : null
        updateKey = 'responsable'
      } else if (campo === 'ubicacion') {
        const ubicNombre = nuevoIdUbicacion
          ? ubicaciones.find((u) => u.id === nuevoIdUbicacion)?.nombre ?? null
          : null
        updateData = { ubicacion: ubicNombre }
        updates = { ubicacion: ubicNombre }
        valorDespues = ubicNombre
        updateKey = 'ubicacion'
      }

      const ids = targets.map((b) => b.id)

      const { error: supaError } = await supabase
        .from('bienes')
        .update(updateData)
        .in('id', ids)

      if (supaError) {
        setError('No se pudo actualizar los bienes. Intenta nuevamente.')
        setLoading(false)
        return
      }

      // Registrar historial para cada bien
      const uid = user?.id ?? null
      const uemail = user?.email ?? null
      const historial = targets.map((b) => {
        let valorAntes: string | null = null
        if (campo === 'estado') valorAntes = b.estado ?? null
        else if (campo === 'responsable') {
          valorAntes = b.id_trabajador
            ? (trabajadores.find((t) => t.id === b.id_trabajador)?.nombre ?? null)
            : null
        } else if (campo === 'ubicacion') {
          const asNum = Number(b.ubicacion)
          valorAntes = !Number.isNaN(asNum) && b.ubicacion
            ? (ubicaciones.find((u) => u.id === asNum)?.nombre ?? b.ubicacion)
            : (b.ubicacion ?? null)
        }
        return {
          bien_id: b.id,
          campo: updateKey,
          valor_antes: valorAntes,
          valor_despues: valorDespues,
          usuario_id: uid,
          usuario_email: uemail,
          accion: 'edicion' as const,
        }
      })

      await supabase.from('bien_historial').insert(historial)

      onSaved(ids, updates)
    } catch (e) {
      setError('Error inesperado. Intenta nuevamente.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Dialog open={bulk !== null} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar {ETIQUETA[campo]} — {n} bien{n !== 1 ? 'es' : ''}</DialogTitle>
            <DialogDescription className="text-xs">
              El cambio se aplicará a los {n} bienes seleccionados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {campo === 'estado' && (
              <div className="space-y-2">
                <Label htmlFor="bulk-estado-select">Estado</Label>
                <Select value={nuevoEstado} onValueChange={setNuevoEstado}>
                  <SelectTrigger id="bulk-estado-select">
                    <SelectValue placeholder="Seleccione estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADO_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {campo === 'responsable' && (
              <div className="space-y-2">
                <TrabajadorSearchableSelect
                  value={nuevoIdTrabajador}
                  onChange={setNuevoIdTrabajador}
                  label="Responsable"
                />
              </div>
            )}

            {campo === 'ubicacion' && (
              <div className="space-y-2">
                <UbicacionSelect
                  value={nuevoIdUbicacion}
                  onChange={setNuevoIdUbicacion}
                  label="Ubicación"
                />
              </div>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button onClick={() => setShowConfirm(true)} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Aplicar a {n} bien{n !== 1 ? 'es' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar cambio masivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se actualizará <strong>{ETIQUETA[campo].toLowerCase()}</strong> en{' '}
              <strong>{n} bien{n !== 1 ? 'es' : ''}</strong>. Esta acción se registrará en el historial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleGuardar()}>Sí, actualizar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
