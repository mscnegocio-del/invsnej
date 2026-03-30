import { useCallback, useEffect, useState } from 'react'
import { inviteUser, listAdminUsers, updateUserProfile } from '../lib/adminUsersApi'
import { useAuth } from '../context/AuthContext'
import type { AdminUserRow, AppRole } from '../types'

const ROLES: AppRole[] = ['admin', 'operador', 'consulta']

export function AdminUsuarios() {
  const { user, refreshPerfil } = useAuth()
  const [rows, setRows] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<AppRole>('operador')
  const [inviteBusy, setInviteBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listAdminUsers()
      setRows(data)
    } catch (e) {
      console.error(e)
      setError('No se pudo cargar la lista de usuarios. Verifica la función Edge «admin-users» y tu rol.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleInvite = async () => {
    const email = inviteEmail.trim()
    if (!email) {
      setError('Ingresa un correo para invitar.')
      return
    }
    setInviteBusy(true)
    setError(null)
    try {
      await inviteUser(email, inviteRole)
      setInviteEmail('')
      await load()
      await refreshPerfil()
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'No se pudo enviar la invitación.')
    } finally {
      setInviteBusy(false)
    }
  }

  const handleRoleChange = async (row: AdminUserRow, app_role: AppRole) => {
    try {
      await updateUserProfile(row.id, { app_role })
      await load()
      if (row.id === user?.id) await refreshPerfil()
    } catch (e) {
      console.error(e)
      setError('No se pudo actualizar el rol.')
    }
  }

  const handleActivo = async (row: AdminUserRow, activo: boolean) => {
    try {
      await updateUserProfile(row.id, { activo })
      await load()
      if (row.id === user?.id) await refreshPerfil()
    } catch (e) {
      console.error(e)
      setError('No se pudo actualizar el estado.')
    }
  }

  return (
    <div className="space-y-6">
      <p className="page-subtitle">Invita usuarios por correo y asigna roles. Solo administradores.</p>

      <section className="card p-6 max-w-xl space-y-4">
        <h2 className="text-base font-semibold text-slate-900">Invitar usuario</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            className="input flex-1"
            placeholder="correo@dominio.gob.pe"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as AppRole)} className="input sm:w-40">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button type="button" className="btn-primary shrink-0" disabled={inviteBusy} onClick={() => void handleInvite()}>
            {inviteBusy ? 'Enviando…' : 'Invitar'}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          La invitación se envía por correo. Configura la variable APP_URL en la función Edge para el enlace de retorno.
        </p>
      </section>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 max-w-xl">{error}</p>}

      <section className="card overflow-hidden max-w-3xl">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Usuarios</h2>
        </div>
        {loading ? (
          <p className="p-6 text-slate-600">
            <span className="size-4 inline-block animate-spin rounded-full border-2 border-teal-500 border-t-transparent mr-2 align-[-2px]" />
            Cargando…
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Correo</th>
                  <th className="text-left px-4 py-2 font-medium">Rol</th>
                  <th className="text-left px-4 py-2 font-medium">Activo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="text-slate-800">
                    <td className="px-4 py-2 font-mono text-xs">{row.email ?? '—'}</td>
                    <td className="px-4 py-2">
                      <select
                        value={row.app_role}
                        onChange={(e) => void handleRoleChange(row, e.target.value as AppRole)}
                        className="input py-1.5 text-sm min-w-[8rem]"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={row.activo}
                          onChange={(e) => void handleActivo(row, e.target.checked)}
                          disabled={row.id === user?.id}
                        />
                        <span className="text-xs text-slate-600">{row.activo ? 'Sí' : 'No'}</span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
