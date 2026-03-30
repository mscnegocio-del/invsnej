import { Outlet } from 'react-router-dom'
import { useSede } from '../context/SedeContext'
import { SedeSelector } from '../pages/SedeSelector'

export function AuthenticatedShell() {
  const { sedeActiva, loading } = useSede()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600 flex items-center gap-2">
          <span className="size-4 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
          Cargando sede...
        </p>
      </div>
    )
  }

  if (!sedeActiva) {
    return <SedeSelector />
  }

  return <Outlet />
}
