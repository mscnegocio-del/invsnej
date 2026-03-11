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
    <div>
      <label className="label" htmlFor="trabajador-select">
        {label}
        {required ? ' *' : ''}
      </label>
      <select
        id="trabajador-select"
        value={value ?? ''}
        onChange={handleChange}
        disabled={loading || !!error}
        required={required}
        className={`input ${error ? 'input-error' : ''}`}
      >
        <option value="">{loading ? 'Cargando responsables...' : 'Seleccione un responsable'}</option>
        {trabajadores.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nombre}
          </option>
        ))}
      </select>
      {error && (
        <small className="mt-1 block text-red-600 text-sm">
          Error cargando responsables: {error}
        </small>
      )}
    </div>
  )
}
