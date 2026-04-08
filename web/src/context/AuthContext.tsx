import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import type { AccesoEstado, AppRole, Perfil } from '../types'

type AuthContextValue = {
  user: User | null
  session: Session | null
  perfil: Perfil | null
  loading: boolean
  authReady: boolean
  signOut: () => Promise<void>
  refreshPerfil: () => Promise<void>
  canEdit: boolean
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function mapPerfil(row: Record<string, unknown> | null): Perfil | null {
  if (!row) return null
  const role = row.app_role as string
  const app_role: AppRole =
    role === 'admin' || role === 'operador' || role === 'consulta' ? role : 'consulta'
  const rawEstado = row.acceso_estado as string | undefined
  const acceso_estado: AccesoEstado =
    rawEstado === 'pendiente' || rawEstado === 'activo' || rawEstado === 'rechazado'
      ? rawEstado
      : row.activo
        ? 'activo'
        : 'pendiente'
  return {
    id: String(row.id),
    app_role,
    nombre: (row.nombre as string | null) ?? null,
    activo: Boolean(row.activo),
    acceso_estado,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)
  const [authReady, setAuthReady] = useState(false)

  const fetchPerfil = useCallback(async (userId: string) => {
    const PERFIL_TIMEOUT_MS = 15_000
    const base = supabase
      .from('perfiles')
      .select('id, app_role, nombre, activo, acceso_estado')
      .eq('id', userId)
    const withTimeout =
      typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
        ? base.abortSignal(AbortSignal.timeout(PERFIL_TIMEOUT_MS))
        : base
    const { data, error } = await withTimeout.maybeSingle()
    if (error) {
      console.error('[Auth] perfiles', error)
      setPerfil(null)
      return
    }
    setPerfil(mapPerfil(data as Record<string, unknown>))
  }, [])

  const refreshPerfil = useCallback(async () => {
    if (user?.id) await fetchPerfil(user.id)
  }, [fetchPerfil, user])

  useEffect(() => {
    let mounted = true

    /**
     * Una sola vía para hidratar sesión al recargar (F5): Supabase emite INITIAL_SESSION al suscribirse.
     * Antes: init() + listener ignorando INITIAL_SESSION; en React Strict Mode el primer init podía
     * terminar con mounted=false y el finally no hacía setLoading(false), dejando la UI colgada.
     */
    async function applySessionFromAuth(event: AuthChangeEvent, s: Session | null) {
      try {
        if (event === 'TOKEN_REFRESHED') {
          if (mounted) {
            setSession(s)
            setUser(s?.user ?? null)
          }
          return
        }
        if (!mounted) return
        setSession(s)
        setUser(s?.user ?? null)
        if (s?.user) {
          await fetchPerfil(s.user.id)
        } else {
          setPerfil(null)
        }
      } catch (e) {
        console.error('[Auth] applySessionFromAuth', e)
        if (mounted) setPerfil(null)
      } finally {
        if (mounted) {
          setAuthReady(true)
          setLoading(false)
        }
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, s) => {
      void applySessionFromAuth(event, s)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [fetchPerfil])

  const signOut = useCallback(async () => {
    try {
      window.localStorage.removeItem('invweb_catalogs_v1')
      window.localStorage.removeItem('invweb_sede_activa')
    } catch {
      // noop
    }
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setPerfil(null)
  }, [])

  const sessionOk = Boolean(perfil && perfil.activo && perfil.acceso_estado === 'activo')
  const canEdit = Boolean(
    sessionOk && perfil && (perfil.app_role === 'admin' || perfil.app_role === 'operador'),
  )
  const isAdmin = Boolean(sessionOk && perfil && perfil.app_role === 'admin')

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      perfil,
      loading,
      authReady,
      signOut,
      refreshPerfil,
      canEdit,
      isAdmin,
    }),
    [user, session, perfil, loading, authReady, signOut, refreshPerfil, canEdit, isAdmin],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- patrón estándar context + hook
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
