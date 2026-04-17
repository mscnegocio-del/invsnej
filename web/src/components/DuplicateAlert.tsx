import { useNavigate } from 'react-router-dom'
import { AlertTriangle, MapPin, Eye, Pencil, Plus, X } from 'lucide-react'
import { useCatalogs } from '../context/CatalogContext'
import { Button } from './ui/button'
import { Alert, AlertTitle, AlertDescription } from './ui/alert'
import type { BienResumen } from '../types'

type Props = {
  codigo: string
  bien: BienResumen
  sedeOrigen?: string | null
  onRegisterAnother: () => void
  onCancel: () => void
}

export function DuplicateAlert({ codigo, bien, sedeOrigen, onRegisterAnother, onCancel }: Props) {
  const navigate = useNavigate()
  const { ubicaciones } = useCatalogs()

  const esOtraSede = typeof sedeOrigen === 'string' && sedeOrigen.length > 0

  const ubicacionNombre = (() => {
    if (!bien.ubicacion) return null
    const asNum = Number(bien.ubicacion)
    if (!Number.isNaN(asNum)) {
      return ubicaciones.find((u) => u.id === asNum)?.nombre ?? bien.ubicacion
    }
    return bien.ubicacion
  })()

  return (
    <Alert variant={esOtraSede ? 'destructive' : 'warning'} className="mt-6">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        {esOtraSede ? 'Bien registrado en otra sede' : 'Bien ya registrado'}
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p>
          {esOtraSede ? (
            <>
              El código <strong>{codigo}</strong> ya está registrado en la sede{' '}
              <strong>{sedeOrigen}</strong>. Verifica con el responsable antes de duplicarlo.
            </>
          ) : (
            <>
              El código <strong>{codigo}</strong> ya existe en el inventario de esta sede.
            </>
          )}
        </p>

        <dl className="space-y-1.5 text-sm">
          <div>
            <dt className="font-medium opacity-70">Nombre / modelo</dt>
            <dd className="font-semibold">{bien.nombre_mueble_equipo || 'Sin nombre registrado'}</dd>
          </div>
          <div>
            <dt className="font-medium opacity-70 flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Ubicación actual
            </dt>
            <dd className="font-semibold">{ubicacionNombre || 'Sin ubicación registrada'}</dd>
          </div>
          {esOtraSede && (
            <div>
              <dt className="font-medium opacity-70">Sede de origen</dt>
              <dd className="font-bold">{sedeOrigen}</dd>
            </div>
          )}
        </dl>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            onClick={() => navigate(`/bienes/${bien.id}`)}
            className="gap-1.5"
          >
            <Eye className="h-3.5 w-3.5" />
            Ver detalle
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/bienes/${bien.id}/editar`)}
            className="gap-1.5"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRegisterAnother}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Registrar otro
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="ml-auto gap-1.5"
          >
            <X className="h-3.5 w-3.5" />
            Cancelar
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
