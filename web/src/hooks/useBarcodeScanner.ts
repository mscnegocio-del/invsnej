import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { useCamera } from '../context/CameraContext'

type UseBarcodeScannerOptions = {
  onCode: (code: string) => void
}

export function useBarcodeScanner({ onCode }: UseBarcodeScannerOptions) {
  const { requestStream, error: cameraError } = useCamera()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [hasTorch, setHasTorch] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const lastCodeRef = useRef<string | null>(null)
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null)

  // Get error and setError from context - we'll need to expose setError from context or handle locally
  // Actually the CameraContext has error. But useBarcodeScanner also sets error for ZXing init failure. Let me keep a local error state for scanner-specific errors, and use context error for camera access.
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function start() {
      const stream = await requestStream()
      if (!stream || cancelled) return

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
        const detector = new (window as any).BarcodeDetector({
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
        try {
          const codeReader = new BrowserMultiFormatReader()
          const controls = await codeReader.decodeFromStream(stream, video ?? undefined, (result, err) => {
            if (cancelled) return
            if (err && !(err.name === 'NotFoundException')) {
              console.error('Error al decodificar con ZXing', err)
              return
            }
            if (result) {
              const raw = result.getText()
              if (raw && raw !== lastCodeRef.current) {
                lastCodeRef.current = raw
                onCode(raw)
              }
            }
          })
          zxingControlsRef.current = controls
        } catch (e) {
          console.error('Error al iniciar ZXing', e)
          setError('No se pudo iniciar el escáner de códigos de barras.')
        }
      }
    }

    start()

    return () => {
      cancelled = true
      zxingControlsRef.current?.stop()
      zxingControlsRef.current = null
      // No detenemos el stream aquí - el CameraContext lo mantiene para reutilizar
    }
  }, [onCode, requestStream])

  const toggleTorch = async () => {
    const stream = streamRef.current
    if (!stream) return
    const track = stream.getVideoTracks()[0]
    const next = !torchOn
    try {
      await (track as any).applyConstraints({ advanced: [{ torch: next }] })
      setTorchOn(next)
    } catch (e) {
      console.error('No se pudo cambiar el estado del flash', e)
    }
  }

  return {
    videoRef,
    error: cameraError ?? error,
    hasTorch,
    torchOn,
    toggleTorch,
  }
}
