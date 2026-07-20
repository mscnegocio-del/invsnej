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

// Protecciones contra micrófono olvidado
const INACTIVIDAD_MS = 60_000 // sin voz detectada → apagar
const SESION_MAX_MS = 180_000 // tope duro de dictado continuo

export type AutoStopReason = 'inactividad' | 'limite' | 'segundo_plano' | null

// Dictado continuo: acumula texto final vía onSegment y solo termina cuando el
// usuario detiene el micrófono, o por protección automática (inactividad,
// tope de sesión, app en segundo plano).
export function useSpeechRecognition(onSegment: (texto: string) => void) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [autoStopReason, setAutoStopReason] = useState<AutoStopReason>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const stopRequestedRef = useRef(false)
  const inactividadTimerRef = useRef<number | null>(null)
  const sesionTimerRef = useRef<number | null>(null)
  const onSegmentRef = useRef(onSegment)
  onSegmentRef.current = onSegment

  const supported = getSpeechRecognition() !== null

  const clearTimers = () => {
    if (inactividadTimerRef.current) clearTimeout(inactividadTimerRef.current)
    if (sesionTimerRef.current) clearTimeout(sesionTimerRef.current)
    inactividadTimerRef.current = null
    sesionTimerRef.current = null
  }

  const stopWith = useCallback((reason: AutoStopReason) => {
    stopRequestedRef.current = true
    clearTimers()
    if (reason) setAutoStopReason(reason)
    recognitionRef.current?.stop()
  }, [])

  const stop = useCallback(() => stopWith(null), [stopWith])

  const armInactividad = useCallback(() => {
    if (inactividadTimerRef.current) clearTimeout(inactividadTimerRef.current)
    inactividadTimerRef.current = window.setTimeout(
      () => stopWith('inactividad'),
      INACTIVIDAD_MS
    )
  }, [stopWith])

  const start = useCallback(() => {
    const Ctor = getSpeechRecognition()
    if (!Ctor || listening) return
    setError(null)
    setInterim('')
    setAutoStopReason(null)
    stopRequestedRef.current = false

    const rec = new Ctor()
    rec.lang = 'es-PE'
    rec.continuous = true
    rec.interimResults = true

    rec.onresult = (event: any) => {
      armInactividad() // hay voz: reiniciar contador de inactividad
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
      clearTimers()
      setListening(false)
    }

    recognitionRef.current = rec
    setListening(true)
    armInactividad()
    sesionTimerRef.current = window.setTimeout(() => stopWith('limite'), SESION_MAX_MS)
    rec.start()
  }, [listening, armInactividad, stopWith])

  // App en segundo plano o pantalla bloqueada → apagar el micrófono
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && recognitionRef.current) {
        stopWith('segundo_plano')
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [stopWith])

  useEffect(
    () => () => {
      stopRequestedRef.current = true
      clearTimers()
      recognitionRef.current?.abort()
    },
    []
  )

  return { supported, listening, interim, error, autoStopReason, start, stop }
}
