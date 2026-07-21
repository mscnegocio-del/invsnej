import { useEffect, useState } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'
import { useTheme } from 'next-themes'
import {
  Home as HomeIcon,
  MapPin,
  Sun,
  Moon,
  LogOut,
  RefreshCw,
  ClipboardList,
  Bot,
  SearchIcon,
} from 'lucide-react'
import { useSede } from '../context/SedeContext'
import { useAuth } from '../context/AuthContext'
import { Button } from './ui/button'
import { cn } from '../lib/utils'
import { AIChatPanel } from './AIChatPanel'
import { CommandPalette } from './CommandPalette'

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
  const { sedeActiva, limpiarSede } = useSede()
  const { user, perfil, signOut } = useAuth()
  const [chatOpen, setChatOpen] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)

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

  const isHome = location.pathname === '/'
  const displayName = perfil?.nombre?.trim() || user?.email || 'Usuario'

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Barra superior única (móvil y escritorio): sin menú fijo, todo vive en Inicio ── */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border shrink-0">
        <div className="layout-shell py-3 flex items-center gap-2">
          {!isHome && (
            <Button asChild variant="ghost" size="sm" className="gap-1.5 px-2 shrink-0">
              <Link to="/">
                <HomeIcon className="h-4 w-4" />
                Inicio
              </Link>
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
            title="Ir a… / buscar (⌘K)"
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

        {/* Info de sede y usuario */}
        <div className="layout-shell pb-2 flex items-center gap-2 flex-wrap text-xs">
          {sedeActiva && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span className="truncate max-w-[160px]">{sedeActiva.nombre}</span>
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
          <span className={cn('text-muted-foreground truncate max-w-[160px]', !sedeActiva && 'ml-0')}>
            {displayName}
          </span>
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

      <main className="layout-main flex-1">
        <Outlet />
      </main>

      <AIChatPanel open={chatOpen} onOpenChange={setChatOpen} />
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  )
}
