CREATE TABLE public.event_menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE RESTRICT,
  servings numeric(12,2) NOT NULL DEFAULT 1,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, menu_item_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_menus TO authenticated;
GRANT ALL ON public.event_menus TO service_role;

ALTER TABLE public.event_menus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view event menus"
ON public.event_menus FOR SELECT TO authenticated
USING (public.is_member(auth.uid(), organization_id));

CREATE POLICY "Managers can manage event menus"
ON public.event_menus FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), organization_id, 'admin')
  OR public.has_role(auth.uid(), organization_id, 'manager')
  OR public.has_role(auth.uid(), organization_id, 'store_manager')
)
WITH CHECK (
  public.has_role(auth.uid(), organization_id, 'admin')
  OR public.has_role(auth.uid(), organization_id, 'manager')
  OR public.has_role(auth.uid(), organization_id, 'store_manager')
);

CREATE INDEX idx_event_menus_event ON public.event_menus(event_id);
CREATE INDEX idx_event_menus_org ON public.event_menus(organization_id);

CREATE TRIGGER touch_event_menus_updated_at
BEFORE UPDATE ON public.event_menus
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();