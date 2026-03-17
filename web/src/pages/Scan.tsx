import type { FormEvent } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarcodeScanModal } from '../components/BarcodeScanModal'
import { supabase } from '../lib/supabaseClient'
import { DuplicateAlert } from '../components/DuplicateAlert'
import type { BienResumen } from '../types'

export function Scan() {
  const [codigo, setCodigo] = useState('')
  const [lastCode, setLastCode] = useState<string | null>(null)
  const [bienDuplicado, setBienDuplicado] = useState<BienResumen | null>(null)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showScanModal, setShowScanModal] = useState(false)
  const navigate = useNavigate()

  const verificarCodigo = async (code: string) => {
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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const valor = codigo.trim()
    if (!valor) return
    await verificarCodigo(valor)
  }

  const handleDetected = (code: string) => {
    const limpio = code.trim()
    if (!limpio) return
    setCodigo(limpio)
  }

  return (
    <div>
      <h1 className="page-title">Registrar bien</h1>
      <p className="page-subtitle">
        Escanea el código de barras o escribe el código manualmente para registrar el bien.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 card p-6 space-y-4 max-w-xl">
        <div>
          <label className="label" htmlFor="scan-codigo">
            Código patrimonial
          </label>
          <div className="flex gap-2">
            <input
              id="scan-codigo"
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Escribe o escanea el código"
              className="input flex-1"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowScanModal(true)}
              className="btn-secondary shrink-0 px-4"
              title="Escanear código de barras con la cámara"
            >
              📷
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={checking || !codigo.trim()}
          className="btn-primary w-full"
        >
          {checking ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Verificando código...
            </>
          ) : (
            'Continuar'
          )}
        </button>
      </form>

      {showScanModal && (
        <BarcodeScanModal
          onDetected={handleDetected}
          onClose={() => setShowScanModal(false)}
        />
      )}

      <div className="mt-4 text-sm text-slate-600">
        <button
          type="button"
          onClick={() => navigate('/registro')}
          className="btn-ghost"
        >
          Registrar bien sin usar la cámara
        </button>
      </div>

      {checking && (
        <p className="mt-4 flex items-center gap-2 text-slate-600">
          <span className="size-4 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
          Verificando código en el inventario...
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">
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
    </div>
  )
}
