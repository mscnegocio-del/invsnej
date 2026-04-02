-- Búsqueda por correo sin usar Auth Admin listUsers (evita bug confirmation_token NULL en GoTrue).

CREATE OR REPLACE FUNCTION public.auth_user_id_by_email(p_email text)
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.email::text, u.created_at
  FROM auth.users u
  WHERE lower(trim(u.email)) = lower(trim(p_email))
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.auth_user_id_by_email(text) IS 'Solo service_role. Uso en Edge passkeys.';

REVOKE ALL ON FUNCTION public.auth_user_id_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_user_id_by_email(text) TO service_role;
