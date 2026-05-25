-- Bot de Telegram para consulta de bienes patrimoniales.
-- Ejecutar en Supabase SQL Editor después de 004_acceso_estado.sql.
--
-- Flujo de acceso (auto-vínculo correo + código):
--   1) Usuario hace /start en Telegram y envía su correo institucional.
--   2) La Edge Function llama signInWithOtp({email, shouldCreateUser:false}) -> Supabase envía
--      el código (plantilla magic_link con {{ .Token }}).
--   3) Usuario escribe el código; la función verifica con verifyOtp y, si el perfil está
--      aprobado (acceso_estado='activo'), vincula chat_id -> perfil en telegram_usuarios.
-- La Edge Function usa service_role (bypassa RLS). El panel admin ve estas tablas vía RLS.

-- ---------------------------------------------------------------------------
-- 1) Perfil por correo (para verificar acceso desde la Edge Function)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.perfil_por_email(p_email text)
RETURNS TABLE (
  id uuid,
  app_role text,
  acceso_estado text,
  activo boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.app_role, p.acceso_estado, p.activo
  FROM auth.users u
  JOIN public.perfiles p ON p.id = u.id
  WHERE lower(trim(u.email)) = lower(trim(p_email))
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.perfil_por_email(text) IS 'Solo service_role. Uso en Edge telegram-bot.';

REVOKE ALL ON FUNCTION public.perfil_por_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.perfil_por_email(text) TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Vínculo chat_id de Telegram -> perfil aprobado
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.telegram_usuarios (
  chat_id BIGINT PRIMARY KEY,
  perfil_id UUID NOT NULL REFERENCES public.perfiles (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  vinculado_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_usuarios_perfil ON public.telegram_usuarios (perfil_id);

-- ---------------------------------------------------------------------------
-- 3) Estado de conversación (FSM por chat) para el flujo de verificación
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.telegram_sesiones (
  chat_id BIGINT PRIMARY KEY,
  estado TEXT NOT NULL DEFAULT 'inicio'
    CHECK (estado IN ('inicio', 'esperando_email', 'esperando_codigo', 'vinculado')),
  email_pendiente TEXT,
  intentos INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 4) RLS: solo admin desde el panel. La Edge Function usa service_role (bypassa RLS).
-- ---------------------------------------------------------------------------
ALTER TABLE public.telegram_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_sesiones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "telegram_usuarios_select_admin" ON public.telegram_usuarios;
CREATE POLICY "telegram_usuarios_select_admin" ON public.telegram_usuarios
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "telegram_usuarios_update_admin" ON public.telegram_usuarios;
CREATE POLICY "telegram_usuarios_update_admin" ON public.telegram_usuarios
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "telegram_usuarios_delete_admin" ON public.telegram_usuarios;
CREATE POLICY "telegram_usuarios_delete_admin" ON public.telegram_usuarios
  FOR DELETE USING (public.is_admin());

-- telegram_sesiones: sin políticas (solo service_role accede; RLS activo bloquea el resto).
