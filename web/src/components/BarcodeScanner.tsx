import { useBarcodeScanner } from '../hooks/useBarcodeScanner'

type Props = {
  onDetected: (code: string) => void
}

export function BarcodeScanner({ onDetected }: Props) {
  const { videoRef, error, hasTorch, torchOn, toggleTorch } = useBarcodeScanner({
    onCode: onDetected,
  })

  return (
    <section className="mt-6 flex flex-col gap-4">
      <div className="relative w-full max-w-md mx-auto aspect-[3/4] rounded-2xl overflow-hidden bg-slate-900 shadow-lg ring-1 ring-slate-200/50">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover [transform:rotate(90deg)]"
        />
        {/* Marco de área de escaneo */}
        <div
          className="absolute inset-[20%] rounded-xl border-2 border-emerald-400/80 shadow-[0_0_24px_rgba(52,211,153,0.3)] pointer-events-none"
          aria-hidden
        />
      </div>

      {hasTorch && (
        <button
          type="button"
          onClick={toggleTorch}
          className="btn-secondary self-start"
        >
          {torchOn ? 'Apagar flash' : 'Encender flash'}
        </button>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
        </p>
      )}
      {!error && (
        <p className="text-slate-600 text-sm">Apunta la cámara al código de barras del bien.</p>
      )}
    </section>
  )
}
