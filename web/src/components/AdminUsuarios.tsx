import { useCallback, useEffect, useState } from 'react'
import { Loader2, UserPlus } from 'lucide-react'
import { inviteUser, listAdminUsers, updateUserProfile } from '../lib/adminUsersApi'
import { useAuth } from '../context/AuthContext'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Card, CardHeader, CardContent, CardTitle } from './ui/card'
import { Alert, AlertDescription } from './ui/alert'
import { Skeleton } from './ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table'
import type { AccesoEstado, AdminUserRow, AppRole } from '../types'

const ROLES: AppRole[] = ['admin', 'operador', 'consulta']

function estadoVariant(e: AccesoEstado): 'warning' | 'success' | 'secondary' {
  switch (e) {
    case 'pendiente': return 'warning'
    case 'activo': return 'success'
    case 'rechazado': return 'secondary'
  }
}

function estadoLabel(e: AccesoEstado): string {
  switch (e) {
    case 'pendiente': return 'Pendiente'
    case 'activo': return 'Activo'
    case 'rechazado': return 'Rechazado'
  }
}

export function AdminUsuarios() {
  const { user, refreshPerfil } = useAuth()
  const [rows, setRows] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<AppRole>('operador')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [rowBusy, setRowBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listAdminUsers()
      setRows(data)
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'No se pudo cargar la lista de usuarios.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const handleInvite = async () => {
    const email = inviteEmail.trim()
    if (!email) { setError('Ingresa un correo para invitar.'); return }
    setInviteBusy(true)
    setError(null)
    try {
      await inviteUser(email, inviteRole)
      setInviteEmail('')
      await load()
      await refreshPerfil()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar la invitación.')
    } finally {
      setInviteBusy(false)
    }
  }

  const handleRoleChange = async (row: AdminUserRow, app_role: AppRole) => {
    setRowBusy(row.id)
    try {
      await updateUserProfile(row.id, { app_role })
      await load()
      if (row.id === user?.id) await refreshPerfil()
    } catch {
      setError('No se pudo actualizar el rol.')
    } finally {
      setRowBusy(null)
    }
  }

  const setAcceso = async (row: AdminUserRow, acceso_estado: AccesoEstado) => {
    setRowBusy(row.id)
    try {
      await updateUserProfile(row.id, { acceso_estado })
      await load()
      if (row.id === user?.id) await refreshPerfil()
    } catch {
      setError('No se pudo actualizar el estado de acceso.')
    } finally {
      setRowBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <p className="page-subtitle">
        Invita usuarios por correo. Quedarán en estado pendiente hasta que apruebes el acceso.
      </p>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">Invitar usuario</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              type="email"
              className="flex-1"
              placeholder="correo@dominio.gob.pe"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleInvite() }}
            />
            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
              <SelectTrigger className="sm:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => void handleInvite()} disabled={inviteBusy} className="gap-2 shrink-0">
              {inviteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {inviteBusy ? 'Enviando…' : 'Invitar'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            La invitación se envía por correo. Configura APP_URL en la función Edge para el enlace.
          </p>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="max-w-xl">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="overflow-hidden max-w-4xl">
        <CardHeader className="border-b border-border py-3">
          <CardTitle className="text-base">Usuarios del sistema</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Correo</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.email ?? '—'}</TableCell>
                    <TableCell>
                      <Select
                        value={row.app_role}
                        onValueChange={(v) => void handleRoleChange(row, v as AppRole)}
                        disabled={rowBusy === row.id}
                      >
                        <SelectTrigger className="h-8 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant={estadoVariant(row.acceso_estado)}>
                        {estadoLabel(row.acceso_estado)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {row.acceso_estado === 'pendiente' && (
                          <>
                            <Button size="sm" className="h-7 text-xs" disabled={rowBusy === row.id} onClick={() => void setAcceso(row, 'activo')}>
                              Aprobar
                            </Button>
                            <Button variant="secondary" size="sm" className="h-7 text-xs" disabled={rowBusy === row.id} onClick={() => void setAcceso(row, 'rechazado')}>
                              Rechazar
                            </Button>
                          </>
                        )}
                        {row.acceso_estado === 'activo' && row.id !== user?.id && (
                          <Button variant="secondary" size="sm" className="h-7 text-xs" disabled={rowBusy === row.id} onClick={() => void setAcceso(row, 'rechazado')}>
                            Suspender
                          </Button>
                        )}
                        {row.acceso_estado === 'rechazado' && (
                          <Button size="sm" className="h-7 text-xs" disabled={rowBusy === row.id} onClick={() => void setAcceso(row, 'activo')}>
                            Reactivar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
