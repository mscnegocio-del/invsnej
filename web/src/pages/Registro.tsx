import { useSearchParams } from 'react-router-dom'
import { BienForm } from '../components/BienForm'

export function Registro() {
  const [searchParams] = useSearchParams()
  const codigo = searchParams.get('codigo') ?? undefined

  return (
    <main style={{ padding: '1.5rem' }}>
      <h1>Registrar bien</h1>
      <p>Completa la información del bien antes de guardarlo en el inventario.</p>

      <section style={{ marginTop: '1.5rem', maxWidth: 480 }}>
        <BienForm initialCodigo={codigo} />
      </section>
    </main>
  )
}

