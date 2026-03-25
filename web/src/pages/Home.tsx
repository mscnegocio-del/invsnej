import { Link } from 'react-router-dom'

export function Home() {
  return (
    <div>
      <h1 className="page-title">Sistema de inventario</h1>
      <p className="page-subtitle">Gestiona el inventario patrimonial escaneando códigos de barras o buscando por filtros.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          to="/scan"
          className="card flex flex-col p-6 hover:shadow-md hover:border-teal-200 transition-all duration-200 group"
        >
          <span className="text-4xl mb-3">📷</span>
          <h2 className="text-lg font-semibold text-slate-900 group-hover:text-teal-600 transition-colors">
            Registrar bien
          </h2>
          <p className="text-slate-600 text-sm mt-1">
            Abre la cámara para escanear o escribir el código manualmente
          </p>
        </Link>

        <Link
          to="/search"
          className="card flex flex-col p-6 hover:shadow-md hover:border-teal-200 transition-all duration-200 group"
        >
          <span className="text-4xl mb-3">🔍</span>
          <h2 className="text-lg font-semibold text-slate-900 group-hover:text-teal-600 transition-colors">
            Buscar bienes
          </h2>
          <p className="text-slate-600 text-sm mt-1">
            Filtra por código, responsable o ubicación
          </p>
        </Link>

        <Link
          to="/admin"
          className="card flex flex-col p-6 hover:shadow-md hover:border-amber-200 transition-all duration-200 group sm:col-span-2"
        >
          <span className="text-4xl mb-3">⚙️</span>
          <h2 className="text-lg font-semibold text-slate-900 group-hover:text-amber-600 transition-colors">
            Administración SIGA PJ
          </h2>
          <p className="text-slate-600 text-sm mt-1">
            Carga el Excel del SIGA PJ para pre-rellenar datos al registrar bienes
          </p>
        </Link>
      </div>
    </div>
  )
}
