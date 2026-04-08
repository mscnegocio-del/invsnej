import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useEffect, useState } from 'react'
import { listPasskeys } from '../lib/passkeysApi'
import { useWebAuthn } from '../hooks/useWebAuthn'

export function Home() {
  const { canEdit, isAdmin } = useAuth()
  const { isSupported } = useWebAuthn()
  const [passkeyCount, setPasskeyCount] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        const items = await listPasskeys()
        if (!cancelled) setPasskeyCount(items.filter((p) => !p.revoked_at).length)
      } catch {
        if (!cancelled) setPasskeyCount(null)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div>
      <h1 className="page-title">Sistema de inventario</h1>
      <p className="page-subtitle">Gestiona el inventario patrimonial escaneando códigos de barras o buscando por filtros.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/security"
          className="card flex flex-col gap-2 p-5 hover:shadow-md hover:border-indigo-200 transition-all duration-200 sm:col-span-2 lg:col-span-3"
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔐</span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Seguridad de acceso</h2>
              <p className="text-sm text-slate-600">
                {passkeyCount && passkeyCount > 0
                  ? `Tienes ${passkeyCount} passkey${passkeyCount > 1 ? 's' : ''} registrada${passkeyCount > 1 ? 's' : ''}.`
                  : isSupported
                    ? 'Activa una passkey para ingresar con huella, PIN o biometría.'
                    : 'Gestiona tu método de acceso y revisa el estado de tus passkeys.'}
              </p>
            </div>
          </div>
        </Link>

        {canEdit && (
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
        )}

        <Link
          to="/search"
          className={`card flex flex-col p-6 hover:shadow-md hover:border-teal-200 transition-all duration-200 group ${
            !canEdit ? 'sm:col-span-2 lg:col-span-3' : ''
          }`}
        >
          <span className="text-4xl mb-3">🔍</span>
          <h2 className="text-lg font-semibold text-slate-900 group-hover:text-teal-600 transition-colors">
            Buscar bienes
          </h2>
          <p className="text-slate-600 text-sm mt-1">
            Filtra por código, nombre del bien, responsable o ubicación
          </p>
        </Link>

        {isAdmin && (
          <>
            <Link
              to="/trabajadores"
              className="card flex flex-col p-6 hover:shadow-md hover:border-teal-200 transition-all duration-200 group"
            >
              <span className="text-4xl mb-3">👥</span>
              <h2 className="text-lg font-semibold text-slate-900 group-hover:text-teal-600 transition-colors">
                Trabajadores
              </h2>
              <p className="text-slate-600 text-sm mt-1">Responsables: cargo, sede y catálogo</p>
            </Link>
            <Link
              to="/admin"
              className="card flex flex-col p-6 hover:shadow-md hover:border-amber-200 transition-all duration-200 group sm:col-span-2 lg:col-span-1"
            >
              <span className="text-4xl mb-3">⚙️</span>
              <h2 className="text-lg font-semibold text-slate-900 group-hover:text-amber-600 transition-colors">
                Administración
              </h2>
              <p className="text-slate-600 text-sm mt-1">
                Carga SIGA PJ y gestión de usuarios
              </p>
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
