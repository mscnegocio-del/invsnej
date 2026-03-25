import { useNavigate } from 'react-router-dom'
import type { BienResumen } from '../types'

type Props = {
  codigo: string
  bien: BienResumen
  /** Nombre de la sede donde está registrado si es distinta a la sede activa. null = misma sede o sin info de sede. */
  sedeOrigen?: string | null
  onRegisterAnother: () => void
  onCancel: () => void
}

export function DuplicateAlert({ codigo, bien, sedeOrigen, onRegisterAnother, onCancel }: Props) {
  const navigate = useNavigate()

  const esOtraSede = typeof sedeOrigen === 'string' && sedeOrigen.length > 0

  return (
    <section
      className={`mt-6 rounded-2xl border p-5 shadow-sm ${
        esOtraSede
          ? 'border-orange-300 bg-orange-50'
          : 'border-amber-200 bg-amber-50'
      }`}
    >
      <h2
        className={`text-lg font-semibold ${
          esOtraSede ? 'text-orange-900' : 'text-amber-900'
        }`}
      >
        {esOtraSede ? 'Bien registrado en otra sede' : 'Bien ya registrado'}
      </h2>

      <p className={`mt-2 text-sm ${esOtraSede ? 'text-orange-800' : 'text-amber-800'}`}>
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

      <dl className="mt-4 space-y-2">
        <div>
          <dt className={`text-sm font-medium ${esOtraSede ? 'text-orange-700' : 'text-amber-700'}`}>
            Nombre / modelo
          </dt>
          <dd className={esOtraSede ? 'text-orange-900' : 'text-amber-900'}>
            {bien.nombre_mueble_equipo || 'Sin nombre registrado'}
          </dd>
        </div>
        <div>
          <dt className={`text-sm font-medium ${esOtraSede ? 'text-orange-700' : 'text-amber-700'}`}>
            Ubicación actual
          </dt>
          <dd className={esOtraSede ? 'text-orange-900' : 'text-amber-900'}>
            {bien.ubicacion || 'Sin ubicación registrada'}
          </dd>
        </div>
        {esOtraSede && (
          <div>
            <dt className="text-sm font-medium text-orange-700">Sede de origen</dt>
            <dd className="text-orange-900 font-semibold">{sedeOrigen}</dd>
          </div>
        )}
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
