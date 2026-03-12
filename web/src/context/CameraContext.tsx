import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

type CameraContextValue = {
  stream: MediaStream | null
  error: string | null
  isLoading: boolean
  requestStream: () => Promise<MediaStream | null>
}

const CameraContext = createContext<CameraContextValue | undefined>(undefined)

export function CameraProvider({ children }: { children: React.ReactNode }) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const requestStream = useCallback(async (): Promise<MediaStream | null> => {
    if (streamRef.current && streamRef.current.active) return streamRef.current

    setIsLoading(true)
    setError(null)

    try {
      // Resolución 720p para mejor detección de códigos pequeños.
      // focusMode: 'continuous' mejora el enfoque (no está en tipos TS pero algunos navegadores lo soportan).
      const videoConstraints = {
        facingMode: 'environment' as const,
        width: { ideal: 1280 },
        height: { ideal: 720 },
        advanced: [{ focusMode: 'continuous' }],
      }
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints as unknown as MediaTrackConstraints,
        audio: false,
      })
      streamRef.current = newStream
      setStream(newStream)
      setIsLoading(false)
      return newStream
    } catch (e) {
      console.error(e)
      setError('No se pudo acceder a la cámara. Revisa los permisos.')
      setIsLoading(false)
      return null
    }
  }, [])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        setStream(null)
      }
    }
  }, [])

  const value: CameraContextValue = {
    stream,
    error,
    isLoading,
    requestStream,
  }

  return (
    <CameraContext.Provider value={value}>
      {children}
    </CameraContext.Provider>
  )
}

export function useCamera() {
  const ctx = useContext(CameraContext)
  if (!ctx) throw new Error('useCamera must be used within CameraProvider')
  return ctx
}
