CREATE TABLE public.menu_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'main',
  description TEXT,
  selling_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
GRANT ALL ON public.menu_items TO service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view menu items" ON public.menu_items FOR SELECT TO authenticated USING (public.is_member(auth.uid(), organization_id));
CREATE POLICY "Admins and managers manage menu items" ON public.menu_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), organization_id, 'admin') OR public.has_role(auth.uid(), organization_id, 'manager')) WITH CHECK (public.has_role(auth.uid(), organization_id, 'admin') OR public.has_role(auth.uid(), organization_id, 'manager'));
CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_menu_items_org ON public.menu_items(organization_id);

CREATE TABLE public.menu_item_ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (menu_item_id, item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_item_ingredients TO authenticated;
GRANT ALL ON public.menu_item_ingredients TO service_role;
ALTER TABLE public.menu_item_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view recipes" ON public.menu_item_ingredients FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.menu_items mi WHERE mi.id = menu_item_id AND public.is_member(auth.uid(), mi.organization_id)));
CREATE POLICY "Admins and managers manage recipes" ON public.menu_item_ingredients FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.menu_items mi WHERE mi.id = menu_item_id AND (public.has_role(auth.uid(), mi.organization_id, 'admin') OR public.has_role(auth.uid(), mi.organization_id, 'manager')))) WITH CHECK (EXISTS (SELECT 1 FROM public.menu_items mi WHERE mi.id = menu_item_id AND (public.has_role(auth.uid(), mi.organization_id, 'admin') OR public.has_role(auth.uid(), mi.organization_id, 'manager'))));
CREATE INDEX idx_menu_item_ingredients_menu ON public.menu_item_ingredients(menu_item_id);