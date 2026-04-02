import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import type { AdminUserRow, AppRole } from '../types'

type ListResponse = { users: AdminUserRow[] }

async function throwInvokeError(error: unknown): Promise<never> {
  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response | undefined
    if (res) {
      let serverMessage: string | undefined
      try {
        const j = (await res.clone().json()) as { error?: string }
        if (typeof j?.error === 'string' && j.error.length > 0) serverMessage = j.error
      } catch {
        /* cuerpo no JSON */
      }
      if (serverMessage) throw new Error(serverMessage)
    }
  }
  throw error instanceof Error ? error : new Error('Error al invocar la función Edge')
}

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const { data, error } = await supabase.functions.invoke<ListResponse>('admin-users', { method: 'GET' })
  if (error) await throwInvokeError(error)
  return data?.users ?? []
}

export async function inviteUser(email: string, app_role: AppRole): Promise<void> {
  const { error } = await supabase.functions.invoke('admin-users', {
    method: 'POST',
    body: { email, app_role },
  })
  if (error) await throwInvokeError(error)
}

export async function updateUserProfile(
  user_id: string,
  patch: { app_role?: AppRole; activo?: boolean },
): Promise<void> {
  const { error } = await supabase.functions.invoke('admin-users', {
    method: 'PATCH',
    body: { user_id, ...patch },
  })
  if (error) await throwInvokeError(error)
}
