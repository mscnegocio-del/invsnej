-- Ejecutar en Supabase SQL Editor (revisar nombres de tablas existentes).
-- Tras ejecutar: crear primer usuario desde Auth, luego:
-- UPDATE public.perfiles SET app_role = 'admin' WHERE id = '<uuid-del-admin>';

-- ---------------------------------------------------------------------------
-- 1) Perfiles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.perfiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  app_role TEXT NOT NULL DEFAULT 'consulta'
    CHECK (app_role IN ('admin', 'operador', 'consulta')),
  nombre TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perfiles_app_role ON public.perfiles (app_role);

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid() AND p.app_role = 'admin' AND p.activo = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.is_session_active()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid() AND p.activo = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.is_operador_o_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND p.app_role IN ('admin', 'operador')
      AND p.activo = TRUE
  );
$$;

DROP POLICY IF EXISTS "perfiles_select" ON public.perfiles;
CREATE POLICY "perfiles_select" ON public.perfiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "perfiles_update_admin" ON public.perfiles;
CREATE POLICY "perfiles_update_admin" ON public.perfiles
  FOR UPDATE USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- 2) Trigger: perfil al crear usuario en auth
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfiles (id, app_role, nombre)
  VALUES (NEW.id, 'consulta', COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 3) Columnas auditoría bienes / historial
-- ---------------------------------------------------------------------------
ALTER TABLE public.bienes
  ADD COLUMN IF NOT EXISTS creado_por UUID REFERENCES auth.users (id),
  ADD COLUMN IF NOT EXISTS creado_por_email TEXT,
  ADD COLUMN IF NOT EXISTS eliminado_at TIMESTAMPTZ;

ALTER TABLE public.bien_historial
  ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES auth.users (id),
  ADD COLUMN IF NOT EXISTS usuario_email TEXT,
  ADD COLUMN IF NOT EXISTS accion TEXT NOT NULL DEFAULT 'edicion';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bien_historial_accion_check'
  ) THEN
    ALTER TABLE public.bien_historial
      ADD CONSTRAINT bien_historial_accion_check
      CHECK (accion IN ('creacion', 'edicion', 'eliminacion'));
  END IF;
END $$;

-- Evitar soft-delete por no-admin
CREATE OR REPLACE FUNCTION public.bienes_prevent_soft_delete_non_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.eliminado_at IS NOT NULL AND (OLD.eliminado_at IS NULL OR OLD.eliminado_at IS DISTINCT FROM NEW.eliminado_at) THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Solo un administrador puede marcar un bien como eliminado';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bienes_soft_delete ON public.bienes;
CREATE TRIGGER trg_bienes_soft_delete
  BEFORE UPDATE ON public.bienes
  FOR EACH ROW EXECUTE FUNCTION public.bienes_prevent_soft_delete_non_admin();

-- ---------------------------------------------------------------------------
-- 4) RLS tablas de negocio
-- ---------------------------------------------------------------------------
ALTER TABLE public.bienes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bienes_select_activos" ON public.bienes;
CREATE POLICY "bienes_select_activos" ON public.bienes
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND eliminado_at IS NULL
    AND public.is_session_active()
  );

DROP POLICY IF EXISTS "bienes_insert_oper" ON public.bienes;
CREATE POLICY "bienes_insert_oper" ON public.bienes
  FOR INSERT WITH CHECK (public.is_operador_o_admin());

DROP POLICY IF EXISTS "bienes_update_oper" ON public.bienes;
CREATE POLICY "bienes_update_oper" ON public.bienes
  FOR UPDATE USING (public.is_operador_o_admin());

DROP POLICY IF EXISTS "bienes_delete_admin" ON public.bienes;
-- DELETE físico deshabilitado para usuarios; usar soft delete
CREATE POLICY "bienes_delete_admin" ON public.bienes
  FOR DELETE USING (FALSE);

ALTER TABLE public.bien_historial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bien_historial_select" ON public.bien_historial;
CREATE POLICY "bien_historial_select" ON public.bien_historial
  FOR SELECT USING (auth.uid() IS NOT NULL AND public.is_session_active());

DROP POLICY IF EXISTS "bien_historial_insert" ON public.bien_historial;
CREATE POLICY "bien_historial_insert" ON public.bien_historial
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND public.is_session_active());

ALTER TABLE public.trabajadores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trabajadores_select" ON public.trabajadores;
CREATE POLICY "trabajadores_select" ON public.trabajadores
  FOR SELECT USING (auth.uid() IS NOT NULL AND public.is_session_active());

ALTER TABLE public.ubicaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ubicaciones_select" ON public.ubicaciones;
CREATE POLICY "ubicaciones_select" ON public.ubicaciones
  FOR SELECT USING (auth.uid() IS NOT NULL AND public.is_session_active());

ALTER TABLE public.sedes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sedes_select" ON public.sedes;
CREATE POLICY "sedes_select" ON public.sedes
  FOR SELECT USING (auth.uid() IS NOT NULL AND public.is_session_active());

-- siga_bienes (omitir estas líneas si la tabla no existe aún)
ALTER TABLE public.siga_bienes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "siga_bienes_select" ON public.siga_bienes;
CREATE POLICY "siga_bienes_select" ON public.siga_bienes
  FOR SELECT USING (auth.uid() IS NOT NULL AND public.is_session_active());
DROP POLICY IF EXISTS "siga_bienes_insert" ON public.siga_bienes;
CREATE POLICY "siga_bienes_insert" ON public.siga_bienes
  FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "siga_bienes_update" ON public.siga_bienes;
CREATE POLICY "siga_bienes_update" ON public.siga_bienes
  FOR UPDATE USING (public.is_admin());
