import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

// Historial persistido en sessionStorage para sobrevivir navegaciones
// (p. ej. ir a /registro desde una tarjeta y volver al Agente)
const STORAGE_KEY = 'inv:agente_chat'

function loadStoredMessages(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as (Omit<ChatMessage, 'timestamp'> & { timestamp: string })[]
    if (!Array.isArray(parsed)) return []
    return parsed.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }))
  } catch {
    return []
  }
}

export type CambioPropuesto = {
  campo: 'estado' | 'ubicacion' | 'responsable'
  valor_antes: string | null
  valor_despues: string | null
  update: Record<string, unknown>
}

export type RegistroPropuesto = {
  nombre: string
  codigo?: string
  tipo?: string
  estado?: string
  marca?: string
  modelo?: string
  serie?: string
  orden_compra?: string
  valor?: number
  id_trabajador?: number
  nombre_responsable?: string
  id_ubicacion?: number
  ubicacion_nombre?: string
  desde_siga?: boolean
}

export type AgentCard =
  | { tipo: 'bien'; payload: Record<string, unknown> }
  | { tipo: 'lista'; payload: { resultados: Record<string, unknown>[]; total: number } }
  | { tipo: 'conteo'; payload: { total: number; filtros: Record<string, unknown> } }
  | { tipo: 'confirmacion'; payload: { bien: Record<string, unknown>; cambios: CambioPropuesto[] } }
  | { tipo: 'registro'; payload: RegistroPropuesto }

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  cards?: AgentCard[]
}

type ApiMessage = {
  role: 'user' | 'assistant'
  content: string
}

export function useAIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(loadStoredMessages)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      if (messages.length === 0) sessionStorage.removeItem(STORAGE_KEY)
      else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    } catch { /* noop */ }
  }, [messages])

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

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sin sesión activa')

      const historial: ApiMessage[] = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const res = await supabase.functions.invoke('ai-chat', {
        body: { messages: historial },
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (res.error) {
        const errorMsg = typeof res.error === 'string' ? res.error : res.error?.message
        throw new Error(errorMsg || 'Error desconocido del servidor')
      }

      const reply = res.data?.reply as string | undefined
      if (!reply) throw new Error('El asistente no pudo procesar tu pregunta')

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
        cards: Array.isArray(res.data?.cards) ? (res.data.cards as AgentCard[]) : undefined,
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [messages, loading])

  // Inserta un mensaje del asistente sin llamar al modelo
  // (p. ej. la confirmación al volver de /registro)
  const appendAssistantMessage = useCallback((content: string, cards?: AgentCard[]) => {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'assistant', content, timestamp: new Date(), cards },
    ])
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return { messages, loading, error, sendMessage, clearMessages, appendAssistantMessage }
}
