import {
  ScanLine,
  Search,
  Sparkles,
  Database,
  Users,
  Shield,
  ShieldCheck,
} from 'lucide-react'
import type { AppRole } from '../types'

export type NavSection = {
  to: string
  label: string
  Icon: React.ComponentType<{ className?: string }>
  roles: AppRole[]
}

// Fuente única de "secciones" de la app, ahora que no hay sidebar/menú fijo.
// Usado por CommandPalette (⌘K) para saltar entre secciones.
export const navSections: NavSection[] = [
  { to: '/scan', label: 'Escanear', Icon: ScanLine, roles: ['admin', 'operador'] },
  { to: '/search', label: 'Buscar bienes', Icon: Search, roles: ['admin', 'operador', 'consulta'] },
  { to: '/agente', label: 'Agente', Icon: Sparkles, roles: ['admin', 'operador', 'consulta'] },
  { to: '/siga-pj', label: 'SIGA PJ', Icon: Database, roles: ['admin', 'operador', 'consulta'] },
  { to: '/trabajadores', label: 'Trabajadores', Icon: Users, roles: ['admin'] },
  { to: '/admin', label: 'Administración', Icon: Shield, roles: ['admin'] },
  { to: '/security', label: 'Seguridad de acceso', Icon: ShieldCheck, roles: ['admin', 'operador', 'consulta'] },
]
