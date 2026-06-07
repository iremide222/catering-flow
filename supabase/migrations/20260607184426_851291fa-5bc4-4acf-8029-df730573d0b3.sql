
-- Status enum
create type public.invoice_status as enum ('draft','sent','partial','paid','void');

-- Invoices
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  invoice_number text not null,
  status public.invoice_status not null default 'draft',
  issue_date date not null default current_date,
  due_date date,
  subtotal numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, invoice_number)
);
create index invoices_org_idx on public.invoices(organization_id, issue_date desc);

grant select, insert, update, delete on public.invoices to authenticated;
grant all on public.invoices to service_role;
alter table public.invoices enable row level security;

create policy "members view invoices" on public.invoices for select to authenticated
  using (public.is_member(auth.uid(), organization_id));
create policy "finance insert invoices" on public.invoices for insert to authenticated
  with check (public.has_any_role(auth.uid(), organization_id, array['admin','manager','accountant']::app_role[]));
create policy "finance update invoices" on public.invoices for update to authenticated
  using (public.has_any_role(auth.uid(), organization_id, array['admin','manager','accountant']::app_role[]));
create policy "finance delete invoices" on public.invoices for delete to authenticated
  using (public.has_any_role(auth.uid(), organization_id, array['admin','manager','accountant']::app_role[]));

-- Invoice items
create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
create index invoice_items_invoice_idx on public.invoice_items(invoice_id);

grant select, insert, update, delete on public.invoice_items to authenticated;
grant all on public.invoice_items to service_role;
alter table public.invoice_items enable row level security;

create policy "members view invoice_items" on public.invoice_items for select to authenticated
  using (public.is_member(auth.uid(), organization_id));
create policy "finance insert invoice_items" on public.invoice_items for insert to authenticated
  with check (public.has_any_role(auth.uid(), organization_id, array['admin','manager','accountant']::app_role[]));
create policy "finance update invoice_items" on public.invoice_items for update to authenticated
  using (public.has_any_role(auth.uid(), organization_id, array['admin','manager','accountant']::app_role[]));
create policy "finance delete invoice_items" on public.invoice_items for delete to authenticated
  using (public.has_any_role(auth.uid(), organization_id, array['admin','manager','accountant']::app_role[]));

-- Payments
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(12,2) not null,
  payment_date date not null default current_date,
  method text,
  reference text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index payments_invoice_idx on public.payments(invoice_id);
create index payments_org_idx on public.payments(organization_id, payment_date desc);

grant select, insert, update, delete on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;

create policy "members view payments" on public.payments for select to authenticated
  using (public.is_member(auth.uid(), organization_id));
create policy "finance insert payments" on public.payments for insert to authenticated
  with check (public.has_any_role(auth.uid(), organization_id, array['admin','manager','accountant']::app_role[]));
create policy "finance update payments" on public.payments for update to authenticated
  using (public.has_any_role(auth.uid(), organization_id, array['admin','manager','accountant']::app_role[]));
create policy "finance delete payments" on public.payments for delete to authenticated
  using (public.has_any_role(auth.uid(), organization_id, array['admin','manager','accountant']::app_role[]));

-- Sync invoice amount_paid + status from payments
create or replace function public.sync_invoice_payment()
returns trigger language plpgsql security definer set search_path = public as $$
declare _inv_id uuid;
declare _paid numeric(12,2);
declare _total numeric(12,2);
declare _current_status public.invoice_status;
begin
  _inv_id := coalesce(new.invoice_id, old.invoice_id);
  select coalesce(sum(amount),0) into _paid from public.payments where invoice_id = _inv_id;
  select total, status into _total, _current_status from public.invoices where id = _inv_id;
  update public.invoices set
    amount_paid = _paid,
    status = case
      when _current_status = 'void' then 'void'
      when _paid >= _total and _total > 0 then 'paid'::public.invoice_status
      when _paid > 0 then 'partial'::public.invoice_status
      when _current_status in ('paid','partial') then 'sent'::public.invoice_status
      else _current_status
    end,
    updated_at = now()
  where id = _inv_id;
  return null;
end; $$;

create trigger trg_sync_invoice_payment
after insert or update or delete on public.payments
for each row execute function public.sync_invoice_payment();

-- Recompute totals when invoice items change
create or replace function public.sync_invoice_totals()
returns trigger language plpgsql security definer set search_path = public as $$
declare _inv_id uuid;
declare _sub numeric(12,2);
declare _tax numeric(12,2);
begin
  _inv_id := coalesce(new.invoice_id, old.invoice_id);
  select coalesce(sum(total),0) into _sub from public.invoice_items where invoice_id = _inv_id;
  select tax_amount into _tax from public.invoices where id = _inv_id;
  update public.invoices set subtotal = _sub, total = _sub + coalesce(_tax,0), updated_at = now() where id = _inv_id;
  return null;
end; $$;

create trigger trg_sync_invoice_totals
after insert or update or delete on public.invoice_items
for each row execute function public.sync_invoice_totals();

-- updated_at trigger for invoices
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_invoices_updated_at before update on public.invoices
for each row execute function public.touch_updated_at();
