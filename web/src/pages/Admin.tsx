import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabaseClient'

type SigaRow = {
  codigo_patrimonial: string
  descripcion: string | null
  usuario: string | null
  marca: string | null
  modelo: string | null
  serie: string | null
  orden_compra: string | null
  valor: number | null
}

// Posibles nombres de columna en el Excel SIGA PJ (ajustar según Excel real)
const COLUMN_MAP: Record<keyof SigaRow, string[]> = {
  codigo_patrimonial: ['CÓDIGO', 'CODIGO', 'COD_PATRIMONIAL', 'CÓDIGO PATRIMONIAL', 'CODIGO PATRIMONIAL'],
  descripcion: ['DESCRIPCIÓN', 'DESCRIPCION', 'NOMBRE', 'NOMBRE DEL BIEN'],
  usuario: ['USUARIO', 'RESPONSABLE', 'ASIGNADO', 'USUARIO ASIGNADO'],
  marca: ['MARCA'],
  modelo: ['MODELO'],
  serie: ['N° SERIE', 'SERIE', 'NRO SERIE', 'N_SERIE', 'NUMERO DE SERIE'],
  orden_compra: ['ORDEN DE COMPRA', 'OC', 'N° OC', 'NRO OC', 'ORDEN COMPRA'],
  valor: ['VALOR', 'VALOR ACTUAL', 'COSTO', 'PRECIO'],
}

function normalizeHeader(h: string): string {
  return h.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function mapRow(headers: string[], row: unknown[]): SigaRow | null {
  const get = (candidates: string[]): string | null => {
    const normalized = candidates.map(normalizeHeader)
    const idx = headers.findIndex((h) => normalized.includes(normalizeHeader(h)))
    if (idx === -1) return null
    const v = row[idx]
    return v != null ? String(v).trim() || null : null
  }

  const codigo = get(COLUMN_MAP.codigo_patrimonial)
  if (!codigo) return null

  const valorRaw = get(COLUMN_MAP.valor)
  const valor = valorRaw ? parseFloat(valorRaw.replace(/,/g, '.')) : null

  return {
    codigo_patrimonial: codigo,
    descripcion: get(COLUMN_MAP.descripcion),
    usuario: get(COLUMN_MAP.usuario),
    marca: get(COLUMN_MAP.marca),
    modelo: get(COLUMN_MAP.modelo),
    serie: get(COLUMN_MAP.serie),
    orden_compra: get(COLUMN_MAP.orden_compra),
    valor: valor != null && !Number.isNaN(valor) ? valor : null,
  }
}

const BATCH_SIZE = 500

export function Admin() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<SigaRow[]>([])
  const [allRows, setAllRows] = useState<SigaRow[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [fase, setFase] = useState<'idle' | 'preview' | 'loading' | 'done'>('idle')
  const [progress, setProgress] = useState({ procesados: 0, total: 0 })
  const [resumen, setResumen] = useState<{ exitosos: number; errores: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

        if (raw.length < 2) {
          setError('El archivo no tiene datos suficientes.')
          return
        }

        const hdrs = (raw[0] as unknown[]).map((h) => (h != null ? String(h).trim() : ''))
        setHeaders(hdrs)

        const rows: SigaRow[] = []
        for (let i = 1; i < raw.length; i++) {
          const mapped = mapRow(hdrs, raw[i] as unknown[])
          if (mapped) rows.push(mapped)
        }

        if (rows.length === 0) {
          setError('No se encontraron filas válidas. Verifica que el Excel tenga la columna de código patrimonial.')
          return
        }

        setAllRows(rows)
        setPreview(rows.slice(0, 5))
        setFase('preview')
      } catch (ex) {
        console.error(ex)
        setError('No se pudo leer el archivo. Asegúrate de que sea un Excel válido (.xlsx).')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleConfirmar = async () => {
    setFase('loading')
    setProgress({ procesados: 0, total: allRows.length })
    setResumen(null)
    setError(null)

    let errores = 0
    let exitosos = 0

    for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
      const batch = allRows.slice(i, i + BATCH_SIZE)
      const { error: supaError } = await supabase
        .from('siga_bienes')
        .upsert(batch, { onConflict: 'codigo_patrimonial' })

      if (supaError) {
        console.error('Error en batch', i, supaError)
        errores += batch.length
      } else {
        exitosos += batch.length
      }

      setProgress({ procesados: exitosos + errores, total: allRows.length })
    }

    setResumen({ exitosos, errores })
    setFase('done')
  }

  const handleReset = () => {
    setFase('idle')
    setPreview([])
    setAllRows([])
    setHeaders([])
    setProgress({ procesados: 0, total: 0 })
    setResumen(null)
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const pct = progress.total > 0 ? Math.round((progress.procesados / progress.total) * 100) : 0

  return (
    <div>
      <h1 className="page-title">Administración SIGA PJ</h1>
      <p className="page-subtitle">Carga el Excel del SIGA PJ para pre-rellenar datos al registrar bienes.</p>

      <section className="mt-6 card p-6 space-y-5 max-w-xl">
        <h2 className="text-base font-semibold text-slate-900">Cargar base SIGA PJ</h2>

        {fase === 'idle' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Selecciona el archivo Excel (.xlsx) con los bienes del SIGA PJ. Se usará para pre-rellenar
              descripción, usuario, marca, modelo, serie, orden de compra y valor al registrar un nuevo bien.
            </p>
            <label className="block">
              <span className="sr-only">Seleccionar archivo Excel</span>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFile}
                className="block w-full text-sm text-slate-600
                  file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0
                  file:text-sm file:font-medium file:bg-teal-50 file:text-teal-700
                  hover:file:bg-teal-100"
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}

        {fase === 'preview' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              Se encontraron <strong>{allRows.length.toLocaleString()}</strong> registros válidos.
              Vista previa de los primeros 5:
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="text-xs min-w-full">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    {['Código', 'Descripción', 'Usuario', 'Marca', 'Modelo', 'Serie', 'OC', 'Valor'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.map((r, i) => (
                    <tr key={i} className="text-slate-700">
                      <td className="px-3 py-2 font-mono whitespace-nowrap">{r.codigo_patrimonial}</td>
                      <td className="px-3 py-2 max-w-[160px] truncate">{r.descripcion ?? '—'}</td>
                      <td className="px-3 py-2 max-w-[120px] truncate" title={r.usuario ?? undefined}>{r.usuario ?? '—'}</td>
                      <td className="px-3 py-2">{r.marca ?? '—'}</td>
                      <td className="px-3 py-2">{r.modelo ?? '—'}</td>
                      <td className="px-3 py-2">{r.serie ?? '—'}</td>
                      <td className="px-3 py-2">{r.orden_compra ?? '—'}</td>
                      <td className="px-3 py-2">{r.valor != null ? r.valor.toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">
              Columnas detectadas: {headers.join(', ')}
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={handleReset} className="btn-ghost flex-1">
                Cancelar
              </button>
              <button type="button" onClick={handleConfirmar} className="btn-primary flex-1">
                Confirmar carga ({allRows.length.toLocaleString()} registros)
              </button>
            </div>
          </div>
        )}

        {fase === 'loading' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
              <div>
                <p className="text-sm font-medium text-slate-800">
                  Subiendo a Supabase…
                </p>
                <p className="text-sm text-slate-600 mt-0.5">
                  <strong>{progress.procesados.toLocaleString()}</strong> de{' '}
                  <strong>{progress.total.toLocaleString()}</strong> registros procesados
                </p>
              </div>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-teal-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">{pct}% — No cierres esta pestaña hasta que termine.</p>
          </div>
        )}

        {fase === 'done' && resumen && (
          <div className="space-y-4">
            <div
              className={`rounded-xl border px-4 py-4 text-sm space-y-2 ${
                resumen.errores === 0
                  ? 'bg-teal-50 border-teal-200 text-teal-900'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}
            >
              {resumen.errores === 0 ? (
                <>
                  <p className="text-lg font-semibold text-teal-800">¡Subido correctamente!</p>
                  <p>
                    Se guardaron <strong>{resumen.exitosos.toLocaleString()}</strong> registros en la base SIGA
                    (nuevos o actualizados por código patrimonial).
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold">Carga finalizada con advertencias</p>
                  <p>
                    ✅ Registros OK: <strong>{resumen.exitosos.toLocaleString()}</strong>
                  </p>
                  <p>
                    ⚠️ Registros con error: <strong>{resumen.errores.toLocaleString()}</strong> (revisa la consola del
                    navegador para detalles)
                  </p>
                </>
              )}
            </div>
            <button type="button" onClick={handleReset} className="btn-secondary w-full">
              Cargar otro archivo
            </button>
          </div>
        )}
      </section>

      <section className="mt-6 card p-6 max-w-xl space-y-2">
        <h2 className="text-base font-semibold text-slate-900">Columnas esperadas del Excel</h2>
        <p className="text-sm text-slate-600">
          El sistema detecta automáticamente las columnas. Nombres soportados:
        </p>
        <dl className="text-xs text-slate-600 grid grid-cols-2 gap-y-1 gap-x-4 mt-2">
          {Object.entries(COLUMN_MAP).map(([campo, aliases]) => (
            <div key={campo}>
              <dt className="font-semibold text-slate-700">{campo}:</dt>
              <dd>{aliases.join(', ')}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
