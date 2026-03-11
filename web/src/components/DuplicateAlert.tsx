import { useNavigate } from 'react-router-dom'
import type { BienResumen } from '../types'

type Props = {
  codigo: string
  bien: BienResumen
  onRegisterAnother: () => void
  onCancel: () => void
}

export function DuplicateAlert({ codigo, bien, onRegisterAnother, onCancel }: Props) {
  const navigate = useNavigate()

  return (
    <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-amber-900">Bien ya registrado</h2>
      <p className="mt-2 text-amber-800">
        El código <strong>{codigo}</strong> ya existe en el inventario.
      </p>
      <dl className="mt-4 space-y-2">
        <div>
          <dt className="text-sm font-medium text-amber-700">Nombre / modelo</dt>
          <dd className="text-amber-900">{bien.nombre_mueble_equipo || 'Sin nombre registrado'}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-amber-700">Ubicación actual</dt>
          <dd className="text-amber-900">{bien.ubicacion || 'Sin ubicación registrada'}</dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => navigate(`/bienes/${bien.id}`)}
          className="btn-primary"
        >
          Ver detalle
        </button>
        <button
          type="button"
          onClick={() => navigate(`/bienes/${bien.id}/editar`)}
          className="btn-secondary"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={onRegisterAnother}
          className="btn-ghost"
        >
          Registrar otro
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn-ghost ml-auto"
        >
          Cancelar
        </button>
      </div>
    </section>
  )
}
