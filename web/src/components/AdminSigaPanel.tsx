import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { Loader2, CheckCircle, AlertTriangle, Upload } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { Button } from './ui/button'
import { Card, CardHeader, CardContent, CardTitle } from './ui/card'
import { Alert, AlertTitle, AlertDescription } from './ui/alert'
import { Progress } from './ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'

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

export function AdminSigaPanel() {
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
        if (raw.length < 2) { setError('El archivo no tiene datos suficientes.'); return }
        const hdrs = (raw[0] as unknown[]).map((h) => h != null ? String(h).trim() : '')
        setHeaders(hdrs)
        const rows: SigaRow[] = []
        for (let i = 1; i < raw.length; i++) {
          const mapped = mapRow(hdrs, raw[i] as unknown[])
          if (mapped) rows.push(mapped)
        }
        if (rows.length === 0) { setError('No se encontraron filas válidas. Verifica la columna de código patrimonial.'); return }
        setAllRows(rows)
        setPreview(rows.slice(0, 5))
        setFase('preview')
      } catch {
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
      if (supaError) errores += batch.length
      else exitosos += batch.length
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
    <div className="space-y-6">
      <p className="page-subtitle">Carga el Excel del SIGA PJ para pre-rellenar datos al registrar bienes.</p>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">Cargar base SIGA PJ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {fase === 'idle' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Selecciona el archivo Excel (.xlsx) con los bienes del SIGA PJ. Se usará para
                pre-rellenar descripción, marca, modelo, serie, orden de compra y valor.
              </p>
              <label className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border p-6 cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Seleccionar archivo Excel</span>
                <span className="text-xs text-muted-foreground">.xlsx o .xls</span>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="sr-only" />
              </label>
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            </div>
          )}

          {fase === 'preview' && (
            <div className="space-y-4">
              <p className="text-sm text-foreground">
                Se encontraron <strong>{allRows.length.toLocaleString()}</strong> registros válidos.
                Vista previa de los primeros 5:
              </p>
              <div className="overflow-x-auto rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {['Código', 'Descripción', 'Marca', 'Modelo', 'Serie', 'OC', 'Valor'].map((h) => (
                        <TableHead key={h} className="whitespace-nowrap text-xs">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs whitespace-nowrap">{r.codigo_patrimonial}</TableCell>
                        <TableCell className="max-w-[140px] truncate text-xs">{r.descripcion ?? '—'}</TableCell>
                        <TableCell className="text-xs">{r.marca ?? '—'}</TableCell>
                        <TableCell className="text-xs">{r.modelo ?? '—'}</TableCell>
                        <TableCell className="text-xs">{r.serie ?? '—'}</TableCell>
                        <TableCell className="text-xs">{r.orden_compra ?? '—'}</TableCell>
                        <TableCell className="text-xs">{r.valor != null ? r.valor.toLocaleString() : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">Columnas detectadas: {headers.join(', ')}</p>
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1" onClick={handleReset}>Cancelar</Button>
                <Button className="flex-1" onClick={() => void handleConfirmar()}>
                  Confirmar carga ({allRows.length.toLocaleString()} registros)
                </Button>
              </div>
            </div>
          )}

          {fase === 'loading' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
                <div>
                  <p className="text-sm font-medium">Subiendo a Supabase…</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    <strong>{progress.procesados.toLocaleString()}</strong> de{' '}
                    <strong>{progress.total.toLocaleString()}</strong> registros procesados
                  </p>
                </div>
              </div>
              <Progress value={pct} />
              <p className="text-xs text-muted-foreground">{pct}% — No cierres esta pestaña hasta que termine.</p>
            </div>
          )}

          {fase === 'done' && resumen && (
            <div className="space-y-4">
              <Alert variant={resumen.errores === 0 ? 'success' : 'warning'}>
                {resumen.errores === 0 ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                <AlertTitle>
                  {resumen.errores === 0 ? '¡Carga completada!' : 'Carga finalizada con advertencias'}
                </AlertTitle>
                <AlertDescription>
                  {resumen.errores === 0 ? (
                    <p>Se guardaron <strong>{resumen.exitosos.toLocaleString()}</strong> registros en la base SIGA.</p>
                  ) : (
                    <>
                      <p>✅ Registros OK: <strong>{resumen.exitosos.toLocaleString()}</strong></p>
                      <p>⚠️ Con error: <strong>{resumen.errores.toLocaleString()}</strong></p>
                    </>
                  )}
                </AlertDescription>
              </Alert>
              <Button variant="secondary" className="w-full" onClick={handleReset}>Cargar otro archivo</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">Columnas esperadas del Excel</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            El sistema detecta automáticamente las columnas. Nombres soportados:
          </p>
          <dl className="text-xs text-muted-foreground grid grid-cols-2 gap-y-1.5 gap-x-4">
            {Object.entries(COLUMN_MAP).map(([campo, aliases]) => (
              <div key={campo}>
                <dt className="font-semibold text-foreground">{campo}:</dt>
                <dd>{aliases.join(', ')}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
