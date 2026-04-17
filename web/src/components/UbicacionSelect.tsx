import { useCatalogs } from '../context/CatalogContext'
import { Label } from './ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'

type Props = {
  value: number | null
  onChange: (value: number | null) => void
  label?: string
  required?: boolean
}

export function UbicacionSelect({ value, onChange, label = 'Ubicación', required }: Props) {
  const { ubicaciones, loading, error } = useCatalogs()

  return (
    <div className="space-y-1.5">
      <Label htmlFor="ubicacion-select">
        {label}
        {required ? ' *' : ''}
      </Label>
      <Select
        value={value != null ? String(value) : ''}
        onValueChange={(v) => onChange(v ? Number(v) : null)}
        disabled={loading || !!error}
      >
        <SelectTrigger id="ubicacion-select">
          <SelectValue
            placeholder={loading ? 'Cargando ubicaciones…' : 'Seleccione una ubicación'}
          />
        </SelectTrigger>
        <SelectContent>
          {ubicaciones.map((u) => (
            <SelectItem key={u.id} value={String(u.id)}>
              {u.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p className="text-xs text-destructive">Error cargando ubicaciones: {error}</p>
      )}
    </div>
  )
}
