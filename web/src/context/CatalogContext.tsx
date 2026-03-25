import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Sede, Trabajador, Ubicacion } from '../types'

type CatalogContextValue = {
  trabajadores: Trabajador[]
  ubicaciones: Ubicacion[]
  sedes: Sede[]
  loading: boolean
  error: string | null
  reload: () => void
}

const CatalogContext = createContext<CatalogContextValue | undefined>(undefined)

const CACHE_KEY = 'invweb_catalogs_v1'
const CACHE_TTL_MS = 1 * 60 * 1000 // 1 minuto

type CachePayload = {
  trabajadores: Trabajador[]
  ubicaciones: Ubicacion[]
  sedes: Sede[]
  timestamp: number
}

function loadFromCache(): CachePayload | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachePayload
    if (!parsed.timestamp || Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function saveToCache(payload: CachePayload) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload))
  } catch {
    // Si falla el cache, no bloquea la app
  }
}

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([])
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      setLoading(true)
      setError(null)

      // Intentar usar cache primero
      const cached = loadFromCache()
      if (cached && !cancelled) {
        setTrabajadores(cached.trabajadores)
        setUbicaciones(cached.ubicaciones)
        setSedes(cached.sedes ?? [])
        setLoading(false)
        return
      }

      const [trabajadoresRes, ubicacionesRes, sedesRes] = await Promise.all([
        supabase.from('trabajadores').select('id, nombre').order('nombre', { ascending: true }),
        supabase.from('ubicaciones').select('id, nombre').order('nombre', { ascending: true }),
        supabase.from('sedes').select('id, nombre, codigo').order('nombre', { ascending: true }),
      ])

      if (cancelled) return

      if (trabajadoresRes.error || ubicacionesRes.error || sedesRes.error) {
        setError(
          trabajadoresRes.error?.message ??
            ubicacionesRes.error?.message ??
            sedesRes.error?.message ??
            'Error cargando catálogos',
        )
        setLoading(false)
        return
      }

      const trabajadoresData = (trabajadoresRes.data ?? []) as Trabajador[]
      const ubicacionesData = (ubicacionesRes.data ?? []) as Ubicacion[]
      const sedesData = (sedesRes.data ?? []) as Sede[]

      setTrabajadores(trabajadoresData)
      setUbicaciones(ubicacionesData)
      setSedes(sedesData)
      saveToCache({
        trabajadores: trabajadoresData,
        ubicaciones: ubicacionesData,
        sedes: sedesData,
        timestamp: Date.now(),
      })
      setLoading(false)
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const reload = () => setReloadToken((t) => t + 1)

  return (
    <CatalogContext.Provider value={{ trabajadores, ubicaciones, sedes, loading, error, reload }}>
      {children}
    </CatalogContext.Provider>
  )
}

export function useCatalogs() {
  const ctx = useContext(CatalogContext)
  if (!ctx) {
    throw new Error('useCatalogs debe usarse dentro de CatalogProvider')
  }
  return ctx
}

