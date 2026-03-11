import { useBarcodeScanner } from '../hooks/useBarcodeScanner'

type Props = {
  onDetected: (code: string) => void
}

export function BarcodeScanner({ onDetected }: Props) {
  const { videoRef, error, hasTorch, torchOn, toggleTorch } = useBarcodeScanner({
    onCode: onDetected,
  })

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        marginTop: '1rem',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 480,
          aspectRatio: '3 / 4',
          borderRadius: '0.75rem',
          overflow: 'hidden',
          background: '#000',
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scaleX(-1)', // muchas cámaras traseras se ven espejo
          }}
        />
        {/* Marco de área de escaneo */}
        <div
          style={{
            position: 'absolute',
            inset: '20%',
            borderRadius: '0.75rem',
            border: '2px solid rgba(0, 255, 0, 0.7)',
            boxShadow: '0 0 20px rgba(0, 255, 0, 0.5)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {hasTorch && (
        <button
          type="button"
          onClick={toggleTorch}
          style={{
            alignSelf: 'flex-start',
            padding: '0.5rem 1rem',
          }}
        >
          {torchOn ? 'Apagar flash' : 'Encender flash'}
        </button>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!error && <p>Apunta la cámara al código de barras del bien.</p>}
    </section>
  )
}

