import { useCallback, useEffect, useRef, useState } from 'react'
import Quagga, { type QuaggaJSResultObject } from '@ericblade/quagga2'
import { useCamera } from '../context/CameraContext'

type UseBarcodeScannerOptions = {
  onCode: (code: string) => void
  containerRef: React.RefObject<HTMLDivElement | null>
  videoRef: React.RefObject<HTMLVideoElement | null>
}

const USE_QUAGGA = !('BarcodeDetector' in window)

// Feedback sensorial al detectar un código: vibración corta + beep 880 Hz 80ms.
// Degrada silenciosamente si el navegador no soporta vibrate o AudioContext.
let sharedAudioCtx: AudioContext | null = null
function playSuccessFeedback() {
  try { navigator.vibrate?.(50) } catch { /* noop */ }
  try {
    type AudioCtxCtor = typeof AudioContext
    const Ctor: AudioCtxCtor | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioCtxCtor }).webkitAudioContext
    if (!Ctor) return
    if (!sharedAudioCtx) sharedAudioCtx = new Ctor()
    const ctx = sharedAudioCtx
    if (ctx.state === 'suspended') void ctx.resume()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.1)
  } catch { /* noop */ }
}

type BarcodeDetectorLike = { detect: (src: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> }

const QUAGGA_READERS = [
  'code_128_reader',
  'code_39_reader',
  'ean_reader',
  'ean_8_reader',
  'upc_reader',
  'upc_e_reader',
] as const

export function useBarcodeScanner({ onCode, containerRef, videoRef }: UseBarcodeScannerOptions) {
  const { requestStream, error: cameraError } = useCamera()
  const [hasTorch, setHasTorch] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const lastCodeRef = useRef<string | null>(null)
  const detectorRef = useRef<BarcodeDetectorLike | null>(null)
  const [error, setError] = useState<string | null>(null)

  const captureManual = useCallback(async () => {
    const video = videoRef.current
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) return

    setCapturing(true)
    try {
      const detector = detectorRef.current
      if (detector) {
        const barcodes = await detector.detect(video)
        const raw = barcodes?.[0]?.rawValue
        if (raw) {
          lastCodeRef.current = raw
          playSuccessFeedback()
          onCode(raw)
        }
      }
    } catch {
      // NotFoundException u otros - ignorar, es normal que no siempre detecte
    } finally {
      setCapturing(false)
    }
  }, [onCode, videoRef])

  useEffect(() => {
    if (USE_QUAGGA) {
      // Modo Quagga2: usa su propio stream, no CameraContext
      const container = containerRef.current
      if (!container) return
      let cancelled = false
      const handleDetected = (result: QuaggaJSResultObject) => {
        if (cancelled) return
        const raw = result?.codeResult?.code ?? ''
        if (raw && raw !== lastCodeRef.current) {
          lastCodeRef.current = raw
          playSuccessFeedback()
          onCode(raw)
        }
      }

      Quagga.init(
        {
          inputStream: {
            type: 'LiveStream',
            target: container,
            constraints: {
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          decoder: { readers: [...QUAGGA_READERS] },
        },
        (err: unknown) => {
          if (err || cancelled) {
            if (err && !cancelled) {
              console.error('Error al iniciar Quagga2', err)
              setError('No se pudo iniciar el escáner de códigos de barras.')
            }
            return
          }
          Quagga.start()
        },
      )

      Quagga.onDetected(handleDetected)

      return () => {
        cancelled = true
        Quagga.offDetected(handleDetected)
        Quagga.stop()
      }
    }

    // Modo BarcodeDetector: usa CameraContext
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
        const BarcodeDetectorCtor = (window as unknown as { BarcodeDetector: new (opts: unknown) => BarcodeDetectorLike }).BarcodeDetector
        const detector = new BarcodeDetectorCtor({
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
                playSuccessFeedback()
                onCode(raw)
              }
            }
          } catch (e) {
            console.error('Error al detectar código de barras', e)
          }

          requestAnimationFrame(scanFrame)
        }

        requestAnimationFrame(scanFrame)
      }
    }

    start()

    return () => {
      cancelled = true
      detectorRef.current = null
      const stream = streamRef.current
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }
  }, [onCode, requestStream, containerRef, videoRef])

  const [torchOnState, setTorchOnState] = useState(false)

  const toggleTorch = useCallback(async () => {
    const stream = streamRef.current
    if (!stream) return
    const track = stream.getVideoTracks()[0]
    const next = !torchOnState
    try {
      await (track as MediaStreamTrack & { applyConstraints: (c: unknown) => Promise<void> }).applyConstraints({
        advanced: [{ torch: next }],
      })
      setTorchOnState(next)
    } catch (e) {
      console.error('No se pudo cambiar el estado del flash', e)
    }
  }, [torchOnState])

  // Quagga2 no expone el video stream para torch; ocultamos el botón en ese modo
  const effectiveHasTorch = USE_QUAGGA ? false : hasTorch
  const effectiveCaptureManual = USE_QUAGGA ? undefined : captureManual
  const effectiveCapturing = USE_QUAGGA ? false : capturing

  return {
    useQuagga: USE_QUAGGA,
    videoRef,
    containerRef,
    error: cameraError ?? error,
    hasTorch: effectiveHasTorch,
    torchOn: torchOnState,
    toggleTorch,
    captureManual: effectiveCaptureManual,
    capturing: effectiveCapturing,
  }
}
