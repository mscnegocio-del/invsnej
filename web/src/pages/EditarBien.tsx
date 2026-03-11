import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { BienForm } from '../components/BienForm'

export function EditarBien() {
  const { id } = useParams()
  const [bienId, setBienId] = useState<number | null>(null)

  useEffect(() => {
    if (id) {
      const parsed = Number(id)
      if (!Number.isNaN(parsed)) {
        setBienId(parsed)
      }
    }
  }, [id])

  return (
    <div>
      <h1 className="page-title">Editar bien</h1>
      <p className="page-subtitle">Actualiza la información del bien seleccionado.</p>

      <section className="mt-6">
        <div className="card p-6">
          {bienId ? (
            <BienForm modo="edit" bienId={bienId} />
          ) : (
            <p className="text-red-600 rounded-xl bg-red-50 px-4 py-3">ID de bien no válido.</p>
          )}
        </div>
      </section>
    </div>
  )
}
