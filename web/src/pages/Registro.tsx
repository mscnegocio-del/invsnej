import { useSearchParams } from 'react-router-dom'
import { BienForm } from '../components/BienForm'
import { Card, CardContent } from '../components/ui/card'

export function Registro() {
  const [searchParams] = useSearchParams()
  const codigo = searchParams.get('codigo') ?? undefined

  return (
    <div>
      <h1 className="page-title">Registrar bien</h1>
      <p className="page-subtitle">Completa la información del bien antes de guardarlo en el inventario.</p>

      <section className="mt-6">
        <Card>
          <CardContent className="pt-6">
            <BienForm initialCodigo={codigo} />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
