import { useEffect, useMemo, useState } from 'react'
import { Loader2, UserPlus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useCatalogs } from '../context/CatalogContext'
import type { Trabajador } from '../types'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Skeleton } from '../components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'

type Row = Trabajador

const ALL_SEDE = '__all__'

function sedeDistintaDeBien(bienSede: number | null | undefined, nuevaSede: number | null | undefined): boolean {
  return (bienSede ?? null) !== (nuevaSede ?? null)
}

export function Trabajadores() {
  const { sedes, reload: reloadCatalogos } = useCatalogs()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cantDeleteMsg, setCantDeleteMsg] = useState<string | null>(null)

  const [draftNombre, setDraftNombre] = useState('')
  const [draftCargo, setDraftCargo] = useState('')
  const [draftSede, setDraftSede] = useState<number | ''>('')
  const [applied, setApplied] = useState<{ n: string; c: string; s: number | '' }>({ n: '', c: '', s: '' })

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [nombre, setNombre] = useState('')
  const [cargo, setCargo] = useState('')
  const [sedeId, setSedeId] = useState<number | ''>('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null)

  const [sedeWarn, setSedeWarn] = useState<{
    bienes: { id: number; codigo_patrimonial: string | null; sede_id: number | null }[]
    nuevaSede: number | null
  } | null>(null)
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)

  const aplicarFiltros = () => {
    setApplied({ n: draftNombre.trim(), c: draftCargo.trim(), s: draftSede })
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      let q = supabase.from('trabajadores').select('id, nombre, sede_id, cargo').order('nombre', { ascending: true })
      if (applied.n) q = q.ilike('nombre', `%${applied.n}%`)
      if (applied.c) q = q.ilike('cargo', `%${applied.c}%`)
      if (applied.s !== '') q = q.eq('sede_id', applied.s)
      const { data, error: supaError } = await q
      if (cancelled) return
      setLoading(false)
      if (supaError) {
        console.error(supaError)
        setError('No se pudieron cargar los trabajadores.')
        setRows([])
        return
      }
      setRows((data ?? []) as Row[])
    })()
    return () => { cancelled = true }
  }, [applied])

  const sedeNombreMap = useMemo(() => {
    const map = new Map<number, string>()
    for (const s of sedes) map.set(s.id, s.nombre)
    return map
  }, [sedes])

  const sedeNombre = (id: number | null | undefined) =>
    id == null ? '—' : sedeNombreMap.get(id) ?? `Sede ${id}`

  const openCreate = () => {
    setEditing(null)
    setNombre('')
    setCargo('')
    setSedeId('')
    setSaveError(null)
    setModalOpen(true)
  }

  const openEdit = (r: Row) => {
    setEditing(r)
    setNombre(r.nombre)
    setCargo(r.cargo ?? '')
    setSedeId(r.sede_id ?? '')
    setSaveError(null)
    setModalOpen(true)
  }

  const ejecutarGuardado = async () => {
    const nombreTrim = nombre.trim()
    if (!nombreTrim) { setSaveError('El nombre es obligatorio.'); return }
    const cargoVal = cargo.trim() || null
    const sedeVal = sedeId === '' ? null : sedeId

    setSaving(true)
    setSaveError(null)

    if (editing) {
      const { error: upErr } = await supabase
        .from('trabajadores')
        .update({ nombre: nombreTrim, cargo: cargoVal, sede_id: sedeVal })
        .eq('id', editing.id)
      setSaving(false)
      if (upErr) { console.error(upErr); setSaveError('No se pudo guardar. Intenta nuevamente.'); return }
    } else {
      const { error: insErr } = await supabase
        .from('trabajadores')
        .insert({ nombre: nombreTrim, cargo: cargoVal, sede_id: sedeVal })
      setSaving(false)
      if (insErr) { console.error(insErr); setSaveError('No se pudo crear. Intenta nuevamente.'); return }
    }

    setModalOpen(false)
    setSedeWarn(null)
    await reloadCatalogos()
    setApplied((prev) => ({ ...prev }))
  }

  const handleSave = async () => {
    const nombreTrim = nombre.trim()
    if (!nombreTrim) { setSaveError('El nombre es obligatorio.'); return }
    const sedeVal = sedeId === '' ? null : sedeId

    if (editing) {
      const prevSede = editing.sede_id ?? null
      if ((prevSede ?? null) !== (sedeVal ?? null)) {
        const { data: bienes, error: bErr } = await supabase
          .from('bienes')
          .select('id, codigo_patrimonial, sede_id')
          .eq('id_trabajador', editing.id)
          .is('eliminado_at', null)
        if (bErr) { console.error(bErr); setSaveError('No se pudo verificar bienes asignados.'); return }
        const lista = (bienes ?? []) as { id: number; codigo_patrimonial: string | null; sede_id: number | null }[]
        const conflictivos = lista.filter((b) => sedeDistintaDeBien(b.sede_id, sedeVal))
        if (conflictivos.length > 0) { setSedeWarn({ bienes: conflictivos, nuevaSede: sedeVal }); return }
      }
    }

    setShowSaveConfirm(true)
  }

  const confirmarSedeWarn = async () => {
    setSedeWarn(null)
    await ejecutarGuardado()
  }

  const confirmarDelete = async () => {
    if (!deleteTarget) return
    const r = deleteTarget
    setDeleteTarget(null)

    const { count, error: cErr } = await supabase
      .from('bienes')
      .select('id', { count: 'exact', head: true })
      .eq('id_trabajador', r.id)
      .is('eliminado_at', null)
    if (cErr) { console.error(cErr); setError('No se pudo verificar bienes asignados.'); return }
    if (count != null && count > 0) {
      setCantDeleteMsg(
        `No se puede eliminar: hay ${count} bien(es) activo(s) con este responsable. Reasigna o edita esos bienes antes.`,
      )
      return
    }

    const { error: dErr } = await supabase.from('trabajadores').delete().eq('id', r.id)
    if (dErr) { console.error(dErr); setError('No se pudo eliminar.'); return }
    await reloadCatalogos()
    setApplied((prev) => ({ ...prev }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Trabajadores</h1>
        <p className="page-subtitle">
          Catálogo de responsables: nombre, cargo y sede. Solo administradores pueden editar.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {cantDeleteMsg && (
        <Alert variant="warning">
          <AlertDescription>{cantDeleteMsg}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[10rem] flex-1 space-y-1.5">
          <Label htmlFor="filtro-nombre">Nombre</Label>
          <Input
            id="filtro-nombre"
            value={draftNombre}
            onChange={(e) => setDraftNombre(e.target.value)}
            placeholder="Filtrar…"
          />
        </div>
        <div className="min-w-[10rem] flex-1 space-y-1.5">
          <Label htmlFor="filtro-cargo">Cargo</Label>
          <Input
            id="filtro-cargo"
            value={draftCargo}
            onChange={(e) => setDraftCargo(e.target.value)}
            placeholder="Filtrar…"
          />
        </div>
        <div className="min-w-[12rem] space-y-1.5">
          <Label>Sede</Label>
          <Select
            value={draftSede === '' ? ALL_SEDE : String(draftSede)}
            onValueChange={(v) => setDraftSede(v === ALL_SEDE ? '' : Number(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SEDE}>Todas</SelectItem>
              {sedes.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="secondary" onClick={aplicarFiltros} disabled={loading}>
          Aplicar
        </Button>
        <Button onClick={openCreate}>
          <UserPlus className="h-4 w-4 mr-2" />
          Nuevo trabajador
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead className="w-28">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No hay trabajadores con estos filtros.
                    </TableCell>
                  </TableRow>
                ) : rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.nombre}</TableCell>
                    <TableCell>{r.cargo ?? '—'}</TableCell>
                    <TableCell>{sedeNombre(r.sede_id)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(r)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar trabajador' : 'Nuevo trabajador'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="tr-nombre">Nombre *</Label>
              <Input id="tr-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tr-cargo">Cargo</Label>
              <Input
                id="tr-cargo"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sede</Label>
              <Select
                value={sedeId === '' ? ALL_SEDE : String(sedeId)}
                onValueChange={(v) => setSedeId(v === ALL_SEDE ? '' : Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin sede" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_SEDE}>Sin sede</SelectItem>
                  {sedes.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {saveError && (
              <Alert variant="destructive">
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Guardando…</>
                : 'Guardar'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar trabajador?</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-muted-foreground">
            Se eliminará a <span className="font-semibold text-foreground">{deleteTarget?.nombre}</span>.
            Esta acción no puede deshacerse.
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmarDelete()}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sede conflict warning */}
      <AlertDialog open={Boolean(sedeWarn)} onOpenChange={(open) => { if (!open) setSedeWarn(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Inconsistencia con bienes asignados</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Este responsable tiene{' '}
              <span className="font-semibold text-foreground">{sedeWarn?.bienes.length}</span>{' '}
              bien(es) cuya sede no coincide con la sede seleccionada. Los bienes no se
              modificarán automáticamente. ¿Confirmas el cambio de sede del trabajador?
            </p>
            <ul className="list-disc pl-5 space-y-1 max-h-36 overflow-y-auto text-xs">
              {sedeWarn?.bienes.slice(0, 15).map((b) => (
                <li key={b.id}>
                  {b.codigo_patrimonial ?? `ID ${b.id}`} — sede: {sedeNombre(b.sede_id)}
                </li>
              ))}
              {(sedeWarn?.bienes.length ?? 0) > 15 && (
                <li>… y {(sedeWarn?.bienes.length ?? 0) - 15} más</li>
              )}
            </ul>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmarSedeWarn()}>
              Confirmar cambio de sede
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmación al crear/editar trabajador */}
      <AlertDialog open={showSaveConfirm} onOpenChange={(open) => { if (!open) setShowSaveConfirm(false) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {editing ? `¿Guardar cambios en ${editing.nombre}?` : '¿Registrar nuevo trabajador?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {editing
                ? 'Se actualizarán los datos de este trabajador en el sistema.'
                : `Se creará un nuevo trabajador con el nombre "${nombre.trim()}".`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowSaveConfirm(false); void ejecutarGuardado() }}>
              Sí, guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
