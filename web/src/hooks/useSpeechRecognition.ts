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

export function useSpeechRecognition(onFinalResult: (texto: string) => void) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const onFinalRef = useRef(onFinalResult)
  onFinalRef.current = onFinalResult

  const supported = getSpeechRecognition() !== null

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    const Ctor = getSpeechRecognition()
    if (!Ctor || listening) return
    setError(null)
    setInterim('')

    const rec = new Ctor()
    rec.lang = 'es-PE'
    rec.continuous = false
    rec.interimResults = true

    rec.onresult = (event: any) => {
      let finalText = ''
      let interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i]
        if (r.isFinal) finalText += r[0].transcript
        else interimText += r[0].transcript
      }
      if (interimText) setInterim(interimText)
      if (finalText.trim()) {
        setInterim('')
        onFinalRef.current(finalText.trim())
      }
    }
    rec.onerror = (event: any) => {
      if (event.error === 'not-allowed') setError('Permiso de micrófono denegado')
      else if (event.error !== 'aborted' && event.error !== 'no-speech') {
        setError(`Error de voz: ${event.error}`)
      }
    }
    rec.onend = () => {
      setListening(false)
      setInterim('')
      recognitionRef.current = null
    }

    recognitionRef.current = rec
    setListening(true)
    rec.start()
  }, [listening])

  useEffect(() => () => recognitionRef.current?.abort(), [])

  return { supported, listening, interim, error, start, stop }
}
