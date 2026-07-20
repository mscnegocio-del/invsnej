import { useCallback, useEffect, useRef, useState } from 'react'

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: any) => void) | null
  onerror: ((event: any) => void) | null
  onend: (() => void) | null
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  const w = window as any
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

// Dictado continuo: acumula texto final vía onSegment y solo termina cuando el
// usuario detiene el micrófono (o el navegador corta por silencio prolongado).
export function useSpeechRecognition(onSegment: (texto: string) => void) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const stopRequestedRef = useRef(false)
  const onSegmentRef = useRef(onSegment)
  onSegmentRef.current = onSegment

  const supported = getSpeechRecognition() !== null

  const stop = useCallback(() => {
    stopRequestedRef.current = true
    recognitionRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    const Ctor = getSpeechRecognition()
    if (!Ctor || listening) return
    setError(null)
    setInterim('')
    stopRequestedRef.current = false

    const rec = new Ctor()
    rec.lang = 'es-PE'
    rec.continuous = true
    rec.interimResults = true

    rec.onresult = (event: any) => {
      let finalText = ''
      let interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i]
        if (r.isFinal) finalText += r[0].transcript
        else interimText += r[0].transcript
      }
      setInterim(interimText)
      if (finalText.trim()) onSegmentRef.current(finalText.trim())
    }
    rec.onerror = (event: any) => {
      if (event.error === 'not-allowed') setError('Permiso de micrófono denegado')
      else if (event.error !== 'aborted' && event.error !== 'no-speech') {
        setError(`Error de voz: ${event.error}`)
      }
    }
    rec.onend = () => {
      recognitionRef.current = null
      setInterim('')
      // Algunos navegadores cortan solos tras unos segundos de silencio;
      // si el usuario no pidió detener, reanudar para mantener el dictado activo.
      if (!stopRequestedRef.current) {
        try {
          const again = new Ctor()
          again.lang = rec.lang
          again.continuous = true
          again.interimResults = true
          again.onresult = rec.onresult
          again.onerror = rec.onerror
          again.onend = rec.onend
          recognitionRef.current = again
          again.start()
          return
        } catch {
          /* si falla la reanudación, terminar normalmente */
        }
      }
      setListening(false)
    }

    recognitionRef.current = rec
    setListening(true)
    rec.start()
  }, [listening])

  useEffect(
    () => () => {
      stopRequestedRef.current = true
      recognitionRef.current?.abort()
    },
    []
  )

  return { supported, listening, interim, error, start, stop }
}
