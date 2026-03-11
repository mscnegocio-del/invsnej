import type { ChangeEvent } from 'react'
import { useCatalogs } from '../context/CatalogContext'

type Props = {
  value: number | null
  onChange: (value: number | null) => void
  label?: string
  required?: boolean
}

export function UbicacionSelect({ value, onChange, label = 'Ubicación', required }: Props) {
  const { ubicaciones, loading, error } = useCatalogs()

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const v = event.target.value
    onChange(v ? Number(v) : null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <label>
        {label}
        {required ? ' *' : ''}
      </label>
      <select value={value ?? ''} onChange={handleChange} disabled={loading || !!error} required={required}>
        <option value="">{loading ? 'Cargando ubicaciones...' : 'Seleccione una ubicación'}</option>
        {ubicaciones.map((u) => (
          <option key={u.id} value={u.id}>
            {u.nombre}
          </option>
        ))}
      </select>
      {error ? (
        <small style={{ color: 'red' }}>Error cargando ubicaciones: {error}</small>
      ) : null}
    </div>
  )
}

