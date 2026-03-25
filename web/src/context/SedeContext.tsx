import { createContext, useContext, useMemo, useState } from 'react'
import type { Sede } from '../types'

type SedeContextValue = {
  sedeActiva: Sede | null
  cambiarSede: (sede: Sede) => void
  limpiarSede: () => void
  loading: boolean
}

const STORAGE_KEY = 'invweb_sede_activa'
const SedeContext = createContext<SedeContextValue | undefined>(undefined)

function leerSedeInicial(): Sede | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Sede
  } catch {
    return null
  }
}

export function SedeProvider({ children }: { children: React.ReactNode }) {
  const [sedeActiva, setSedeActiva] = useState<Sede | null>(leerSedeInicial)
  const [loading] = useState(false)

  const cambiarSede = (sede: Sede) => {
    setSedeActiva(sede)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sede))
    } catch {
      // Si falla localStorage, mantenemos solo estado en memoria.
    }
  }

  const limpiarSede = () => {
    setSedeActiva(null)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // noop
    }
  }

  const value = useMemo<SedeContextValue>(
    () => ({ sedeActiva, cambiarSede, limpiarSede, loading }),
    [loading, sedeActiva],
  )

  return <SedeContext.Provider value={value}>{children}</SedeContext.Provider>
}

export function useSede() {
  const ctx = useContext(SedeContext)
  if (!ctx) throw new Error('useSede debe usarse dentro de SedeProvider')
  return ctx
}
