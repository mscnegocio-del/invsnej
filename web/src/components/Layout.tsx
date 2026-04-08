import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom'
import { useSede } from '../context/SedeContext'
import { useAuth } from '../context/AuthContext'
import type { AppRole } from '../types'

const navItemsAll: { to: string; label: string; icon: string; roles: AppRole[] }[] = [
  { to: '/', label: 'Inicio', icon: '🏠', roles: ['admin', 'operador', 'consulta'] },
  { to: '/scan', label: 'Escanear', icon: '📷', roles: ['admin', 'operador'] },
  { to: '/search', label: 'Buscar', icon: '🔍', roles: ['admin', 'operador', 'consulta'] },
  { to: '/trabajadores', label: 'Trabajadores', icon: '👥', roles: ['admin'] },
]

export function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { sedeActiva, limpiarSede } = useSede()
  const { user, perfil, signOut } = useAuth()
  const role = perfil?.app_role ?? 'consulta'
  const navItems = navItemsAll.filter((n) => n.roles.includes(role))
  const mainPaths = navItems.map((n) => n.to)
  const isMainPath = mainPaths.includes(location.pathname)
  const displayName = perfil?.nombre?.trim() || user?.email || 'Usuario'

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200/80 shrink-0">
        <div className="layout-shell py-3 sm:py-4 flex items-center gap-4">
          {!isMainPath && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center gap-1 text-slate-600 hover:text-slate-900 shrink-0
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded-lg"
            >
              ← Volver
            </button>
          )}
          <Link
            to="/"
            className="flex items-center gap-2 flex-1 min-w-0
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded-lg"
          >
            <span className="text-2xl shrink-0" aria-hidden>
              📋
            </span>
            <span className="font-bold text-lg text-slate-800 truncate">Inventario</span>
          </Link>
          <div className="hidden sm:flex items-center gap-2 text-sm shrink-0">
            {sedeActiva && (
              <>
                <span className="text-slate-600 truncate max-w-[140px] md:max-w-[200px]" title={sedeActiva.nombre}>
                  📍 {sedeActiva.nombre}
                </span>
                <button type="button" onClick={limpiarSede} className="btn-ghost text-xs px-2 py-1">
                  Cambiar
                </button>
              </>
            )}
            <span
              className="text-slate-500 truncate max-w-[120px] md:max-w-[180px]"
              title={user?.email ?? undefined}
            >
              {displayName}
            </span>
            <button type="button" onClick={() => void signOut()} className="btn-ghost text-xs px-2 py-1">
              Salir
            </button>
          </div>
        </div>
        <div className="layout-shell pb-2 sm:hidden flex items-center justify-between gap-2 flex-wrap">
          {sedeActiva && (
            <>
              <span className="text-xs text-slate-600 truncate pr-2">📍 {sedeActiva.nombre}</span>
              <button type="button" onClick={limpiarSede} className="btn-ghost text-xs px-2 py-1 shrink-0">
                Cambiar
              </button>
            </>
          )}
          <span className="text-xs text-slate-500 truncate">{displayName}</span>
          <button type="button" onClick={() => void signOut()} className="btn-ghost text-xs px-2 py-1 shrink-0">
            Salir
          </button>
        </div>

        {/* Navegación principal en escritorio (misma lógica que la barra inferior en móvil) */}
        <nav
          className="hidden md:block border-t border-slate-200/80"
          aria-label="Secciones principales"
        >
          <div className="layout-shell flex flex-wrap items-center gap-1 py-2">
            {navItems.map(({ to, label, icon }) => {
              const isActive = location.pathname === to
              return (
                <Link
                  key={to}
                  to={to}
                  aria-current={isActive ? 'page' : undefined}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2
                    ${isActive ? 'bg-teal-50 text-teal-800 ring-1 ring-teal-200/80' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                >
                  <span aria-hidden>{icon}</span>
                  {label}
                </Link>
              )
            })}
          </div>
        </nav>
      </header>

      <main className="layout-main">
        <Outlet />
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden
                   bg-white/95 backdrop-blur-sm border-t border-slate-200/80
                   safe-area-inset-bottom pb-[env(safe-area-inset-bottom)]"
        aria-label="Secciones principales"
      >
        <div className="layout-shell flex justify-around py-2">
          {navItems.map(({ to, label, icon }) => {
            const isActive = location.pathname === to
            return (
              <Link
                key={to}
                to={to}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 px-6 py-2 rounded-xl transition-colors
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2
                  ${isActive ? 'text-teal-600 bg-teal-50' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <span className="text-xl" aria-hidden>
                  {icon}
                </span>
                <span className="text-xs font-medium">{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
