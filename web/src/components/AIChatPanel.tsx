import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Bot, Send, Trash2, Sparkles } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { ScrollArea } from './ui/scroll-area'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog'
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
  const { messages, loading, error, sendMessage, clearMessages } = useAIChat()
  const [input, setInput] = useState('')
  const [showClearConfirm, setShowClearConfirm] = useState(false)
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
              <div className="flex items-center gap-1.5">
                <SheetTitle className="text-sm font-semibold leading-none">Asistente IA</SheetTitle>
                <span className="inline-flex items-center rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Beta</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Consultas de inventario</p>
            </div>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 mr-7 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => setShowClearConfirm(true)}
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
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive space-y-1">
                <p className="font-semibold">Error:</p>
                <p>{error}</p>
                {error.includes('429') && (
                  <p className="text-[10px] mt-2 font-medium">
                    Sin cuota disponible. Espera 1 minuto e intenta de nuevo.
                  </p>
                )}
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="px-4 py-3 border-t border-border shrink-0">
<div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pregunta sobre tus bienes..."
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
            Enter para enviar · Shift+Enter nueva línea · Solo lectura
          </p>
        </div>
      </SheetContent>
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Limpiar conversación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán todos los mensajes de la conversación actual. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearMessages()
                setShowClearConfirm(false)
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Limpiar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}
