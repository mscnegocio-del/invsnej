import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Inicio', icon: '🏠' },
  { to: '/scan', label: 'Escanear', icon: '📷' },
  { to: '/search', label: 'Buscar', icon: '🔍' },
]

const mainPaths = ['/', '/scan', '/search']

export function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const isMainPath = mainPaths.includes(location.pathname)

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200/80 shrink-0">
        <div className="max-w-2xl mx-auto px-4 py-3 sm:py-4 flex items-center gap-4">
          {!isMainPath && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center gap-1 text-slate-600 hover:text-slate-900 shrink-0"
            >
              ← Volver
            </button>
          )}
          <Link to="/" className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-2xl shrink-0">📋</span>
            <span className="font-bold text-lg text-slate-800 truncate">Inventario</span>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 sm:py-8 pb-24 sm:pb-8">
        <Outlet />
      </main>

      {/* Bottom nav - solo en móvil */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden
                   bg-white/95 backdrop-blur-sm border-t border-slate-200/80
                   safe-area-inset-bottom pb-[env(safe-area-inset-bottom)]"
      >
        <div className="max-w-2xl mx-auto flex justify-around py-2">
          {navItems.map(({ to, label, icon }) => {
            const isActive = location.pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-col items-center gap-1 px-6 py-2 rounded-xl transition-colors
                  ${isActive ? 'text-teal-600 bg-teal-50' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <span className="text-xl">{icon}</span>
                <span className="text-xs font-medium">{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
