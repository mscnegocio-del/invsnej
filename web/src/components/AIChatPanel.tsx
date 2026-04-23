import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Bot, Send, Trash2, Sparkles, AlertTriangle } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { ScrollArea } from './ui/scroll-area'
import { Alert, AlertDescription } from './ui/alert'
import { cn } from '../lib/utils'
import { useAIChat } from '../hooks/useAIChat'

interface AIChatPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

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

const SUGERENCIAS = [
  '¿Dónde está el bien con código 7521487526?',
  '¿Cuántos televisores tengo?',
  '¿Cuántas computadoras hay en buen estado?',
  '¿Qué bienes tiene asignados Oliver?',
]

export function AIChatPanel({ open, onOpenChange }: AIChatPanelProps) {
  const { messages, loading, error, sendMessage, clearMessages, lastFallback } = useAIChat()
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [open])

  const handleSend = () => {
    if (!input.trim() || loading) return
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-[420px] p-0 flex flex-col gap-0"
      >
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-sm font-semibold leading-none">Asistente IA</SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Consultas de inventario</p>
            </div>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                onClick={clearMessages}
                title="Limpiar conversación"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* Mensajes */}
        <ScrollArea className="flex-1 px-4">
          <div className="py-4 space-y-4">
            {isEmpty && (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                  <Bot className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">¿En qué te ayudo?</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Puedo consultar bienes, ubicaciones, responsables y más.
                  </p>
                </div>
                <div className="flex flex-col gap-2 w-full">
                  {SUGERENCIAS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        void sendMessage(s)
                      }}
                      className="text-left text-xs px-3 py-2 rounded-xl border border-border bg-muted/40 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
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
            ))}

            {loading && <TypingIndicator />}

            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
                Error: {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="px-4 py-3 border-t border-border shrink-0">
          {lastFallback && (
            <div className="mb-2">
              <Alert variant="warning" className="py-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                <AlertDescription className="text-xs">
                  Servicio principal no disponible. Respondiendo con servicio alternativo.
                </AlertDescription>
              </Alert>
            </div>
          )}
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pregunta sobre tus bienes..."
              rows={1}
              className="resize-none min-h-[40px] max-h-[120px] text-sm"
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
            Enter para enviar · Shift+Enter nueva línea · Solo lectura
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
