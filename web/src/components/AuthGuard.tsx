import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function AuthGuard() {
  const { user, perfil, loading, authReady, signOut } = useAuth()
  const location = useLocation()

  if (!authReady || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600 flex items-center gap-2">
          <span className="size-4 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
          Cargando sesión...
        </p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!perfil) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full card p-6 text-center space-y-3">
          <h1 className="text-lg font-semibold text-slate-900">Perfil no disponible</h1>
          <p className="text-sm text-slate-600">
            No se encontró tu perfil en el sistema. Contacta al administrador o vuelve a iniciar sesión.
          </p>
          <button type="button" className="btn-primary w-full" onClick={() => void signOut()}>
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  if (perfil.acceso_estado === 'pendiente') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full card p-6 text-center space-y-3">
          <h1 className="text-lg font-semibold text-slate-900">Acceso pendiente de aprobación</h1>
          <p className="text-sm text-slate-600">
            Tu cuenta está registrada pero un administrador aún debe aprobar tu acceso al inventario. Vuelve a
            intentar más tarde o contacta al administrador.
          </p>
          <button type="button" className="btn-primary w-full" onClick={() => void signOut()}>
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  if (perfil.acceso_estado === 'rechazado') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full card p-6 text-center space-y-3">
          <h1 className="text-lg font-semibold text-slate-900">Acceso no autorizado</h1>
          <p className="text-sm text-slate-600">
            Tu solicitud de acceso no fue aprobada o fue revocada. Si crees que es un error, contacta al
            administrador.
          </p>
          <button type="button" className="btn-secondary w-full" onClick={() => void signOut()}>
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  if (!perfil.activo || perfil.acceso_estado !== 'activo') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full card p-6 text-center space-y-3">
          <h1 className="text-lg font-semibold text-slate-900">Cuenta desactivada</h1>
          <p className="text-sm text-slate-600">Tu acceso ha sido deshabilitado. Contacta al administrador.</p>
          <button type="button" className="btn-secondary w-full" onClick={() => void signOut()}>
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  return <Outlet />
}
