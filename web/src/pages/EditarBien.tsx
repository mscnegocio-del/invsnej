import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { BienForm } from '../components/BienForm'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Card, CardContent } from '../components/ui/card'

export function EditarBien() {
  const { id } = useParams()

  const bienId = useMemo(() => {
    if (!id) return null
    const parsed = Number(id)
    return Number.isNaN(parsed) ? null : parsed
  }, [id])

  return (
    <div>
      <h1 className="page-title">Editar bien</h1>
      <p className="page-subtitle">Actualiza la información del bien seleccionado.</p>

      <section className="mt-6">
        {bienId ? (
          <Card>
            <CardContent className="pt-6">
              <BienForm modo="edit" bienId={bienId} />
            </CardContent>
          </Card>
        ) : (
          <Alert variant="destructive">
            <AlertDescription>ID de bien no válido.</AlertDescription>
          </Alert>
        )}
      </section>
    </div>
  )
}
