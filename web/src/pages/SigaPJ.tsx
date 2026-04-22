import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Database, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Skeleton } from '../components/ui/skeleton'

const PAGE_SIZE = 25

type SigaBienRow = {
  codigo_patrimonial: string
  descripcion: string | null
  marca: string | null
  modelo: string | null
  serie: string | null
  usuario: string | null
  orden_compra: string | null
  valor: number | null
}

export function SigaPJ() {
  const [filtroCodigo, setFiltroCodigo] = useState('')
  const [filtroDescripcion, setFiltroDescripcion] = useState('')
  const [filtroResponsable, setFiltroResponsable] = useState('')
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<SigaBienRow[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasBuscado, setHasBuscado] = useState(false)
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data, error } = await supabase
        .from('siga_bienes')
        .select('updated_at')
        .not('updated_at', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('Error cargando fecha SIGA:', error)
        return
      }

      if (data?.updated_at) setUltimaActualizacion(data.updated_at as string)
    })()
  }, [])

  const handleBuscar = async (p = 0) => {
    setLoading(true)
    setError(null)
    setHasBuscado(true)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase
      .from('siga_bienes')
      .select('codigo_patrimonial, descripcion, marca, modelo, serie, usuario, orden_compra, valor', { count: 'exact' })

    const codigoTrim = filtroCodigo.trim()
    const descTrim = filtroDescripcion.trim()
    const respTrim = filtroResponsable.trim()

    if (codigoTrim) q = q.ilike('codigo_patrimonial', `%${codigoTrim}%`)
    if (descTrim) q = q.ilike('descripcion', `%${descTrim}%`)
    if (respTrim) q = q.ilike('usuario', `%${respTrim}%`)

    const from = p * PAGE_SIZE
    const { data, error: supaError, count } = await q
      .order('codigo_patrimonial', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    setLoading(false)

    if (supaError) {
      setError('No se pudieron cargar los datos. Intenta nuevamente.')
      setRows([])
      setTotal(null)
      return
    }

    setRows((data ?? []) as SigaBienRow[])
    setTotal(typeof count === 'number' ? count : null)
    setPage(p)
  }

  const totalPages = total !== null ? Math.ceil(total / PAGE_SIZE) : 0

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Base SIGA PJ</h1>
        <p className="page-subtitle">
          Consulta la base de datos general del SIGA Patrimonial Judicial.
          {ultimaActualizacion && (
            <span className="ml-1 text-muted-foreground">
              · Datos actualizados al{' '}
              <span className="font-medium text-foreground">
                {new Date(ultimaActualizacion).toLocaleString('es-PE')}
              </span>
            </span>
          )}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            Búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="siga-codigo">Código patrimonial</Label>
              <Input
                id="siga-codigo"
                placeholder="Ej. 1234567890"
                value={filtroCodigo}
                onChange={(e) => setFiltroCodigo(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleBuscar(0) }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="siga-desc">Descripción</Label>
              <Input
                id="siga-desc"
                placeholder="Ej. MONITOR, ESCRITORIO..."
                value={filtroDescripcion}
                onChange={(e) => setFiltroDescripcion(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleBuscar(0) }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="siga-resp">Responsable</Label>
              <Input
                id="siga-resp"
                placeholder="Nombre del responsable"
                value={filtroResponsable}
                onChange={(e) => setFiltroResponsable(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleBuscar(0) }}
              />
            </div>
          </div>
          <Button
            className="mt-4"
            onClick={() => void handleBuscar(0)}
            disabled={loading}
          >
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Buscando…</>
              : 'Buscar'
            }
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!hasBuscado && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Database className="h-12 w-12 opacity-20" />
          <p className="text-sm">Ingresa un filtro y presiona Buscar para consultar la base SIGA.</p>
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      )}

      {hasBuscado && !loading && total === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Sin resultados para los filtros ingresados.
        </div>
      )}

      {hasBuscado && !loading && rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {total !== null && (
                <>
                  Pág. {page + 1} de {totalPages} &nbsp;·&nbsp; {total.toLocaleString()} registros
                </>
              )}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleBuscar(page - 1)}
                disabled={page === 0 || loading}
                className="gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleBuscar(page + 1)}
                disabled={page + 1 >= totalPages || loading}
                className="gap-1"
              >
                Siguiente
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Código</TableHead>
                  <TableHead className="whitespace-nowrap">Descripción</TableHead>
                  <TableHead className="whitespace-nowrap">Marca</TableHead>
                  <TableHead className="whitespace-nowrap">Modelo</TableHead>
                  <TableHead className="whitespace-nowrap">Serie</TableHead>
                  <TableHead className="whitespace-nowrap">Responsable</TableHead>
                  <TableHead className="whitespace-nowrap">OC</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Valor (S/.)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.codigo_patrimonial}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{row.codigo_patrimonial}</TableCell>
                    <TableCell className="max-w-[220px] truncate" title={row.descripcion ?? ''}>{row.descripcion ?? '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{row.marca ?? '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{row.modelo ?? '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{row.serie ?? '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{row.usuario ?? '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{row.orden_compra ?? '—'}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {row.valor != null ? row.valor.toLocaleString('es-PE', { minimumFractionDigits: 2 }) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleBuscar(page - 1)}
              disabled={page === 0 || loading}
              className="gap-1"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleBuscar(page + 1)}
              disabled={page + 1 >= totalPages || loading}
              className="gap-1"
            >
              Siguiente
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
