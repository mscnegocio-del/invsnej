import type { ChangeEvent } from 'react'
import { useCatalogs } from '../context/CatalogContext'

type Props = {
  value: number | null
  onChange: (value: number | null) => void
  label?: string
  required?: boolean
}

export function TrabajadorSelect({ value, onChange, label = 'Responsable', required }: Props) {
  const { trabajadores, loading, error } = useCatalogs()

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
        <option value="">{loading ? 'Cargando responsables...' : 'Seleccione un responsable'}</option>
        {trabajadores.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nombre}
          </option>
        ))}
      </select>
      {error ? (
        <small style={{ color: 'red' }}>Error cargando responsables: {error}</small>
      ) : null}
    </div>
  )
}

