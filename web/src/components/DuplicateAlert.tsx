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
    <section
      style={{
        marginTop: '1.5rem',
        padding: '1rem',
        borderRadius: '0.75rem',
        border: '1px solid #f97316',
        background: '#fff7ed',
      }}
    >
      <h2 style={{ marginTop: 0 }}>Bien ya registrado</h2>
      <p>
        El código <strong>{codigo}</strong> ya existe en el inventario.
      </p>
      <dl style={{ marginTop: '0.75rem' }}>
        <div>
          <dt style={{ fontWeight: 600 }}>Nombre / modelo</dt>
          <dd>{bien.nombre_mueble_equipo || 'Sin nombre registrado'}</dd>
        </div>
        <div>
          <dt style={{ fontWeight: 600 }}>Ubicación actual</dt>
          <dd>{bien.ubicacion || 'Sin ubicación registrada'}</dd>
        </div>
      </dl>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginTop: '1rem',
        }}
      >
        <button
          type="button"
          onClick={() => navigate(`/bienes/${bien.id}`)}
          style={{ padding: '0.5rem 1rem' }}
        >
          Ver detalle
        </button>
        <button
          type="button"
          onClick={() => navigate(`/bienes/${bien.id}/editar`)}
          style={{ padding: '0.5rem 1rem' }}
        >
          Editar
        </button>
        <button
          type="button"
          onClick={onRegisterAnother}
          style={{ padding: '0.5rem 1rem' }}
        >
          Registrar otro
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{ padding: '0.5rem 1rem', marginLeft: 'auto' }}
        >
          Cancelar
        </button>
      </div>
    </section>
  )
}

