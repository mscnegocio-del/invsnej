import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useCatalogs } from '../context/CatalogContext'
import type { Trabajador } from '../types'

type Row = Trabajador

function sedeDistintaDeBien(bienSede: number | null | undefined, nuevaSede: number | null | undefined): boolean {
  const a = bienSede ?? null
  const b = nuevaSede ?? null
  return a !== b
}

export function Trabajadores() {
  const { sedes, reload: reloadCatalogos } = useCatalogs()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const [sedeWarn, setSedeWarn] = useState<{
    bienes: { id: number; codigo_patrimonial: string | null; sede_id: number | null }[]
    nuevaSede: number | null
  } | null>(null)

  const aplicarFiltros = () => {
    setApplied({ n: draftNombre.trim(), c: draftCargo.trim(), s: draftSede })
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      let q = supabase.from('trabajadores').select('id, nombre, sede_id, cargo').order('nombre', { ascending: true })
      if (applied.n) {
        q = q.ilike('nombre', `%${applied.n}%`)
      }
      if (applied.c) {
        q = q.ilike('cargo', `%${applied.c}%`)
      }
      if (applied.s !== '') {
        q = q.eq('sede_id', applied.s)
      }
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
    return () => {
      cancelled = true
    }
  }, [applied])

  const sedeNombre = useMemo(() => {
    const map = new Map<number, string>()
    for (const s of sedes) map.set(s.id, s.nombre)
    return (id: number | null | undefined) => (id == null ? '—' : map.get(id) ?? `Sede ${id}`)
  }, [sedes])

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
    if (!nombreTrim) {
      setSaveError('El nombre es obligatorio.')
      return
    }
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
      if (upErr) {
        console.error(upErr)
        setSaveError('No se pudo guardar. Intenta nuevamente.')
        return
      }
    } else {
      const { error: insErr } = await supabase
        .from('trabajadores')
        .insert({ nombre: nombreTrim, cargo: cargoVal, sede_id: sedeVal })
      setSaving(false)
      if (insErr) {
        console.error(insErr)
        setSaveError('No se pudo crear. Intenta nuevamente.')
        return
      }
    }

    setModalOpen(false)
    setSedeWarn(null)
    await reloadCatalogos()
    setApplied((prev) => ({ ...prev }))
  }

  const handleSave = async () => {
    const nombreTrim = nombre.trim()
    if (!nombreTrim) {
      setSaveError('El nombre es obligatorio.')
      return
    }
    const sedeVal = sedeId === '' ? null : sedeId

    if (editing) {
      const prevSede = editing.sede_id ?? null
      const cambiaSede = (prevSede ?? null) !== (sedeVal ?? null)
      if (cambiaSede) {
        const { data: bienes, error: bErr } = await supabase
          .from('bienes')
          .select('id, codigo_patrimonial, sede_id')
          .eq('id_trabajador', editing.id)
          .is('eliminado_at', null)

        if (bErr) {
          console.error(bErr)
          setSaveError('No se pudo verificar bienes asignados.')
          return
        }
        const lista = (bienes ?? []) as { id: number; codigo_patrimonial: string | null; sede_id: number | null }[]
        const conflictivos = lista.filter((b) => sedeDistintaDeBien(b.sede_id, sedeVal))
        if (conflictivos.length > 0) {
          setSedeWarn({ bienes: conflictivos, nuevaSede: sedeVal })
          return
        }
      }
    }

    await ejecutarGuardado()
  }

  const confirmarSedeWarn = async () => {
    setSedeWarn(null)
    await ejecutarGuardado()
  }

  const handleDelete = async (r: Row) => {
    const ok = window.confirm(`¿Eliminar al trabajador "${r.nombre}"?`)
    if (!ok) return

    const { count, error: cErr } = await supabase
      .from('bienes')
      .select('id', { count: 'exact', head: true })
      .eq('id_trabajador', r.id)
      .is('eliminado_at', null)

    if (cErr) {
      console.error(cErr)
      setError('No se pudo verificar bienes asignados.')
      return
    }
    if (count != null && count > 0) {
      window.alert(
        `No se puede eliminar: hay ${count} bien(es) activos con este responsable. Reasigna o edita esos bienes antes.`,
      )
      return
    }

    const { error: dErr } = await supabase.from('trabajadores').delete().eq('id', r.id)
    if (dErr) {
      console.error(dErr)
      setError('No se pudo eliminar.')
      return
    }
    await reloadCatalogos()
    setApplied((prev) => ({ ...prev }))
  }

  return (
    <div>
      <h1 className="page-title">Trabajadores</h1>
      <p className="page-subtitle">Catálogo de responsables: nombre, cargo y sede. Solo administradores pueden editar.</p>

      {error && <p className="mt-4 rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</p>}

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div className="min-w-[10rem] flex-1">
          <label className="label" htmlFor="filtro-nombre">
            Nombre (contiene)
          </label>
          <input
            id="filtro-nombre"
            type="text"
            value={draftNombre}
            onChange={(e) => setDraftNombre(e.target.value)}
            className="input"
            placeholder="Filtrar…"
          />
        </div>
        <div className="min-w-[10rem] flex-1">
          <label className="label" htmlFor="filtro-cargo">
            Cargo (contiene)
          </label>
          <input
            id="filtro-cargo"
            type="text"
            value={draftCargo}
            onChange={(e) => setDraftCargo(e.target.value)}
            className="input"
            placeholder="Filtrar…"
          />
        </div>
        <div className="min-w-[12rem]">
          <label className="label" htmlFor="filtro-sede">
            Sede
          </label>
          <select
            id="filtro-sede"
            value={draftSede === '' ? '' : String(draftSede)}
            onChange={(e) => setDraftSede(e.target.value === '' ? '' : Number(e.target.value))}
            className="input"
          >
            <option value="">Todas</option>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn-secondary" onClick={aplicarFiltros} disabled={loading}>
          Aplicar
        </button>
        <button type="button" className="btn-primary" onClick={openCreate}>
          Nuevo trabajador
        </button>
      </div>

      <div className="mt-6 card overflow-x-auto">
        {loading ? (
          <p className="p-6 text-slate-600">Cargando…</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Cargo</th>
                <th className="px-4 py-3 font-semibold">Sede</th>
                <th className="px-4 py-3 font-semibold w-40">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.nombre}</td>
                  <td className="px-4 py-3 text-slate-700">{r.cargo ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{sedeNombre(r.sede_id)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn-ghost text-sm px-2 py-1" onClick={() => openEdit(r)}>
                        Editar
                      </button>
                      <button type="button" className="btn-ghost text-sm px-2 py-1 text-red-700" onClick={() => void handleDelete(r)}>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && rows.length === 0 && <p className="p-6 text-slate-500">No hay trabajadores con estos filtros.</p>}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true">
          <div className="card max-w-md w-full p-6 space-y-4 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">{editing ? 'Editar trabajador' : 'Nuevo trabajador'}</h2>
            <div>
              <label className="label" htmlFor="tr-nombre">
                Nombre *
              </label>
              <input id="tr-nombre" className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="tr-cargo">
                Cargo
              </label>
              <input
                id="tr-cargo"
                className="input"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div>
              <label className="label" htmlFor="tr-sede">
                Sede
              </label>
              <select
                id="tr-sede"
                className="input"
                value={sedeId === '' ? '' : String(sedeId)}
                onChange={(e) => setSedeId(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">Sin sede</option>
                {sedes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
            {saveError && <p className="text-sm text-red-600">{saveError}</p>}
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>
                Cancelar
              </button>
              <button type="button" className="btn-primary" onClick={() => void handleSave()} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {sedeWarn && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/45" role="dialog" aria-modal="true">
          <div className="card max-w-lg w-full p-6 space-y-4 shadow-xl">
            <h2 className="text-lg font-semibold text-amber-900">Inconsistencia con bienes asignados</h2>
            <p className="text-sm text-slate-700">
              Este responsable tiene {sedeWarn.bienes.length} bien(es) cuya sede no coincide con la sede seleccionada para el
              trabajador. Los bienes no se modifican automáticamente. ¿Confirmas el cambio de sede del trabajador?
            </p>
            <ul className="text-sm text-slate-600 max-h-36 overflow-y-auto list-disc pl-5 space-y-1">
              {sedeWarn.bienes.slice(0, 15).map((b) => (
                <li key={b.id}>
                  {b.codigo_patrimonial ?? `ID ${b.id}`} — sede del bien: {sedeNombre(b.sede_id)}
                </li>
              ))}
              {sedeWarn.bienes.length > 15 && <li>… y {sedeWarn.bienes.length - 15} más</li>}
            </ul>
            <div className="flex gap-2 justify-end flex-wrap">
              <button type="button" className="btn-secondary" onClick={() => setSedeWarn(null)}>
                Cancelar
              </button>
              <button type="button" className="btn-primary" onClick={() => void confirmarSedeWarn()}>
                Confirmar cambio de sede
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
