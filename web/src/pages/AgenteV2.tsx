import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Mic, MicOff, Send, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { ThinkingOrb } from 'thinking-orbs'
import { useAIChat, type AgentCard, type CambioPropuesto, type RegistroPropuesto } from '../hooks/useAIChat'
import { useRegistroRetorno } from '../hooks/useRegistroRetorno'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import './agente-v2.css'

const SUGERENCIAS = [
  '¿Dónde está el bien con código 7521487526?',
  '¿Cuántas computadoras hay en buen estado?',
  'Cambia el estado del bien 7521487526 a Bueno',
]

const ESTADO_COLOR: Record<string, string> = {
  Nuevo: '#5fe3a8',
  Bueno: '#5fe3a8',
  Regular: '#ffb648',
  Malo: '#ff9a4d',
  'Muy malo': '#ff6b6b',
}

const CAMPO_LABEL: Record<string, string> = {
  estado: 'Estado',
  ubicacion: 'Ubicación',
  responsable: 'Responsable',
}

function ConfirmCard({ payload }: { payload: { bien: Record<string, unknown>; cambios: CambioPropuesto[] } }) {
  const { user, canEdit } = useAuth()
  const [estado, setEstado] = useState<'pendiente' | 'ejecutando' | 'aplicado' | 'cancelado' | 'error'>('pendiente')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const { bien, cambios } = payload

  const ejecutar = async () => {
    setEstado('ejecutando')
    setErrorMsg(null)
    try {
      const updateData = cambios.reduce((acc, c) => ({ ...acc, ...c.update }), {} as Record<string, unknown>)
      const { error } = await supabase.from('bienes').update(updateData).eq('id', bien.id)
      if (error) throw new Error(error.message)
      for (const c of cambios) {
        await supabase.from('bien_historial').insert({
          bien_id: bien.id,
          campo: c.campo,
          valor_antes: c.valor_antes,
          valor_despues: c.valor_despues,
          usuario_id: user?.id ?? null,
          usuario_email: user?.email ?? null,
          accion: 'edicion',
        })
      }
      setEstado('aplicado')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Error inesperado')
      setEstado('error')
    }
  }

  return (
    <div className="av2-panel warn">
      <div className="av2-confirm-title">
        <span>⚠ Edición propuesta · {String(bien.codigo_patrimonial ?? '')}</span>
      </div>
      {cambios.map((c) => (
        <div key={c.campo} className="av2-diff-row">
          <span className="av2-diff-label">{CAMPO_LABEL[c.campo] ?? c.campo}</span>
          <span className="av2-diff-before">{c.valor_antes ?? '—'}</span>
          <span style={{ color: 'var(--av2-warn)' }}>→</span>
          <span className="av2-diff-after">{c.valor_despues ?? '—'}</span>
        </div>
      ))}

      {estado === 'pendiente' && !canEdit && (
        <p className="av2-confirm-note muted">Tu rol es de consulta: no puedes aplicar ediciones.</p>
      )}
      {estado === 'pendiente' && canEdit && (
        <div className="av2-confirm-actions">
          <button className="av2-btn av2-btn--confirm" onClick={() => void ejecutar()}>Confirmar</button>
          <button className="av2-btn" onClick={() => setEstado('cancelado')}>Cancelar</button>
        </div>
      )}
      {estado === 'ejecutando' && <p className="av2-confirm-note muted">Aplicando cambios…</p>}
      {estado === 'aplicado' && (
        <p className="av2-confirm-note ok"><CheckCircle2 size={13} /> Aplicado y registrado en el historial</p>
      )}
      {estado === 'cancelado' && (
        <p className="av2-confirm-note muted"><XCircle size={13} /> Cancelado — no se cambió nada</p>
      )}
      {estado === 'error' && (
        <div>
          <p className="av2-confirm-note bad">No se pudo aplicar: {errorMsg}</p>
          <button className="av2-btn" style={{ marginTop: 6 }} onClick={() => void ejecutar()}>Reintentar</button>
        </div>
      )}
    </div>
  )
}

function RegistroPropuestoCard({ payload }: { payload: RegistroPropuesto }) {
  const { canEdit } = useAuth()
  const detalles: [string, string][] = []
  if (payload.codigo) detalles.push(['Código', payload.codigo])
  if (payload.tipo) detalles.push(['Tipo', payload.tipo])
  if (payload.estado) detalles.push(['Estado', payload.estado])
  if (payload.marca) detalles.push(['Marca', payload.marca])
  if (payload.modelo) detalles.push(['Modelo', payload.modelo])
  if (payload.serie) detalles.push(['N° Serie', payload.serie])
  if (payload.orden_compra) detalles.push(['Orden de compra', payload.orden_compra])
  if (payload.valor != null) detalles.push(['Valor', `S/. ${payload.valor}`])
  if (payload.nombre_responsable) detalles.push(['Responsable', payload.nombre_responsable])
  if (payload.ubicacion_nombre) detalles.push(['Ubicación', payload.ubicacion_nombre])

  const params = new URLSearchParams()
  params.set('retorno', '/agente-v2')
  if (payload.codigo) params.set('codigo', payload.codigo)
  if (payload.tipo) params.set('pre_tipo', payload.tipo)
  if (payload.estado) params.set('pre_estado', payload.estado)
  if (payload.id_trabajador != null) params.set('pre_trabajador', String(payload.id_trabajador))
  if (payload.id_ubicacion != null) params.set('pre_ubicacion', String(payload.id_ubicacion))
  // Código coincidió en SIGA: datos técnicos van como siga_* (igual que el registro
  // manual en Scan.tsx), priorizados por BienForm sobre cualquier otro valor.
  if (payload.desde_siga) {
    params.set('siga_descripcion', payload.nombre)
    if (payload.marca) params.set('siga_marca', payload.marca)
    if (payload.modelo) params.set('siga_modelo', payload.modelo)
    if (payload.serie) params.set('siga_serie', payload.serie)
    if (payload.orden_compra) params.set('siga_oc', payload.orden_compra)
    if (payload.valor != null) params.set('siga_valor', String(payload.valor))
  } else {
    params.set('pre_nombre', payload.nombre)
    if (payload.marca) params.set('pre_marca', payload.marca)
    if (payload.modelo) params.set('pre_modelo', payload.modelo)
    if (payload.serie) params.set('pre_serie', payload.serie)
    if (payload.orden_compra) params.set('pre_oc', payload.orden_compra)
    if (payload.valor != null) params.set('pre_valor', String(payload.valor))
  }

  return (
    <div className="av2-panel warn">
      <div className="av2-confirm-title">
        <span>⚠ Registro propuesto{payload.desde_siga ? ' · Desde SIGA' : ''}</span>
      </div>
      <div className="av2-nombre">{payload.nombre}</div>
      {detalles.map(([label, valor]) => (
        <div key={label} className="av2-diff-row">
          <span className="av2-diff-label">{label}</span>
          <span className="av2-diff-after">{valor}</span>
        </div>
      ))}
      {canEdit ? (
        <div className="av2-confirm-actions">
          <Link to={`/registro?${params.toString()}`} className="av2-btn av2-btn--confirm">
            Abrir formulario prellenado
          </Link>
        </div>
      ) : (
        <p className="av2-confirm-note muted">Tu rol es de consulta: no puedes registrar bienes.</p>
      )}
    </div>
  )
}

function Cards({ cards }: { cards: AgentCard[] }) {
  return (
    <>
      {cards.map((card, i) => {
        if (card.tipo === 'bien') {
          const b = card.payload
          const t = b.trabajadores as { nombre?: string } | null | undefined
          return (
            <Link key={i} to={`/bienes/${b.id}`} className="av2-panel">
              <div className="av2-row-top">
                <div>
                  <div className="av2-nombre">{String(b.nombre_mueble_equipo ?? '')}</div>
                  <div className="av2-codigo">{String(b.codigo_patrimonial ?? '')}</div>
                </div>
                {b.estado ? (
                  <span className="av2-chip" style={{ color: ESTADO_COLOR[b.estado as string] }}>
                    {String(b.estado)}
                  </span>
                ) : null}
              </div>
              <div className="av2-meta">
                {b.ubicacion ? <span>📍 <b>{String(b.ubicacion)}</b></span> : null}
                {t?.nombre ? <span>👤 <b>{t.nombre}</b></span> : null}
              </div>
              <div className="av2-goto">VER DETALLE →</div>
            </Link>
          )
        }
        if (card.tipo === 'lista') {
          const { resultados, total } = card.payload
          return (
            <div key={i} className="av2-panel">
              <div className="av2-goto" style={{ marginTop: 0, marginBottom: 6 }}>
                {total} RESULTADO{total === 1 ? '' : 'S'}
              </div>
              {resultados.map((item) => {
                const t = item.trabajadores as { nombre?: string } | null | undefined
                return (
                  <Link key={String(item.id)} to={`/bienes/${item.id}`} className="av2-list-item">
                    <div className="info">
                      <p>{String(item.nombre_mueble_equipo ?? '')}</p>
                      <p>
                        {String(item.codigo_patrimonial ?? '')}
                        {item.ubicacion ? ` · ${item.ubicacion}` : ''}
                        {t?.nombre ? ` · ${t.nombre}` : ''}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          )
        }
        if (card.tipo === 'conteo') {
          const { total, filtros } = card.payload
          const desc = Object.entries(filtros || {})
            .filter(([, v]) => v !== undefined && v !== null && v !== '')
            .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
            .join(' · ')
          return (
            <div key={i} className="av2-panel av2-conteo">
              <span className="num">{total}</span>
              <span className="desc">{desc || 'bienes en total'}</span>
            </div>
          )
        }
        if (card.tipo === 'confirmacion') return <ConfirmCard key={i} payload={card.payload} />
        if (card.tipo === 'registro') return <RegistroPropuestoCard key={i} payload={card.payload} />
        return null
      })}
    </>
  )
}

export function AgenteV2() {
  const navigate = useNavigate()
  const { messages, loading, error, sendMessage, clearMessages, appendAssistantMessage } = useAIChat()
  useRegistroRetorno(appendAssistantMessage)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const voz = useSpeechRecognition((texto) => {
    setInput((prev) => (prev ? `${prev} ${texto}` : texto))
  })

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
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

  const caption = voz.listening
    ? { text: 'Escuchando', hint: 'toca el núcleo para detener' }
    : loading
      ? { text: 'Procesando', hint: null }
      : { text: 'En espera', hint: 'toca el núcleo o escribe abajo' }

  return (
    <div className="av2">
      <div className="av2-shell">
        <div className="av2-bar">
          <div className="av2-id">
            <button className="av2-back" onClick={() => navigate('/')} aria-label="Volver" type="button">
              <ArrowLeft size={14} />
            </button>
            INVSNEJ · <b>AGENTE</b> v2
          </div>
          <div className={`av2-status ${error ? 'err' : 'ok'}`}>
            <span className="dot" />
            {error ? 'error' : 'enlazado'}
          </div>
        </div>

        <div className="av2-core-stage">
          <div
            className={`av2-core-wrap ${voz.listening ? 'listening' : ''}`}
            onClick={() => (voz.listening ? voz.stop() : voz.start())}
            role="button"
            tabIndex={0}
            aria-label={voz.listening ? 'Detener micrófono' : 'Activar micrófono'}
          >
            <div className="av2-ring av2-ring--1" />
            <div className="av2-ring av2-ring--2" />
            <div className="av2-ring av2-ring--3" />
            <div className="av2-orb-canvas">
              <ThinkingOrb
                state={voz.listening ? 'listening' : 'working'}
                size={64}
                theme="dark"
                paused={!voz.listening && !loading}
                aria-label={voz.listening ? 'Escuchando' : loading ? 'Pensando' : 'En espera'}
              />
            </div>
            {voz.listening && (
              <div className="av2-wave">
                <span /><span /><span /><span /><span /><span />
              </div>
            )}
          </div>
        </div>
        <p className={`av2-caption ${voz.listening ? 'listening' : ''}`}>
          {caption.text}
          {caption.hint && <small>{caption.hint}</small>}
        </p>

        <div className="av2-scroll" ref={scrollRef}>
          <div className="av2-thread">
            {messages.length === 0 && (
              <div className="av2-empty">
                <p>Pide lo que necesites del inventario, por voz o texto.</p>
                <div className="av2-sug">
                  {SUGERENCIAS.map((s) => (
                    <button key={s} type="button" onClick={() => void sendMessage(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id}>
                <div className={`av2-msg ${msg.role === 'user' ? 'user' : 'agent'}`}>
                  {msg.role === 'assistant' && <div className="av2-avatar" />}
                  <div className="av2-bubble">{msg.content}</div>
                </div>
                {msg.role === 'assistant' && msg.cards && msg.cards.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Cards cards={msg.cards} />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="av2-msg agent">
                <div className="av2-avatar" />
                <div className="av2-bubble av2-typing">
                  <ThinkingOrb state="working" size={20} theme="dark" aria-label="Pensando..." />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="av2-input-bar">
          {!voz.listening && voz.autoStopReason && (
            <div className="av2-alert">
              <MicOff size={13} />
              {voz.autoStopReason === 'inactividad' && 'Micrófono apagado por inactividad (1 min sin voz).'}
              {voz.autoStopReason === 'limite' && 'Micrófono apagado: límite de 3 minutos.'}
              {voz.autoStopReason === 'segundo_plano' && 'Micrófono apagado al salir de la app.'}
            </div>
          )}
          {(error || voz.error) && <div className="av2-alert err">{error || voz.error}</div>}
          <div className="av2-row">
            {voz.supported && (
              <button
                className={`av2-mic ${voz.listening ? 'listening' : ''}`}
                onClick={voz.listening ? voz.stop : voz.start}
                disabled={loading}
                type="button"
                aria-label={voz.listening ? 'Detener' : 'Hablar'}
              >
                {voz.listening ? <MicOff size={17} /> : <Mic size={17} />}
              </button>
            )}
            <textarea
              className="av2-field"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={voz.listening ? 'Dictando…' : 'Pide lo que necesites…'}
              rows={1}
              disabled={loading}
            />
            <button className="av2-send" onClick={handleSend} disabled={!input.trim() || loading} type="button" aria-label="Enviar">
              {loading ? <Loader2 size={16} className="av2-spin" /> : <Send size={16} />}
            </button>
          </div>
          <p className="av2-hint">
            {messages.length > 0 ? (
              <button
                type="button"
                onClick={clearMessages}
                style={{ background: 'none', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer' }}
              >
                nueva conversación ·{' '}
              </button>
            ) : null}
            ninguna edición se aplica sin tu confirmación
          </p>
        </div>
      </div>
    </div>
  )
}
