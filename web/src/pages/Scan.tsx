import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarcodeScanner } from '../components/BarcodeScanner'
import { supabase } from '../lib/supabaseClient'
import { DuplicateAlert } from '../components/DuplicateAlert'
import type { BienResumen } from '../types'

export function Scan() {
  const [lastCode, setLastCode] = useState<string | null>(null)
  const [bienDuplicado, setBienDuplicado] = useState<BienResumen | null>(null)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleDetected = async (code: string) => {
    if (checking) return
    setLastCode(code)
    setError(null)
    setChecking(true)

    const { data, error: supaError } = await supabase
      .from('bienes')
      .select('id, codigo_patrimonial, nombre_mueble_equipo, id_trabajador, ubicacion')
      .eq('codigo_patrimonial', code)
      .maybeSingle()

    setChecking(false)

    if (supaError) {
      console.error(supaError)
      setError('No se pudo verificar si el código ya existe. Intenta nuevamente.')
      setBienDuplicado(null)
      return
    }

    if (data) {
      setBienDuplicado(data as BienResumen)
    } else {
      setBienDuplicado(null)
      navigate(`/registro?codigo=${encodeURIComponent(code)}`)
    }
  }

  return (
    <main style={{ padding: '1.5rem' }}>
      <h1>Escanear bien</h1>
      <p>Usa la cámara para leer el código de barras del bien.</p>

      <BarcodeScanner onDetected={handleDetected} />

      {checking && <p style={{ marginTop: '1rem' }}>Verificando código en el inventario...</p>}
      {error && (
        <p style={{ marginTop: '1rem', color: 'red' }}>
          {error}
        </p>
      )}

      {lastCode && bienDuplicado && (
        <DuplicateAlert
          codigo={lastCode}
          bien={bienDuplicado}
          onRegisterAnother={() => {
            setBienDuplicado(null)
            setLastCode(null)
          }}
          onCancel={() => navigate('/')}
        />
      )}
    </main>
  )
}

