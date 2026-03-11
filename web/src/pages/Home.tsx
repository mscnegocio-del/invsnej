import { Link } from 'react-router-dom'

export function Home() {
  return (
    <main style={{ padding: '1.5rem' }}>
      <h1>Sistema de inventario</h1>
      <p>Selecciona una opción:</p>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
        <Link to="/scan">Escanear bien</Link>
        <Link to="/search">Buscar bienes</Link>
      </nav>
    </main>
  )
}

