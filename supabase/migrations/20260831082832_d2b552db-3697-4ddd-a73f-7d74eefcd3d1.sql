CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view categories"
  ON public.expense_categories
  FOR SELECT
  TO authenticated
  USING (public.is_member(auth.uid(), organization_id));

CREATE POLICY "Admins and managers can manage categories"
  ON public.expense_categories
  FOR ALL
  TO authenticated
  USING (public.has_any_role(auth.uid(), organization_id, array['admin','manager','accountant']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), organization_id, array['admin','manager','accountant']::app_role[]));

CREATE INDEX idx_expense_categories_org ON public.expense_categories(organization_id);

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  description text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  expense_date date NOT NULL,
  payment_method text,
  reference text,
  receipt_url text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view expenses"
  ON public.expenses
  FOR SELECT
  TO authenticated
  USING (public.is_member(auth.uid(), organization_id));

CREATE POLICY "Admins and managers can manage expenses"
  ON public.expenses
  FOR ALL
  TO authenticated
  USING (public.has_any_role(auth.uid(), organization_id, array['admin','manager','accountant']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), organization_id, array['admin','manager','accountant']::app_role[]));

CREATE INDEX idx_expenses_org ON public.expenses(organization_id);
CREATE INDEX idx_expenses_event ON public.expenses(event_id);
CREATE INDEX idx_expenses_date ON public.expenses(expense_date);

CREATE TRIGGER trg_touch_expense_categories_updated_at
  BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_touch_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_audit_expense_categories
  AFTER INSERT OR UPDATE OR DELETE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER trg_audit_expenses
  AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Ensure helper functions are executable by authenticated users
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, uuid, app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_member(uuid, uuid) TO authenticated;