import { useEffect, useRef, useState } from 'react'

type UseBarcodeScannerOptions = {
  onCode: (code: string) => void
}

export function useBarcodeScanner({ onCode }: UseBarcodeScannerOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hasTorch, setHasTorch] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const lastCodeRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function start() {
      try {
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: 'environment',
          },
          audio: false,
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        streamRef.current = stream

        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play()
        }

        const track = stream.getVideoTracks()[0]
        const capabilities = track.getCapabilities?.() as MediaTrackCapabilities | undefined
        if (capabilities && 'torch' in capabilities) {
          setHasTorch(true)
        }

        // Escaneo usando BarcodeDetector si está disponible
        if ('BarcodeDetector' in window) {
          // @ts-expect-error BarcodeDetector es experimental pero está disponible en navegadores modernos
          const detector = new window.BarcodeDetector({
            formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e'],
          })

          const scanFrame = async () => {
            if (cancelled || !video || video.readyState !== video.HAVE_ENOUGH_DATA) {
              requestAnimationFrame(scanFrame)
              return
            }

            try {
              const barcodes = await detector.detect(video)
              if (barcodes.length > 0) {
                const raw = barcodes[0].rawValue || ''
                if (raw && raw !== lastCodeRef.current) {
                  lastCodeRef.current = raw
                  onCode(raw)
                }
              }
            } catch (e) {
              console.error('Error al detectar código de barras', e)
            }

            requestAnimationFrame(scanFrame)
          }

          requestAnimationFrame(scanFrame)
        } else {
          setError(
            'Este navegador no soporta BarcodeDetector. Más adelante se puede integrar una librería de fallback como ZXing.',
          )
        }
      } catch (e) {
        console.error(e)
        setError('No se pudo acceder a la cámara. Revisa los permisos del navegador.')
      }
    }

    start()

    return () => {
      cancelled = true
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [onCode])

  const toggleTorch = async () => {
    const stream = streamRef.current
    if (!stream) return
    const track = stream.getVideoTracks()[0]
    const next = !torchOn
    try {
      // @ts-expect-error advanced constraints
      await track.applyConstraints({ advanced: [{ torch: next }] })
      setTorchOn(next)
    } catch (e) {
      console.error('No se pudo cambiar el estado del flash', e)
    }
  }

  return {
    videoRef,
    error,
    hasTorch,
    torchOn,
    toggleTorch,
  }
}

