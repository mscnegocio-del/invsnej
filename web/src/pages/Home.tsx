import { Link } from 'react-router-dom'
import { Fingerprint, ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useEffect, useState } from 'react'
import { listPasskeys } from '../lib/passkeysApi'
import { useWebAuthn } from '../hooks/useWebAuthn'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { cn } from '../lib/utils'
import iconShield from '../assets/icons/menu/shield.png'
import iconCamera from '../assets/icons/menu/camera.png'
import iconMagnifyingGlass from '../assets/icons/menu/magnifying-glass.png'
import iconCardFileBox from '../assets/icons/menu/card-file-box.png'
import iconBustsInSilhouette from '../assets/icons/menu/busts-in-silhouette.png'
import iconGear from '../assets/icons/menu/gear.png'
import iconSparkles from '../assets/icons/menu/sparkles.png'

const SUGERENCIAS_HOME = [
  '¿Dónde está el bien con código...?',
  '¿Cuántas laptops hay en buen estado?',
  'Cambia el estado de un bien',
]

type NavCard = {
  to: string
  icon: string
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
      icon: iconShield,
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
      icon: iconCamera,
      title: 'Registrar bien',
      description: 'Escanea o escribe el código para registrar un activo.',
      accent: 'teal' as const,
    }] : []),
    {
      to: '/search',
      icon: iconMagnifyingGlass,
      title: 'Buscar bienes',
      description: 'Filtra por código, nombre, responsable o ubicación.',
      accent: 'teal',
    },
    {
      to: '/siga-pj',
      icon: iconCardFileBox,
      title: 'SIGA PJ',
      description: 'Catálogo de referencia cargado desde SIGA.',
      accent: 'teal',
      wide: !canEdit,
    },
    ...(isAdmin ? [
      { to: '/trabajadores', icon: iconBustsInSilhouette, title: 'Trabajadores', description: 'Gestiona responsables, cargos y sedes.', accent: 'teal' as const },
      { to: '/admin', icon: iconGear, title: 'Administración', description: 'Carga SIGA PJ y gestión de usuarios.', accent: 'amber' as const },
    ] : []),
  ]

  const accentClasses = {
    teal: 'group-hover:border-primary/40 group-hover:shadow-primary/10',
    amber: 'group-hover:border-amber-400/40 group-hover:shadow-amber-500/10',
    indigo: 'group-hover:border-indigo-400/40 group-hover:shadow-indigo-500/10',
  }

  return (
    <div>
      <h1 className="page-title">Sistema de inventario</h1>
      <p className="page-subtitle">
        Gestiona el inventario patrimonial escaneando códigos o buscando por filtros.
      </p>

      <Link to="/agente" className="group block mt-6">
        <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card transition-all duration-200 hover:shadow-md hover:border-primary/50">
          <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center">
              <img src={iconSparkles} alt="" className="h-14 w-14 object-contain drop-shadow-sm" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">Pregúntale al inventario</h2>
                <span className="inline-flex items-center rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Beta</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Habla o escribe y el Agente busca, cuenta y propone cambios por ti.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {SUGERENCIAS_HOME.map((s) => (
                  <span
                    key={s}
                    className="text-xs px-2.5 py-1 rounded-full bg-muted/60 text-muted-foreground"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1 text-sm font-medium text-primary shrink-0 self-start sm:self-center">
              Abrir Agente
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </div>
          </CardContent>
        </Card>
      </Link>

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
                <div className="flex h-14 w-14 shrink-0 items-center justify-center">
                  <img src={card.icon} alt="" className="h-12 w-12 object-contain drop-shadow-sm" />
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
