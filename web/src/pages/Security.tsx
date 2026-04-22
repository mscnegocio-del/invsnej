import { useEffect, useMemo, useState } from 'react'
import { Fingerprint, Loader2, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { listPasskeys, revokePasskey } from '../lib/passkeysApi'
import { useWebAuthn } from '../hooks/useWebAuthn'
import type { UserPasskey } from '../types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Skeleton } from '../components/ui/skeleton'
import { Separator } from '../components/ui/separator'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog'

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
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null)

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

  useEffect(() => { void load() }, [])

  const handleRegister = async () => {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const result = await registerPasskey(window.location.origin, inferDeviceName())
      if (result === 'unsupported') { setError('Este dispositivo o navegador no soporta passkeys.'); return }
      if (result === 'cancelled') { setError('Se canceló el registro de la passkey.'); return }
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
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="page-title">Seguridad de acceso</h1>
        <p className="page-subtitle">
          Primer acceso con código por correo. Luego puedes ingresar con huella, PIN o biometría del dispositivo.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Passkeys
                {!loading && activos.length > 0 && (
                  <Badge variant="success" className="text-xs">
                    {activos.length} activa{activos.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                Correo: <span className="font-medium text-foreground">{user?.email ?? '—'}</span>
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void load()}
              disabled={loading || saving}
              className="gap-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {!isSupported && (
            <Alert variant="warning">
              <AlertDescription>
                Este dispositivo o navegador no soporta passkeys/WebAuthn.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {message && (
            <Alert variant="success">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={() => void handleRegister()}
            disabled={!isSupported || saving}
            className="gap-2"
          >
            {saving
              ? <><Loader2 className="h-4 w-4 animate-spin" />Procesando…</>
              : <><Fingerprint className="h-4 w-4" />{activos.length > 0 ? 'Registrar otra passkey' : 'Registrar passkey'}</>
            }
          </Button>

          {loading ? (
            <div className="space-y-3">
              {[0, 1].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            </div>
          ) : activos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no tienes passkeys registradas. Después de registrarla, podrás ingresar más rápido en este dispositivo.
            </p>
          ) : (
            <div className="space-y-3">
              <Separator />
              {activos.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-foreground">{item.device_name ?? 'Dispositivo sin nombre'}</p>
                    <p className="text-xs text-muted-foreground">Registrada: {formatDate(item.created_at)}</p>
                    <p className="text-xs text-muted-foreground">Último uso: {formatDate(item.last_used_at)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive gap-2 self-start sm:self-auto"
                    onClick={() => setRevokeTarget(item.id)}
                    disabled={saving}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Revocar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>

      <AlertDialog open={revokeTarget !== null} onOpenChange={(open) => { if (!open) setRevokeTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Revocar esta passkey?</AlertDialogTitle>
            <AlertDialogDescription>
              Perderás el acceso rápido desde este dispositivo. Podrás registrar una nueva passkey en cualquier momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { void handleRevoke(revokeTarget!); setRevokeTarget(null) }}
            >
              Sí, revocar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
