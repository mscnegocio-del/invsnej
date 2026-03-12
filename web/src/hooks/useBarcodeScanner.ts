import { useCallback, useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { useCamera } from '../context/CameraContext'

type UseBarcodeScannerOptions = {
  onCode: (code: string) => void
}

const BARCODE_HINTS = new Map<DecodeHintType, unknown>([
  [DecodeHintType.TRY_HARDER, true],
  [
    DecodeHintType.POSSIBLE_FORMATS,
    [
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
    ],
  ],
])

const SCANNER_OPTIONS = {
  delayBetweenScanAttempts: 800,
  delayBetweenScanSuccess: 600,
}

export function useBarcodeScanner({ onCode }: UseBarcodeScannerOptions) {
  const { requestStream, error: cameraError } = useCamera()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [hasTorch, setHasTorch] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const lastCodeRef = useRef<string | null>(null)
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null)
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null)
  const detectorRef = useRef<any>(null)
  const [error, setError] = useState<string | null>(null)

  const captureManual = useCallback(async () => {
    const video = videoRef.current
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) return

    setCapturing(true)
    try {
      const detector = detectorRef.current
      const codeReader = codeReaderRef.current

      if (detector) {
        const barcodes = await detector.detect(video)
        const raw = barcodes?.[0]?.rawValue
        if (raw) {
          lastCodeRef.current = raw
          onCode(raw)
        }
      } else if (codeReader) {
        const decoded = await codeReader.decodeOnceFromVideoElement(video)
        const raw = decoded?.getText()
        if (raw) {
          lastCodeRef.current = raw
          onCode(raw)
        }
      }
    } catch {
      // NotFoundException u otros - ignorar, es normal que no siempre detecte
    } finally {
      setCapturing(false)
    }
  }, [onCode])

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

      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({
          formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e'],
        })
        detectorRef.current = detector

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
          const codeReader = new BrowserMultiFormatReader(BARCODE_HINTS, SCANNER_OPTIONS)
          codeReaderRef.current = codeReader

          const controls = await codeReader.decodeFromStream(
            stream,
            video ?? undefined,
            (result, err) => {
              if (cancelled) return
              if (err && err.name !== 'NotFoundException') {
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
            },
          )
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
      codeReaderRef.current = null
      detectorRef.current = null
    }
  }, [onCode, requestStream])

  const [torchOnState, setTorchOnState] = useState(false)

  const toggleTorch = useCallback(async () => {
    const stream = streamRef.current
    if (!stream) return
    const track = stream.getVideoTracks()[0]
    const next = !torchOnState
    try {
      await (track as any).applyConstraints({ advanced: [{ torch: next }] })
      setTorchOnState(next)
    } catch (e) {
      console.error('No se pudo cambiar el estado del flash', e)
    }
  }, [torchOnState])

  return {
    videoRef,
    error: cameraError ?? error,
    hasTorch,
    torchOn: torchOnState,
    toggleTorch,
    captureManual,
    capturing,
  }
}
