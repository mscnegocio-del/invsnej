import { useRef, useState, useEffect } from 'react'
import { useBarcodeScanner } from '../hooks/useBarcodeScanner'

const ROTATION_KEY = 'inv-web-camera-rotation'

function getStoredRotation(): number {
  try {
    const stored = localStorage.getItem(ROTATION_KEY)
    if (stored) {
      const n = Number(stored)
      if ([0, 90, 180, 270].includes(n)) return n
    }
  } catch {}
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
  } = useBarcodeScanner({
    onCode: onDetected,
    containerRef,
    videoRef,
  })

  useEffect(() => {
    try {
      localStorage.setItem(ROTATION_KEY, String(rotation))
    } catch {}
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
        {/* Marco de área de escaneo */}
        <div
          className="absolute inset-[20%] rounded-xl border-2 border-emerald-400/80 shadow-[0_0_24px_rgba(52,211,153,0.3)] pointer-events-none"
          aria-hidden
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {!useQuagga && captureManual != null && (
          <button
            type="button"
            onClick={captureManual}
            disabled={capturing}
            className="btn-primary"
          >
            {capturing ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Leyendo...
              </>
            ) : (
              '📸 Capturar y leer'
            )}
          </button>
        )}
        {hasTorch && (
          <button
            type="button"
            onClick={toggleTorch}
            className="btn-secondary"
          >
            {torchOn ? 'Apagar flash' : 'Encender flash'}
          </button>
        )}
        {!useQuagga && (
          <button
            type="button"
            onClick={cycleRotation}
            className="btn-ghost text-sm"
            title="Rotar vista de cámara"
          >
            🔄 Rotar vista ({rotation}°)
          </button>
        )}
        {!hideManualInput && (
          <button
            type="button"
            onClick={() => setShowManualInput((v) => !v)}
            className="btn-ghost text-sm"
            title="Si la cámara no lee bien, escribe el código a mano"
          >
            ✏️ Escribir manualmente
          </button>
        )}
      </div>

      {!hideManualInput && showManualInput && (
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label htmlFor="manual-code" className="text-sm font-medium text-slate-700">
            Código patrimonial
          </label>
          <div className="flex gap-2">
            <input
              id="manual-code"
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Ej: PAT-2024-00123"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => {
                const code = manualCode.trim()
                if (code) {
                  onDetected(code)
                  setManualCode('')
                  setShowManualInput(false)
                }
              }}
              disabled={!manualCode.trim()}
              className="btn-primary shrink-0"
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
        </p>
      )}
      {!error && (
        <div className="text-slate-600 text-sm space-y-1">
          <p>Centra solo el código de barras en el recuadro verde.</p>
          <p className="text-slate-500 text-xs">
            Mantén una distancia de 15–30 cm. Si se ve borro, aleja un poco la cámara. Para códigos pequeños, aléjate hasta que se vea nítido.
          </p>
          <p className="text-slate-500 text-xs">
            {useQuagga
              ? 'Quagga2 detecta códigos en distintos ángulos y tamaños.'
              : 'Si no se lee automático: usa «Capturar y leer». Evita reflejos; prueba sin flash en etiquetas brillantes.'}
            {!useQuagga && rotation !== 0 && ' Usa «Rotar vista» si la imagen se ve mal.'}
          </p>
        </div>
      )}
    </section>
  )
}
