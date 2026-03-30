import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { AppRole } from '../types'

type Props = {
  roles: AppRole[]
  children: ReactNode
  fallback?: ReactNode
}

export function RoleGuard({ roles, children, fallback }: Props) {
  const { perfil, loading, authReady } = useAuth()

  if (!authReady || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600 flex items-center gap-2">
          <span className="size-4 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
          Cargando...
        </p>
      </div>
    )
  }

  if (!perfil?.activo || !roles.includes(perfil.app_role)) {
    return fallback ?? <Navigate to="/" replace />
  }

  return <>{children}</>
}
