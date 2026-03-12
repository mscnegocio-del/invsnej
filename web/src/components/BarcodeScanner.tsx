import { useState, useEffect } from 'react'
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
}

export function BarcodeScanner({ onDetected }: Props) {
  const [rotation, setRotation] = useState(getStoredRotation)
  const {
    videoRef,
    error,
    hasTorch,
    torchOn,
    toggleTorch,
    captureManual,
    capturing,
  } = useBarcodeScanner({ onCode: onDetected })

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
      <div className="relative w-full max-w-md mx-auto aspect-[3/4] rounded-2xl overflow-hidden bg-slate-900 shadow-lg ring-1 ring-slate-200/50">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: `rotate(${rotation}deg)` }}
        />
        {/* Marco de área de escaneo */}
        <div
          className="absolute inset-[20%] rounded-xl border-2 border-emerald-400/80 shadow-[0_0_24px_rgba(52,211,153,0.3)] pointer-events-none"
          aria-hidden
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
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
        {hasTorch && (
          <button
            type="button"
            onClick={toggleTorch}
            className="btn-secondary"
          >
            {torchOn ? 'Apagar flash' : 'Encender flash'}
          </button>
        )}
        <button
          type="button"
          onClick={cycleRotation}
          className="btn-ghost text-sm"
          title="Rotar vista de cámara"
        >
          🔄 Rotar vista ({rotation}°)
        </button>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
        </p>
      )}
      {!error && (
        <div className="text-slate-600 text-sm space-y-1">
          <p>Centra solo el código de barras en el recuadro verde.</p>
          <p className="text-slate-500 text-xs">
            Si no se lee automático: usa «Capturar y leer». Evita reflejos; prueba sin flash en etiquetas brillantes.
            {rotation !== 0 && ' Usa «Rotar vista» si la imagen se ve mal.'}
          </p>
        </div>
      )}
    </section>
  )
}
