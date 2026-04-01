import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { listPasskeys, revokePasskey } from '../lib/passkeysApi'
import { useWebAuthn } from '../hooks/useWebAuthn'
import type { UserPasskey } from '../types'

function formatDate(value: string | null) {
  if (!value) return 'Nunca'
  return new Date(value).toLocaleString('es-PE')
}

function inferDeviceName() {
  const ua = navigator.userAgent
  if (/android/i.test(ua)) return 'Android'
  if (/iphone|ipad|ipod/i.test(ua)) return 'iPhone / iPad'
  if (/windows/i.test(ua)) return 'Windows'
  if (/macintosh|mac os x/i.test(ua)) return 'Mac'
  return 'Este dispositivo'
}

export function Security() {
  const { user } = useAuth()
  const { isSupported, registerPasskey } = useWebAuthn()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<UserPasskey[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const activos = useMemo(() => items.filter((p) => !p.revoked_at), [items])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setItems(await listPasskeys())
    } catch (e) {
      console.error(e)
      setError('No se pudieron cargar tus passkeys.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleRegister = async () => {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const result = await registerPasskey(window.location.origin, inferDeviceName())
      if (result === 'unsupported') {
        setError('Este dispositivo o navegador no soporta passkeys.')
        return
      }
      if (result === 'cancelled') {
        setError('Se canceló el registro de la passkey.')
        return
      }
      setMessage('Passkey registrada correctamente.')
      await load()
    } catch (e) {
      console.error(e)
      setError('No se pudo registrar la passkey. Intenta nuevamente.')
    } finally {
      setSaving(false)
    }
  }

  const handleRevoke = async (passkeyId: string) => {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      await revokePasskey(passkeyId)
      setMessage('Passkey revocada correctamente.')
      await load()
    } catch (e) {
      console.error(e)
      setError('No se pudo revocar la passkey.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Seguridad de acceso</h1>
        <p className="page-subtitle">
          Primer acceso con código por correo. Luego puedes ingresar con huella, PIN o biometría del
          dispositivo.
        </p>
      </div>

      <section className="card p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Passkeys</h2>
          <p className="mt-1 text-sm text-slate-600">
            Correo asociado: <span className="font-medium text-slate-700">{user?.email ?? '—'}</span>
          </p>
        </div>

        {!isSupported && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Este dispositivo o navegador no soporta passkeys/WebAuthn.
          </p>
        )}

        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {message && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleRegister()}
            disabled={!isSupported || saving}
            className="btn-primary"
          >
            {saving ? 'Procesando…' : activos.length > 0 ? 'Registrar otra passkey' : 'Registrar passkey'}
          </button>
          <button type="button" onClick={() => void load()} disabled={loading || saving} className="btn-secondary">
            {loading ? 'Actualizando…' : 'Actualizar lista'}
          </button>
        </div>

        <div className="space-y-3">
          {loading && <p className="text-sm text-slate-500">Cargando passkeys…</p>}
          {!loading && activos.length === 0 && (
            <p className="text-sm text-slate-600">
              Aún no tienes passkeys registradas. Después de registrarla, podrás ingresar más rápido en este
              dispositivo.
            </p>
          )}
          {!loading &&
            activos.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-900">{item.device_name ?? 'Dispositivo sin nombre'}</p>
                  <p className="text-xs text-slate-500">Registrada: {formatDate(item.created_at)}</p>
                  <p className="text-xs text-slate-500">Último uso: {formatDate(item.last_used_at)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRevoke(item.id)}
                  disabled={saving}
                  className="btn-ghost text-red-600"
                >
                  Revocar
                </button>
              </div>
            ))}
        </div>
      </section>
    </div>
  )
}
