export type Trabajador = {
  id: number
  nombre: string
}

export type Ubicacion = {
  id: number
  nombre: string
}

export type Sede = {
  id: number
  nombre: string
  codigo: string | null
}

export type BienResumen = {
  id: number
  codigo_patrimonial: string
  nombre_mueble_equipo: string
  estado?: string | null
  id_trabajador: number | null
  ubicacion: string | null
  sede_id?: number | null
}

export type SigaDatos = {
  marca: string | null
  modelo: string | null
  serie: string | null
  orden_compra: string | null
  valor: number | null
  descripcion: string | null
}

export type BienDetalle = {
  id: number
  codigo_patrimonial: string
  nombre_mueble_equipo: string
  tipo_mueble_equipo: string | null
  estado: string
  id_trabajador: number | null
  ubicacion: string | null
  fecha_registro: string | null
  trabajador_nombre: string | null
  // campos SIGA (opcionales)
  marca?: string | null
  modelo?: string | null
  serie?: string | null
  orden_compra?: string | null
  valor?: number | null
}

