export type Trabajador = {
  id: number
  nombre: string
}

export type Ubicacion = {
  id: number
  nombre: string
}

export type BienResumen = {
  id: number
  codigo_patrimonial: string
  nombre_mueble_equipo: string
  id_trabajador: number | null
  ubicacion: string | null
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
}

