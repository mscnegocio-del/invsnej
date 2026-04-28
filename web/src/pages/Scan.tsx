import type { FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Camera, Loader2, RotateCcw } from 'lucide-react'
import { BarcodeScanModal } from '../components/BarcodeScanModal'
import { supabase } from '../lib/supabaseClient'
import { DuplicateAlert } from '../components/DuplicateAlert'
import type { BienResumen, SigaDatos } from '../types'
import { useSede } from '../context/SedeContext'
import { useCatalogs } from '../context/CatalogContext'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'

type ChainDefaults = {
  id_trabajador: number | null
  id_ubicacion: number | null
  estado: string | null
}

export function Scan() {
  const [codigo, setCodigo] = useState('')
  const [lastCode, setLastCode] = useState<string | null>(null)
  const [bienDuplicado, setBienDuplicado] = useState<BienResumen | null>(null)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { sedeActiva } = useSede()
  const { sedes, trabajadores, ubicaciones } = useCatalogs()
  const inputRef = useRef<HTMLInputElement>(null)
  const isContinuar = searchParams.get('continuar') === '1'

  // Leer defaults del modo encadenado directamente en el inicializador (lazy init, sin useEffect)
  const [chainDefaults, setChainDefaults] = useState<ChainDefaults | null>(() => {
    if (!isContinuar) return null
    try {
      const raw = sessionStorage.getItem('inv:chain_defaults')
      return raw ? (JSON.parse(raw) as ChainDefaults) : null
    } catch { return null }
  })
  const [showScanModal, setShowScanModal] = useState(isContinuar)

  // Autofocus en el input al montar
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const limpiarChain = () => {
    setChainDefaults(null)
    try { sessionStorage.removeItem('inv:chain_defaults') } catch { /* noop */ }
  }

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
      // Propagar defaults del modo continuar
      if (chainDefaults) {
        if (chainDefaults.id_trabajador) params.set('chain_trabajador', String(chainDefaults.id_trabajador))
        if (chainDefaults.id_ubicacion) params.set('chain_ubicacion', String(chainDefaults.id_ubicacion))
        if (chainDefaults.estado) params.set('chain_estado', chainDefaults.estado)
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
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Registrar bien</h1>
        <p className="page-subtitle">
          Escanea el código de barras o escribe el código manualmente para registrar el bien.
        </p>
      </div>

      {chainDefaults && (() => {
        const trab = chainDefaults.id_trabajador
          ? trabajadores.find((t) => t.id === chainDefaults.id_trabajador)?.nombre
          : null
        const ubic = chainDefaults.id_ubicacion
          ? ubicaciones.find((u) => u.id === chainDefaults.id_ubicacion)?.nombre
          : null
        return (
          <Alert className="max-w-xl mx-auto">
            <AlertDescription className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Continuando con:</span>
              {trab && <Badge variant="secondary">{trab}</Badge>}
              {ubic && <Badge variant="secondary">{ubic}</Badge>}
              {chainDefaults.estado && <Badge variant="secondary">{chainDefaults.estado}</Badge>}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={limpiarChain}
                className="ml-auto gap-1 h-7"
              >
                <RotateCcw className="h-3 w-3" />
                Limpiar
              </Button>
            </AlertDescription>
          </Alert>
        )
      })()}

      <Card className="max-w-xl mx-auto">
        <CardContent className="p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="scan-codigo">Código patrimonial</Label>
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  id="scan-codigo"
                  type="text"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="Escribe o escanea el código"
                  autoComplete="off"
                  autoCapitalize="characters"
                  inputMode="text"
                  className="flex-1 min-h-11"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowScanModal(true)}
                  title="Escanear con la cámara"
                  className="shrink-0 min-h-11 min-w-11"
                >
                  <Camera className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={checking || !codigo.trim()} className="w-full">
              {checking
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Verificando…</>
                : 'Continuar'
              }
            </Button>
          </form>

          <Button
            type="button"
            variant="ghost"
            className="w-full text-sm"
            onClick={() => navigate('/registro')}
          >
            Registrar bien sin usar la cámara
          </Button>
        </CardContent>
      </Card>

      {showScanModal && (
        <BarcodeScanModal
          onDetected={handleDetected}
          onClose={() => setShowScanModal(false)}
        />
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
            onRegisterAnother={() => { setBienDuplicado(null); setLastCode(null) }}
            onCancel={() => navigate('/')}
          />
        )
      })()}
    </div>
  )
}
