import { supabase } from './supabaseClient'
import type { AdminUserRow, AppRole } from '../types'

type ListResponse = { users: AdminUserRow[] }

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const { data, error } = await supabase.functions.invoke<ListResponse>('admin-users', { method: 'GET' })
  if (error) throw error
  return data?.users ?? []
}

export async function inviteUser(email: string, app_role: AppRole): Promise<void> {
  const { error } = await supabase.functions.invoke('admin-users', {
    method: 'POST',
    body: { email, app_role },
  })
  if (error) throw error
}

export async function updateUserProfile(
  user_id: string,
  patch: { app_role?: AppRole; activo?: boolean },
): Promise<void> {
  const { error } = await supabase.functions.invoke('admin-users', {
    method: 'PATCH',
    body: { user_id, ...patch },
  })
  if (error) throw error
}
