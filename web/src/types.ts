export type AppRole = 'admin' | 'operador' | 'consulta'

export type AccesoEstado = 'pendiente' | 'activo' | 'rechazado'

export type Perfil = {
  id: string
  app_role: AppRole
  nombre: string | null
  activo: boolean
  acceso_estado: AccesoEstado
}

export type UserPasskey = {
  id: string
  credential_id: string
  device_name: string | null
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
  backed_up?: boolean | null
  device_type?: string | null
}

export type Trabajador = {
  id: number
  nombre: string
  sede_id: number | null
  cargo: string | null
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
  marca?: string | null
  modelo?: string | null
}

export type SigaDatos = {
  marca: string | null
  modelo: string | null
  serie: string | null
  orden_compra: string | null
  valor: number | null
  descripcion: string | null
}

export type HistorialAccion = 'creacion' | 'edicion' | 'eliminacion'

export type BienHistorial = {
  id: number
  bien_id: number
  campo: string
  valor_antes: string | null
  valor_despues: string | null
  fecha: string
  usuario_id?: string | null
  usuario_email?: string | null
  accion?: HistorialAccion
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
  sede_id?: number | null
  marca?: string | null
  modelo?: string | null
  serie?: string | null
  orden_compra?: string | null
  valor?: number | null
  creado_por_email?: string | null
}

export type AdminUserRow = {
  id: string
  email: string | null
  created_at: string
  app_role: AppRole
  nombre: string | null
  activo: boolean
  acceso_estado: AccesoEstado
}
