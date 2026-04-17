import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2, ShieldX } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="max-w-md w-full text-center">
        <CardContent className="pt-6 space-y-3">
          {children}
        </CardContent>
      </Card>
    </div>
  )
}

export function AuthGuard() {
  const { user, perfil, loading, authReady, signOut } = useAuth()
  const location = useLocation()

  if (!authReady || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Cargando sesión…</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!perfil) {
    return (
      <CenteredCard>
        <ShieldX className="h-8 w-8 text-destructive mx-auto" />
        <h1 className="text-lg font-semibold">Perfil no disponible</h1>
        <p className="text-sm text-muted-foreground">
          No se encontró tu perfil en el sistema. Contacta al administrador o vuelve a iniciar sesión.
        </p>
        <Button className="w-full" onClick={() => void signOut()}>
          Cerrar sesión
        </Button>
      </CenteredCard>
    )
  }

  if (perfil.acceso_estado === 'pendiente') {
    return (
      <CenteredCard>
        <ShieldX className="h-8 w-8 text-amber-500 mx-auto" />
        <h1 className="text-lg font-semibold">Acceso pendiente de aprobación</h1>
        <p className="text-sm text-muted-foreground">
          Tu cuenta está registrada pero un administrador aún debe aprobar tu acceso al inventario.
          Vuelve a intentar más tarde o contacta al administrador.
        </p>
        <Button className="w-full" onClick={() => void signOut()}>
          Cerrar sesión
        </Button>
      </CenteredCard>
    )
  }

  if (perfil.acceso_estado === 'rechazado') {
    return (
      <CenteredCard>
        <ShieldX className="h-8 w-8 text-destructive mx-auto" />
        <h1 className="text-lg font-semibold">Acceso no autorizado</h1>
        <p className="text-sm text-muted-foreground">
          Tu solicitud de acceso no fue aprobada o fue revocada. Si crees que es un error, contacta al administrador.
        </p>
        <Button variant="secondary" className="w-full" onClick={() => void signOut()}>
          Cerrar sesión
        </Button>
      </CenteredCard>
    )
  }

  if (!perfil.activo || perfil.acceso_estado !== 'activo') {
    return (
      <CenteredCard>
        <ShieldX className="h-8 w-8 text-destructive mx-auto" />
        <h1 className="text-lg font-semibold">Cuenta desactivada</h1>
        <p className="text-sm text-muted-foreground">
          Tu acceso ha sido deshabilitado. Contacta al administrador.
        </p>
        <Button variant="secondary" className="w-full" onClick={() => void signOut()}>
          Cerrar sesión
        </Button>
      </CenteredCard>
    )
  }

  return <Outlet />
}
