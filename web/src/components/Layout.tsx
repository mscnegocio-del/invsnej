import { useEffect, useState } from 'react'
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom'
import { useTheme } from 'next-themes'
import {
  Home,
  ScanLine,
  Search,
  Users,
  Shield,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Sun,
  Moon,
  LogOut,
  RefreshCw,
  ClipboardList,
  Bot,
  Database,
  SearchIcon,
} from 'lucide-react'
import { useSede } from '../context/SedeContext'
import { useAuth } from '../context/AuthContext'
import { Button } from './ui/button'
import { Separator } from './ui/separator'
import { cn } from '../lib/utils'
import type { AppRole } from '../types'
import { AIChatPanel } from './AIChatPanel'
import { CommandPalette } from './CommandPalette'

const navItemsAll: {
  to: string
  label: string
  Icon: React.ComponentType<{ className?: string }>
  roles: AppRole[]
}[] = [
  { to: '/', label: 'Inicio', Icon: Home, roles: ['admin', 'operador', 'consulta'] },
  { to: '/scan', label: 'Escanear', Icon: ScanLine, roles: ['admin', 'operador'] },
  { to: '/search', label: 'Buscar', Icon: Search, roles: ['admin', 'operador', 'consulta'] },
  { to: '/siga-pj', label: 'SIGA PJ', Icon: Database, roles: ['admin', 'operador', 'consulta'] },
  { to: '/trabajadores', label: 'Trabajadores', Icon: Users, roles: ['admin'] },
  { to: '/admin', label: 'Administración', Icon: Shield, roles: ['admin'] },
]

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="shrink-0"
      title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      {theme === 'dark' ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  )
}

export function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { sedeActiva, limpiarSede } = useSede()
  const { user, perfil, signOut } = useAuth()
  const [chatOpen, setChatOpen] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('sidebar_collapsed') === 'true' } catch { return false }
  })

  useEffect(() => {
    try { localStorage.setItem('sidebar_collapsed', String(sidebarCollapsed)) } catch { /* noop */ }
  }, [sidebarCollapsed])

  // Atajo ⌘K / Ctrl+K para abrir CommandPalette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
  const role = perfil?.app_role ?? 'consulta'
  const navItems = navItemsAll.filter((n) => n.roles.includes(role))
  const mainPaths = navItems.map((n) => n.to)
  const isMainPath = mainPaths.includes(location.pathname)
  const displayName = perfil?.nombre?.trim() || user?.email || 'Usuario'
  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()

  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Sidebar (md+) ── */}
      <aside className={cn(
        'hidden md:flex flex-col border-r border-border bg-sidebar shrink-0 fixed inset-y-0 left-0 z-30',
        'transition-[width] duration-200 ease-in-out',
        sidebarCollapsed ? 'w-14' : 'w-64'
      )}>
        {/* Contenido interno con overflow-hidden para evitar derrame durante transición */}
        <div className="flex flex-col flex-1 overflow-hidden min-h-0">
        {/* Logo */}
        <div className={cn(
          'flex items-center border-b border-sidebar-border',
          sidebarCollapsed ? 'justify-center px-0 py-5' : 'gap-3 px-5 py-5'
        )}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-sm text-sidebar-foreground leading-none">Inventario</p>
                <span className="inline-flex items-center rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Beta</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">Bienes patrimoniales</p>
            </div>
          )}
        </div>

        {/* Sede activa */}
        {sedeActiva && !sidebarCollapsed && (
          <div className="px-4 py-3 mx-3 mt-3 rounded-xl bg-primary/5 border border-primary/10">
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-xs font-medium text-primary truncate flex-1">{sedeActiva.nombre}</span>
              <button
                type="button"
                onClick={limpiarSede}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Cambiar sede"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-1" aria-label="Navegación principal">
          {navItems.map(({ to, label, Icon }) => {
            const isActive = location.pathname === to
            return (
              <Link
                key={to}
                to={to}
                title={sidebarCollapsed ? label : undefined}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  sidebarCollapsed ? 'justify-center gap-0' : 'gap-3',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!sidebarCollapsed && label}
              </Link>
            )
          })}
        </nav>

        <Separator />

        {/* Footer sidebar */}
        <div className="px-2 py-4 space-y-2">
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold" title={displayName}>
                {initials}
              </div>
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCmdOpen(true)}
                className="shrink-0 text-muted-foreground hover:text-primary"
                title="Búsqueda rápida (⌘K)"
              >
                <SearchIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setChatOpen(true)}
                className="shrink-0 text-muted-foreground hover:text-primary"
                title="Asistente IA"
              >
                <Bot className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void signOut()}
                className="shrink-0 text-muted-foreground hover:text-destructive"
                title="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-muted/50">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <ThemeToggle />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCmdOpen(true)}
                  className="shrink-0 text-muted-foreground hover:text-primary"
                  title="Búsqueda rápida (⌘K)"
                >
                  <SearchIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setChatOpen(true)}
                  className="shrink-0 text-muted-foreground hover:text-primary"
                  title="Asistente IA"
                >
                  <Bot className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 justify-start gap-2 text-muted-foreground hover:text-destructive"
                  onClick={() => void signOut()}
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </Button>
              </div>
            </>
          )}
        </div>

        </div>{/* fin contenido interno */}

        {/* Botón toggle colapsar/expandir */}
        <button
          type="button"
          onClick={() => setSidebarCollapsed(v => !v)}
          className="absolute bottom-4 -right-3 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background shadow-sm text-muted-foreground hover:text-foreground transition-colors z-10"
          title={sidebarCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          {sidebarCollapsed
            ? <ChevronRight className="h-3.5 w-3.5" />
            : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </aside>

      {/* ── Contenido principal (md+: offset sidebar) ── */}
      <div className={cn(
        'flex flex-col flex-1 min-h-screen transition-all duration-200 ease-in-out',
        sidebarCollapsed ? 'md:ml-14' : 'md:ml-64'
      )}>
        {/* Header móvil */}
        <header className="md:hidden sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border shrink-0">
          <div className="layout-shell py-3 flex items-center gap-3">
            {!isMainPath && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                className="gap-1 px-2 shrink-0"
              >
                <ChevronLeft className="h-4 w-4" />
                Volver
              </Button>
            )}
            <Link to="/" className="flex items-center gap-2 flex-1 min-w-0">
              <ClipboardList className="h-5 w-5 text-primary shrink-0" />
              <span className="font-bold text-base text-foreground truncate">Inventario</span>
              <span className="inline-flex items-center rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 shrink-0">Beta</span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCmdOpen(true)}
              className="shrink-0 text-muted-foreground hover:text-primary"
              title="Búsqueda rápida (⌘K)"
            >
              <SearchIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setChatOpen(true)}
              className="shrink-0 text-muted-foreground hover:text-primary"
              title="Asistente IA"
            >
              <Bot className="h-4 w-4" />
            </Button>
            <ThemeToggle />
          </div>

          {/* Info de sede y usuario en móvil */}
          <div className="layout-shell pb-2 flex items-center gap-2 flex-wrap text-xs">
            {sedeActiva && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span className="truncate max-w-[120px]">{sedeActiva.nombre}</span>
                <button
                  type="button"
                  onClick={limpiarSede}
                  className="hover:text-foreground transition-colors ml-1"
                  title="Cambiar sede"
                >
                  <RefreshCw className="h-3 w-3" />
                </button>
              </span>
            )}
            <span className="text-muted-foreground truncate max-w-[120px]">{displayName}</span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="text-muted-foreground hover:text-destructive transition-colors ml-auto flex items-center gap-1"
            >
              <LogOut className="h-3 w-3" />
              Salir
            </button>
          </div>
        </header>

        {/* Back button on desktop when not on main path */}
        {!isMainPath && (
          <div className="hidden md:block layout-shell pt-4 pb-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="gap-1 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              Volver
            </Button>
          </div>
        )}

        <main className="layout-main">
          <Outlet />
        </main>
      </div>

      {/* ── Bottom nav (móvil) ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-sm border-t border-border pb-[env(safe-area-inset-bottom)]"
        aria-label="Secciones principales"
      >
        <div className="layout-shell flex justify-around py-1">
          {navItems.map(({ to, label, Icon }) => {
            const isActive = location.pathname === to
            return (
              <Link
                key={to}
                to={to}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon
                  className={cn('h-5 w-5', isActive && 'stroke-[2.5px]')}
                  aria-hidden
                />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className={cn(
              'flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              chatOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Bot className={cn('h-5 w-5', chatOpen && 'stroke-[2.5px]')} aria-hidden />
            <span className="text-[10px] font-medium">IA</span>
          </button>
        </div>
      </nav>

      <AIChatPanel open={chatOpen} onOpenChange={setChatOpen} />
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  )
}
