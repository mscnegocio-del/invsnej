import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Bot, Mic, MicOff, Send, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import { cn } from '../lib/utils'
import { useAIChat } from '../hooks/useAIChat'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { AgentCards } from '../components/AgentCards'

const SUGERENCIAS = [
  '¿Dónde está el bien con código 7521487526?',
  '¿Cuántas computadoras hay en buen estado?',
  '¿Qué bienes tiene asignados Oliver?',
  'Muéstrame los proyectores en mal estado',
  'Cambia el estado del bien 7521487526 a Bueno',
]

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 justify-start">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Bot className="h-4 w-4 text-primary" />
      </div>
      <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          <span className="block h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
          <span className="block h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
          <span className="block h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )
}

export function Agente() {
  const { messages, loading, error, sendMessage, clearMessages } = useAIChat()
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  // El dictado se acumula en el campo de texto; el usuario revisa y envía
  const voz = useSpeechRecognition((texto) => {
    setInput((prev) => (prev ? `${prev} ${texto}` : texto))
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, voz.interim])

  const handleSend = () => {
    if (!input.trim() || loading) return
    if (voz.listening) voz.stop()
    void sendMessage(input)
    setInput('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-[calc(100dvh-8.5rem)] sm:h-[calc(100dvh-5rem)] max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-border shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="text-base font-semibold leading-none">Agente</h1>
            <span className="inline-flex items-center rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Beta</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Habla o escribe: yo consulto el inventario</p>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
            onClick={clearMessages}
            title="Nueva conversación"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Conversación */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-4 px-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-base font-medium text-foreground">¿Qué necesitas del inventario?</p>
              <p className="text-xs text-muted-foreground mt-1">
                Pídelo con tu voz{voz.supported ? ' (toca el micrófono)' : ''} o escríbelo.
                Te muestro fichas, listas y conteos al instante.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-sm">
              {SUGERENCIAS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void sendMessage(s)}
                  className="text-left text-xs px-3 py-2 rounded-xl border border-border bg-muted/40 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="space-y-2">
            <div
              className={cn(
                'flex items-end gap-2',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {msg.role === 'assistant' && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted text-foreground rounded-bl-sm'
                )}
              >
                {msg.content}
              </div>
            </div>
            {msg.role === 'assistant' && msg.cards && msg.cards.length > 0 && (
              <div className="pl-9">
                <AgentCards cards={msg.cards} />
              </div>
            )}
          </div>
        ))}

        {loading && <TypingIndicator />}

        {(error || voz.error) && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
            <p className="font-semibold">Error:</p>
            <p>{error || voz.error}</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Entrada */}
      <div className="pt-3 border-t border-border shrink-0">
        {!voz.listening && voz.autoStopReason && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <MicOff className="h-3.5 w-3.5 shrink-0" />
            <p className="flex-1 min-w-0">
              {voz.autoStopReason === 'inactividad' && 'Micrófono apagado por inactividad (1 min sin voz). Lo dictado quedó en el campo.'}
              {voz.autoStopReason === 'limite' && 'Micrófono apagado: se alcanzó el límite de 3 minutos de dictado continuo.'}
              {voz.autoStopReason === 'segundo_plano' && 'Micrófono apagado al salir de la app.'}
            </p>
          </div>
        )}
        {voz.listening && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
            </span>
            <p className="flex-1 min-w-0 truncate text-xs text-muted-foreground italic">
              {voz.interim || 'Escuchando… habla con calma, toca el micrófono rojo para detener'}
            </p>
            <Button
              size="sm"
              variant="destructive"
              onClick={voz.stop}
              className="h-7 px-2 text-xs shrink-0"
            >
              <MicOff className="h-3.5 w-3.5 mr-1" />
              Detener
            </Button>
          </div>
        )}
        <div className="flex gap-2 items-end">
          {voz.supported && (
            <Button
              size="icon"
              variant={voz.listening ? 'destructive' : 'outline'}
              onClick={voz.listening ? voz.stop : voz.start}
              disabled={loading}
              className={cn('shrink-0 h-10 w-10', voz.listening && 'animate-pulse')}
              title={voz.listening ? 'Detener' : 'Hablar'}
            >
              {voz.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          )}
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={voz.listening ? 'Dictando… lo que digas aparecerá aquí' : 'Pide lo que necesites…'}
            rows={1}
            className="flex-1 min-w-0 resize-none min-h-[40px] max-h-[120px] text-base sm:text-sm"
            disabled={loading}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="shrink-0 h-10 w-10"
            title="Enviar (Enter)"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
          Consultas y ediciones con confirmación · Ninguna edición se aplica sin tu OK
        </p>
      </div>
    </div>
  )
}
