import type { FormEvent } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarcodeScanModal } from '../components/BarcodeScanModal'
import { supabase } from '../lib/supabaseClient'
import { DuplicateAlert } from '../components/DuplicateAlert'
import type { BienResumen, SigaDatos } from '../types'
import { useSede } from '../context/SedeContext'
import { useCatalogs } from '../context/CatalogContext'

export function Scan() {
  const [codigo, setCodigo] = useState('')
  const [lastCode, setLastCode] = useState<string | null>(null)
  const [bienDuplicado, setBienDuplicado] = useState<BienResumen | null>(null)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showScanModal, setShowScanModal] = useState(false)
  const navigate = useNavigate()
  const { sedeActiva } = useSede()
  const { sedes } = useCatalogs()

  const findSedeNombre = (sedeId: number | null | undefined): string | null => {
    if (!sedeId) return null
    return sedes.find((s) => s.id === sedeId)?.nombre ?? `Sede ${sedeId}`
  }

  const verificarCodigo = async (code: string) => {
    if (checking) return
    setLastCode(code)
    setError(null)
    setChecking(true)

    const { data, error: supaError } = await supabase
      .from('bienes')
      .select('id, codigo_patrimonial, nombre_mueble_equipo, id_trabajador, ubicacion, sede_id')
      .eq('codigo_patrimonial', code)
      .is('eliminado_at', null)
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

      // Consultar siga_bienes para pre-rellenar el formulario
      const { data: sigaData } = await supabase
        .from('siga_bienes')
        .select('marca, modelo, serie, orden_compra, valor, descripcion')
        .eq('codigo_patrimonial', code)
        .maybeSingle()

      const params = new URLSearchParams({ codigo: code })
      if (sigaData) {
        const siga = sigaData as SigaDatos
        if (siga.marca) params.set('siga_marca', siga.marca)
        if (siga.modelo) params.set('siga_modelo', siga.modelo)
        if (siga.serie) params.set('siga_serie', siga.serie)
        if (siga.orden_compra) params.set('siga_oc', siga.orden_compra)
        if (siga.valor != null) params.set('siga_valor', String(siga.valor))
        if (siga.descripcion) params.set('siga_descripcion', siga.descripcion)
      }

      navigate(`/registro?${params.toString()}`)
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

      <form onSubmit={handleSubmit} className="mt-6 card p-6 space-y-4 max-w-xl mx-auto w-full">
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

      {lastCode && bienDuplicado && (() => {
        const bienSedeId = bienDuplicado.sede_id ?? null
        const esOtraSede =
          bienSedeId !== null &&
          sedeActiva !== null &&
          bienSedeId !== sedeActiva.id
        const sedeOrigen = esOtraSede ? findSedeNombre(bienSedeId) : null
        return (
          <DuplicateAlert
            codigo={lastCode}
            bien={bienDuplicado}
            sedeOrigen={sedeOrigen}
            onRegisterAnother={() => {
              setBienDuplicado(null)
              setLastCode(null)
            }}
            onCancel={() => navigate('/')}
          />
        )
      })()}
    </div>
  )
}
