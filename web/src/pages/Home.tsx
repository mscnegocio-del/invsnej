import { Link } from 'react-router-dom'
import { ScanLine, Search, Users, Settings, ShieldCheck, Fingerprint } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useEffect, useState } from 'react'
import { listPasskeys } from '../lib/passkeysApi'
import { useWebAuthn } from '../hooks/useWebAuthn'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { cn } from '../lib/utils'

type NavCard = {
  to: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  accent: 'teal' | 'amber' | 'indigo'
  wide?: boolean
}

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
    return () => { cancelled = true }
  }, [])

  const cards: NavCard[] = [
    {
      to: '/security',
      icon: ShieldCheck,
      title: 'Seguridad de acceso',
      description: passkeyCount && passkeyCount > 0
        ? `Tienes ${passkeyCount} passkey${passkeyCount > 1 ? 's' : ''} activa${passkeyCount > 1 ? 's' : ''}.`
        : isSupported
          ? 'Activa una passkey para acceso biométrico.'
          : 'Gestiona tu método de acceso.',
      accent: 'indigo',
      wide: true,
    },
    ...(canEdit ? [{
      to: '/scan',
      icon: ScanLine,
      title: 'Registrar bien',
      description: 'Escanea o escribe el código para registrar un activo.',
      accent: 'teal' as const,
    }] : []),
    {
      to: '/search',
      icon: Search,
      title: 'Buscar bienes',
      description: 'Filtra por código, nombre, responsable o ubicación.',
      accent: 'teal',
      wide: !canEdit,
    },
    ...(isAdmin ? [
      { to: '/trabajadores', icon: Users, title: 'Trabajadores', description: 'Gestiona responsables, cargos y sedes.', accent: 'teal' as const },
      { to: '/admin', icon: Settings, title: 'Administración', description: 'Carga SIGA PJ y gestión de usuarios.', accent: 'amber' as const },
    ] : []),
  ]

  const accentClasses = {
    teal: 'group-hover:border-primary/40 group-hover:shadow-primary/10',
    amber: 'group-hover:border-amber-400/40 group-hover:shadow-amber-500/10',
    indigo: 'group-hover:border-indigo-400/40 group-hover:shadow-indigo-500/10',
  }

  const iconBgClasses = {
    teal: 'bg-primary/10 text-primary',
    amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    indigo: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
  }

  return (
    <div>
      <h1 className="page-title">Sistema de inventario</h1>
      <p className="page-subtitle">
        Gestiona el inventario patrimonial escaneando códigos o buscando por filtros.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className={cn(
              'group block',
              card.wide && 'sm:col-span-2 lg:col-span-3',
            )}
          >
            <Card className={cn(
              'h-full transition-all duration-200 hover:shadow-md',
              accentClasses[card.accent],
            )}>
              <CardContent className="p-6 flex items-start gap-4">
                <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', iconBgClasses[card.accent])}>
                  <card.icon className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-foreground">{card.title}</h2>
                    {card.to === '/security' && passkeyCount !== null && passkeyCount > 0 && (
                      <Badge variant="success" className="text-xs">{passkeyCount} activa{passkeyCount > 1 ? 's' : ''}</Badge>
                    )}
                    {card.to === '/security' && isSupported && (passkeyCount === 0 || passkeyCount === null) && (
                      <Fingerprint className="h-4 w-4 text-indigo-500 opacity-60" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{card.description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
