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
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
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
