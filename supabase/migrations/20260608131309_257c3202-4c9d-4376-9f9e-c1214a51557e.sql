
-- Fix mutable search_path on trigger helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
begin new.updated_at = now(); return new; end;
$function$;

-- Lock down SECURITY DEFINER helpers: revoke from public/anon/authenticated.
-- RLS policies and triggers still execute these as the definer owner regardless of EXECUTE grants.
REVOKE EXECUTE ON FUNCTION public.event_org(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.po_org(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, uuid, public.app_role[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_stock_movement() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_invoice_totals() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_invoice_payment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- User-facing RPCs: anon must not call them; authenticated may.
REVOKE EXECUTE ON FUNCTION public.create_organization(text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_organization(text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.receive_po_item(uuid, numeric, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.receive_po_item(uuid, numeric, uuid) TO authenticated;
