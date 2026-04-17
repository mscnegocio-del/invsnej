import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { BienResumen } from '../types'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useCatalogs } from '../context/CatalogContext'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { TrabajadorSearchableSelect } from './TrabajadorSearchableSelect'
import { UbicacionSelect } from './UbicacionSelect'

type QuickEditTarget = {
  bien: BienResumen
  campo: 'estado' | 'responsable' | 'ubicacion'
} | null

type Props = {
  target: QuickEditTarget
  onClose: () => void
  onSaved: (bienId: number, updates: Partial<BienResumen>) => void
}

const ETIQUETA: Record<string, string> = {
  estado: 'Estado',
  responsable: 'Responsable',
  ubicacion: 'Ubicación',
}

const ESTADO_OPTIONS = ['Nuevo', 'Bueno', 'Regular', 'Malo', 'Muy malo']

export function QuickEditBienDialog({ target, onClose, onSaved }: Props) {
  const { user } = useAuth()
  const { trabajadores, ubicaciones } = useCatalogs()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Estados para cada campo
  const [nuevoEstado, setNuevoEstado] = useState(target?.bien.estado || '')
  const [nuevoIdTrabajador, setNuevoIdTrabajador] = useState<number | null | ''>(
    target?.bien.id_trabajador || ''
  )
  const [nuevoIdUbicacion, setNuevoIdUbicacion] = useState<number | null>(null)

  // Inicializar ubicación (nombre → id)
  if (target?.campo === 'ubicacion' && nuevoIdUbicacion === null) {
    if (target.bien.ubicacion) {
      const asNum = Number(target.bien.ubicacion)
      if (!Number.isNaN(asNum)) {
        const ubic = ubicaciones.find(u => u.id === asNum)
        setNuevoIdUbicacion(ubic?.id || null)
      } else {
        const ubic = ubicaciones.find(u => u.nombre === target.bien.ubicacion)
        setNuevoIdUbicacion(ubic?.id || null)
      }
    }
  }

  if (!target) {
    return null
  }

  const { bien, campo } = target

  async function handleGuardar() {
    if (loading) return
    setLoading(true)
    setError(null)

    try {
      let updateData: Record<string, unknown> = {}
      let valorAntes: string | null = null
      let valorDespues: string | null = null
      let updateKey = ''

      if (campo === 'estado') {
        if (nuevoEstado === bien.estado) {
          onClose()
          setLoading(false)
          return
        }
        updateData = { estado: nuevoEstado }
        updateKey = 'estado'
        valorAntes = bien.estado || null
        valorDespues = nuevoEstado
      } else if (campo === 'responsable') {
        if (nuevoIdTrabajador === bien.id_trabajador) {
          onClose()
          setLoading(false)
          return
        }
        updateData = { id_trabajador: nuevoIdTrabajador || null }
        updateKey = 'responsable'
        const nombreAntes = trabajadores.find(t => t.id === bien.id_trabajador)?.nombre ?? null
        const nombreDespues =
          typeof nuevoIdTrabajador === 'number'
            ? trabajadores.find(t => t.id === nuevoIdTrabajador)?.nombre ?? null
            : null
        valorAntes = nombreAntes
        valorDespues = nombreDespues
      } else if (campo === 'ubicacion') {
        const ubicacionAntes = bien.ubicacion
        const ubicacionDespues = nuevoIdUbicacion
          ? ubicaciones.find(u => u.id === nuevoIdUbicacion)?.nombre ?? null
          : null

        if (ubicacionAntes === ubicacionDespues) {
          onClose()
          setLoading(false)
          return
        }

        updateData = { ubicacion: ubicacionDespues }
        updateKey = 'ubicacion'
        valorAntes = ubicacionAntes || null
        valorDespues = ubicacionDespues
      }

      const { error: supaError } = await supabase
        .from('bienes')
        .update(updateData)
        .eq('id', bien.id)

      if (supaError) {
        setError('No se pudo actualizar el bien. Intenta nuevamente.')
        setLoading(false)
        return
      }

      // Registrar en bien_historial si hubo cambio
      if (valorAntes !== valorDespues) {
        await supabase.from('bien_historial').insert({
          bien_id: bien.id,
          campo: updateKey,
          valor_antes: valorAntes,
          valor_despues: valorDespues,
          usuario_id: user?.id ?? null,
          usuario_email: user?.email ?? null,
          accion: 'edicion',
        })
      }

      // Actualizar el bien local y cerrar
      const updates: Partial<BienResumen> = {}
      if (campo === 'estado') {
        updates.estado = nuevoEstado
      } else if (campo === 'responsable') {
        updates.id_trabajador = typeof nuevoIdTrabajador === 'number' ? nuevoIdTrabajador : null
      } else if (campo === 'ubicacion') {
        updates.ubicacion =
          nuevoIdUbicacion && ubicaciones.length > 0
            ? ubicaciones.find(u => u.id === nuevoIdUbicacion)?.nombre ?? null
            : null
      }

      onSaved(bien.id, updates)
      onClose()
    } catch (e) {
      setError('Error inesperado. Intenta nuevamente.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar {ETIQUETA[campo]}</DialogTitle>
          <DialogDescription className="text-xs">
            {bien.codigo_patrimonial} — {bien.nombre_mueble_equipo || 'Sin nombre'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {campo === 'estado' && (
            <div className="space-y-2">
              <Label htmlFor="estado-select">Estado</Label>
              <Select value={nuevoEstado} onValueChange={setNuevoEstado}>
                <SelectTrigger id="estado-select">
                  <SelectValue placeholder="Seleccione estado" />
                </SelectTrigger>
                <SelectContent>
                  {ESTADO_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
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
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleGuardar} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
