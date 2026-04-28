import { useRef, useState, useEffect } from 'react'
import { Camera, Flashlight, RefreshCw, ScanLine, Loader2, Pencil } from 'lucide-react'
import { useBarcodeScanner } from '../hooks/useBarcodeScanner'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Alert, AlertDescription } from './ui/alert'

const ROTATION_KEY = 'inv-web-camera-rotation'

function getStoredRotation(): number {
  try {
    const stored = localStorage.getItem(ROTATION_KEY)
    if (stored) {
      const n = Number(stored)
      if ([0, 90, 180, 270].includes(n)) return n
    }
  } catch {
    /* noop */
  }
  return 0
}

type Props = {
  onDetected: (code: string) => void
  hideManualInput?: boolean
}

export function BarcodeScanner({ onDetected, hideManualInput = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [rotation, setRotation] = useState(getStoredRotation)
  const [showManualInput, setShowManualInput] = useState(false)
  const [manualCode, setManualCode] = useState('')

  const {
    useQuagga,
    error,
    hasTorch,
    torchOn,
    toggleTorch,
    captureManual,
    capturing,
  } = useBarcodeScanner({ onCode: onDetected, containerRef, videoRef })

  useEffect(() => {
    try {
      localStorage.setItem(ROTATION_KEY, String(rotation))
    } catch {
      /* noop */
    }
  }, [rotation])

  const cycleRotation = () => {
    setRotation((prev) => ((prev + 90) % 360) as 0 | 90 | 180 | 270)
  }

  return (
    <section className="mt-6 flex flex-col gap-4">
      <div
        ref={containerRef}
        className="relative w-full max-w-md mx-auto aspect-[3/4] rounded-2xl overflow-hidden bg-slate-900 shadow-lg ring-1 ring-slate-200/50"
      >
        {!useQuagga && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: `rotate(${rotation}deg)` }}
          />
        )}
        <div
          className="absolute inset-[20%] rounded-xl border-2 border-emerald-400/80 shadow-[0_0_24px_rgba(52,211,153,0.3)] pointer-events-none"
          aria-hidden
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {!useQuagga && captureManual != null && (
          <Button type="button" onClick={captureManual} disabled={capturing} className="gap-2 min-h-11">
            {capturing
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Leyendo…</>
              : <><Camera className="h-4 w-4" /> Capturar y leer</>
            }
          </Button>
        )}
        {hasTorch && (
          <Button type="button" variant="secondary" onClick={toggleTorch} className="gap-2 min-h-11">
            <Flashlight className="h-4 w-4" />
            {torchOn ? 'Apagar flash' : 'Encender flash'}
          </Button>
        )}
        {!useQuagga && (
          <Button
            type="button"
            variant="ghost"
            onClick={cycleRotation}
            title="Rotar vista de cámara"
            className="gap-1.5 min-h-11 lg:min-h-9"
          >
            <RefreshCw className="h-4 w-4" />
            Rotar ({rotation}°)
          </Button>
        )}
        {!hideManualInput && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowManualInput((v) => !v)}
            title="Si la cámara no lee bien, escribe el código a mano"
            className="gap-1.5 min-h-11 lg:min-h-9"
          >
            <Pencil className="h-4 w-4" />
            Escribir manualmente
          </Button>
        )}
      </div>

      {!hideManualInput && showManualInput && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-4">
          <Label htmlFor="manual-code">Código patrimonial</Label>
          <div className="flex gap-2">
            <Input
              id="manual-code"
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Ej: PAT-2024-00123"
              autoComplete="off"
              className="flex-1"
            />
            <Button
              type="button"
              disabled={!manualCode.trim()}
              onClick={() => {
                const code = manualCode.trim()
                if (code) {
                  onDetected(code)
                  setManualCode('')
                  setShowManualInput(false)
                }
              }}
              className="shrink-0 gap-2"
            >
              <ScanLine className="h-4 w-4" />
              Continuar
            </Button>
          </div>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {!error && (
        <div className="text-muted-foreground text-sm space-y-1">
          <p>Centra solo el código de barras en el recuadro verde.</p>
          <p className="text-xs">
            Mantén una distancia de 15–30 cm. Si se ve borroso, aleja un poco la cámara.
            Para códigos pequeños, aléjate hasta que se vea nítido.
          </p>
          <p className="text-xs">
            {useQuagga
              ? 'Quagga2 detecta códigos en distintos ángulos y tamaños.'
              : 'Si no se lee automático: usa «Capturar y leer». Evita reflejos; prueba sin flash en etiquetas brillantes.'}
            {!useQuagga && rotation !== 0 && ' Usa «Rotar» si la imagen se ve mal.'}
          </p>
        </div>
      )}
    </section>
  )
}
