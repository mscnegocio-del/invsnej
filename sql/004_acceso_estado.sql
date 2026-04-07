-- Estado de acceso explícito: pendiente (invitado / sin aprobar), activo, rechazado.
-- Ejecutar en Supabase SQL Editor después de 001_auth_perfiles_rls.sql.
-- Mantiene columna activo sincronizada: TRUE solo cuando acceso_estado = 'activo'.

ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS acceso_estado TEXT NOT NULL DEFAULT 'pendiente';

ALTER TABLE public.perfiles
  DROP CONSTRAINT IF EXISTS perfiles_acceso_estado_check;

ALTER TABLE public.perfiles
  ADD CONSTRAINT perfiles_acceso_estado_check
  CHECK (acceso_estado IN ('pendiente', 'activo', 'rechazado'));

-- Backfill según estado previo de activo
UPDATE public.perfiles SET acceso_estado = 'activo' WHERE activo = TRUE;
UPDATE public.perfiles SET acceso_estado = 'rechazado' WHERE activo = FALSE;

CREATE INDEX IF NOT EXISTS idx_perfiles_acceso_estado ON public.perfiles (acceso_estado);

-- Sesión válida para RLS: solo usuarios aprobados
CREATE OR REPLACE FUNCTION public.is_session_active()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND p.acceso_estado = 'activo'
      AND p.activo = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND p.app_role = 'admin'
      AND p.acceso_estado = 'activo'
      AND p.activo = TRUE
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
      AND p.acceso_estado = 'activo'
      AND p.activo = TRUE
  );
$$;

-- Nuevos usuarios en auth: sin acceso hasta aprobación del admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfiles (id, app_role, nombre, acceso_estado, activo)
  VALUES (
    NEW.id,
    'consulta',
    COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email),
    'pendiente',
    FALSE
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Si tras la primera invitación nadie puede usar el panel admin (todos en pendiente), aprobar por SQL:
-- UPDATE public.perfiles SET acceso_estado = 'activo', activo = true WHERE id = '<uuid-auth.users>';
