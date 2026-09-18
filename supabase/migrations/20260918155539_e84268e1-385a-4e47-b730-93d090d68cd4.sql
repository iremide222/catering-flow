CREATE TABLE public.event_ingredient_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id),
  issued_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_ingredient_issues TO authenticated;
GRANT ALL ON public.event_ingredient_issues TO service_role;

ALTER TABLE public.event_ingredient_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view event ingredient issues"
ON public.event_ingredient_issues FOR SELECT TO authenticated
USING (public.is_member(auth.uid(), organization_id));

CREATE POLICY "Managers can manage event ingredient issues"
ON public.event_ingredient_issues FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), organization_id, 'admin'::app_role)
  OR public.has_role(auth.uid(), organization_id, 'manager'::app_role)
  OR public.has_role(auth.uid(), organization_id, 'store_manager'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), organization_id, 'admin'::app_role)
  OR public.has_role(auth.uid(), organization_id, 'manager'::app_role)
  OR public.has_role(auth.uid(), organization_id, 'store_manager'::app_role)
);

CREATE TRIGGER touch_event_ingredient_issues
BEFORE UPDATE ON public.event_ingredient_issues
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.issue_event_ingredients(_event_id uuid, _location_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org uuid;
  _count integer := 0;
  r record;
BEGIN
  SELECT organization_id INTO _org FROM public.events WHERE id = _event_id;
  IF _org IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), _org, 'admin'::app_role)
    OR public.has_role(auth.uid(), _org, 'manager'::app_role)
    OR public.has_role(auth.uid(), _org, 'store_manager'::app_role)
  ) THEN
    RAISE EXCEPTION 'Not authorized to issue ingredients';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.locations WHERE id = _location_id AND organization_id = _org) THEN
    RAISE EXCEPTION 'Location not found in this workspace';
  END IF;

  FOR r IN
    SELECT mi.item_id, SUM(mi.quantity * em.servings) AS qty
    FROM public.event_menus em
    JOIN public.menu_item_ingredients mi ON mi.menu_item_id = em.menu_item_id
    WHERE em.event_id = _event_id
    GROUP BY mi.item_id
    HAVING SUM(mi.quantity * em.servings) > 0
  LOOP
    INSERT INTO public.stock_movements (organization_id, item_id, location_id, quantity, type, reason, event_id, created_by)
    VALUES (_org, r.item_id, _location_id, r.qty, 'out'::stock_movement_type, 'Issued for event', _event_id, auth.uid());

    INSERT INTO public.stock_levels (organization_id, item_id, location_id, quantity)
    VALUES (_org, r.item_id, _location_id, -r.qty)
    ON CONFLICT (item_id, location_id)
    DO UPDATE SET quantity = public.stock_levels.quantity - r.qty, updated_at = now();

    _count := _count + 1;
  END LOOP;

  IF _count = 0 THEN
    RAISE EXCEPTION 'Nothing to issue: the event menu plan has no ingredients';
  END IF;

  INSERT INTO public.event_ingredient_issues (organization_id, event_id, location_id, issued_by)
  VALUES (_org, _event_id, _location_id, auth.uid());

  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_event_ingredients(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.issue_event_ingredients(uuid, uuid) TO authenticated;