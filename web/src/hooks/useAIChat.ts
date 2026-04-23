import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

type ApiMessage = {
  role: 'user' | 'assistant'
  content: string
}

export function useAIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFallback, setLastFallback] = useState(false)

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMsg])
    setLoading(true)
    setError(null)
    setLastFallback(false)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sin sesión activa')

      // Construir historial para la API (solo user/assistant, sin system)
      const historial: ApiMessage[] = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const res = await supabase.functions.invoke('ai-chat', {
        body: { messages: historial },
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (res.error) throw new Error(res.error.message)

      const reply = res.data?.reply as string | undefined
      const fallback = res.data?.fallback as boolean | undefined
      if (!reply) throw new Error('Respuesta vacía del servidor')

      if (fallback) {
        setLastFallback(true)
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [messages, loading])

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return { messages, loading, error, sendMessage, clearMessages, lastFallback }
}
