-- Fix: eliminar (soft-delete) un bien fallaba SIEMPRE con
-- "new row violates row-level security policy for table bienes", incluso para admin.
--
-- Causa raíz: en PostgreSQL, un UPDATE debe dejar la fila resultante visible según
-- la política de SELECT de la tabla, además de cumplir su propia política de UPDATE.
-- bienes_select_activos exige `eliminado_at IS NULL`, así que CUALQUIER UPDATE que
-- fije eliminado_at (el soft-delete) dejaba la fila fuera de esa visibilidad y el
-- RLS lo rechazaba, sin importar que bienes_update_oper / el trigger
-- bienes_prevent_soft_delete_non_admin ya autorizaran la operación.
--
-- Solución: agregar una política de SELECT adicional (permissive, se combina con OR)
-- que permite a los admin ver también los bienes eliminados. Es consistente con que
-- solo un admin puede marcar eliminado_at (trigger trg_bienes_soft_delete) y con que
-- el botón "Eliminar" en la UI ya está reservado a isAdmin.

CREATE POLICY bienes_select_admin_incluye_eliminados ON public.bienes
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND is_session_active()
    AND is_admin()
  );
