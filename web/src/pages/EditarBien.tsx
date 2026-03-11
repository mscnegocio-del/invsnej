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
    <main style={{ padding: '1.5rem' }}>
      <h1>Editar bien</h1>
      <p>Actualiza la información del bien seleccionado.</p>

      <section style={{ marginTop: '1.5rem', maxWidth: 480 }}>
        {bienId ? (
          <BienForm modo="edit" bienId={bienId} />
        ) : (
          <p style={{ color: 'red' }}>ID de bien no válido.</p>
        )}
      </section>
    </main>
  )
}

