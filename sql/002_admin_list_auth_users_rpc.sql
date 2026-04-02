-- Listado de usuarios para la Edge Function admin-users sin usar GoTrue GET /admin/users.
-- Motivo: GoTrue v2.188 puede fallar con "Database error finding users" si auth.users.confirmation_token es NULL
-- (Scan error: converting NULL to string is unsupported).

CREATE OR REPLACE FUNCTION public.admin_list_auth_users()
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
  ORDER BY u.created_at DESC NULLS LAST
  LIMIT 1000;
$$;

COMMENT ON FUNCTION public.admin_list_auth_users() IS 'Solo service_role (p. ej. Edge admin-users). Evita listUsers de Auth API con tokens NULL.';

REVOKE ALL ON FUNCTION public.admin_list_auth_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_auth_users() TO service_role;
