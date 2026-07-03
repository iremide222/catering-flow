
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_entity_id uuid;
  v_action text;
  v_payload jsonb;
  v_row jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row := to_jsonb(OLD);
    v_action := 'delete';
  ELSIF TG_OP = 'INSERT' THEN
    v_row := to_jsonb(NEW);
    v_action := 'create';
  ELSE
    v_row := to_jsonb(NEW);
    v_action := 'update';
  END IF;

  v_org_id := NULLIF(v_row->>'organization_id','')::uuid;
  v_entity_id := NULLIF(v_row->>'id','')::uuid;

  IF TG_OP = 'UPDATE' THEN
    v_payload := jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW));
  ELSE
    v_payload := v_row;
  END IF;

  IF v_org_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.audit_log (organization_id, user_id, action, entity, entity_id, payload)
  VALUES (v_org_id, auth.uid(), v_action, TG_TABLE_NAME, v_entity_id, v_payload);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY['customers','events','invoices','quotations','purchase_orders','items','tasks','staff_members','suppliers','payments','follow_ups'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON public.%1$s', t);
    EXECUTE format('CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.log_audit_event()', t);
  END LOOP;
END $$;
