-- Trabajadores: sede asignada, cargo; RLS escritura solo admin.
-- Ejecutar en Supabase SQL Editor tras revisar que existen public.sedes y public.trabajadores.

ALTER TABLE public.trabajadores
  ADD COLUMN IF NOT EXISTS sede_id BIGINT REFERENCES public.sedes (id) ON DELETE SET NULL;

ALTER TABLE public.trabajadores
  ADD COLUMN IF NOT EXISTS cargo TEXT;

CREATE INDEX IF NOT EXISTS idx_trabajadores_sede_id ON public.trabajadores (sede_id);

-- Alta desde formularios (operador/admin); edición/borrado maestro en UI solo admin
DROP POLICY IF EXISTS "trabajadores_insert_oper" ON public.trabajadores;
CREATE POLICY "trabajadores_insert_oper" ON public.trabajadores
  FOR INSERT WITH CHECK (public.is_operador_o_admin());

DROP POLICY IF EXISTS "trabajadores_update_admin" ON public.trabajadores;
CREATE POLICY "trabajadores_update_admin" ON public.trabajadores
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "trabajadores_delete_admin" ON public.trabajadores;
CREATE POLICY "trabajadores_delete_admin" ON public.trabajadores
  FOR DELETE USING (public.is_admin());
