-- Enums
create type public.stock_movement_type as enum ('in','out','adjust');
create type public.po_status as enum ('draft','ordered','partial','received','closed','cancelled');

-- Locations
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  address text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.locations to authenticated;
grant all on public.locations to service_role;
alter table public.locations enable row level security;
create policy "members view locations" on public.locations for select to authenticated using (public.is_member(auth.uid(), organization_id));
create policy "mgr+ write locations" on public.locations for insert to authenticated with check (public.has_any_role(auth.uid(), organization_id, array['admin','manager']::app_role[]));
create policy "mgr+ update locations" on public.locations for update to authenticated using (public.has_any_role(auth.uid(), organization_id, array['admin','manager']::app_role[]));
create policy "admin delete locations" on public.locations for delete to authenticated using (public.has_role(auth.uid(), organization_id, 'admin'));

-- Categories
create table public.item_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.item_categories to authenticated;
grant all on public.item_categories to service_role;
alter table public.item_categories enable row level security;
create policy "members view cats" on public.item_categories for select to authenticated using (public.is_member(auth.uid(), organization_id));
create policy "mgr+ write cats" on public.item_categories for insert to authenticated with check (public.has_any_role(auth.uid(), organization_id, array['admin','manager']::app_role[]));
create policy "mgr+ update cats" on public.item_categories for update to authenticated using (public.has_any_role(auth.uid(), organization_id, array['admin','manager']::app_role[]));
create policy "admin delete cats" on public.item_categories for delete to authenticated using (public.has_role(auth.uid(), organization_id, 'admin'));

-- Items
create table public.items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  sku text,
  name text not null,
  description text,
  unit text not null default 'unit',
  category_id uuid,
  default_cost numeric not null default 0,
  reorder_level numeric not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.items(organization_id);
grant select, insert, update, delete on public.items to authenticated;
grant all on public.items to service_role;
alter table public.items enable row level security;
create policy "members view items" on public.items for select to authenticated using (public.is_member(auth.uid(), organization_id));
create policy "mgr+ write items" on public.items for insert to authenticated with check (public.has_any_role(auth.uid(), organization_id, array['admin','manager','store_manager']::app_role[]));
create policy "mgr+ update items" on public.items for update to authenticated using (public.has_any_role(auth.uid(), organization_id, array['admin','manager','store_manager']::app_role[]));
create policy "admin delete items" on public.items for delete to authenticated using (public.has_role(auth.uid(), organization_id, 'admin'));

-- Stock levels (item x location)
create table public.stock_levels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  item_id uuid not null,
  location_id uuid not null,
  quantity numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique(item_id, location_id)
);
create index on public.stock_levels(organization_id);
grant select, insert, update, delete on public.stock_levels to authenticated;
grant all on public.stock_levels to service_role;
alter table public.stock_levels enable row level security;
create policy "members view stock" on public.stock_levels for select to authenticated using (public.is_member(auth.uid(), organization_id));
create policy "members write stock" on public.stock_levels for insert to authenticated with check (public.is_member(auth.uid(), organization_id));
create policy "members update stock" on public.stock_levels for update to authenticated using (public.is_member(auth.uid(), organization_id));

-- Stock movements (history)
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  item_id uuid not null,
  location_id uuid not null,
  type public.stock_movement_type not null,
  quantity numeric not null,
  reason text,
  event_id uuid,
  purchase_order_id uuid,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index on public.stock_movements(organization_id, created_at desc);
grant select, insert, update, delete on public.stock_movements to authenticated;
grant all on public.stock_movements to service_role;
alter table public.stock_movements enable row level security;
create policy "members view movements" on public.stock_movements for select to authenticated using (public.is_member(auth.uid(), organization_id));
create policy "members write movements" on public.stock_movements for insert to authenticated with check (public.is_member(auth.uid(), organization_id) and created_by = auth.uid());
create policy "mgr+ delete movements" on public.stock_movements for delete to authenticated using (public.has_any_role(auth.uid(), organization_id, array['admin','manager']::app_role[]));

-- Apply stock movement -> upsert stock level
create or replace function public.apply_stock_movement()
returns trigger language plpgsql security definer set search_path = public as $$
declare delta numeric;
begin
  delta := case new.type when 'in' then new.quantity when 'out' then -new.quantity else new.quantity end;
  insert into public.stock_levels(organization_id, item_id, location_id, quantity)
  values (new.organization_id, new.item_id, new.location_id, delta)
  on conflict (item_id, location_id) do update
    set quantity = public.stock_levels.quantity + excluded.quantity,
        updated_at = now();
  return new;
end; $$;
create trigger trg_apply_stock after insert on public.stock_movements for each row execute function public.apply_stock_movement();

-- Suppliers
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  contact_name text,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.suppliers to authenticated;
grant all on public.suppliers to service_role;
alter table public.suppliers enable row level security;
create policy "members view suppliers" on public.suppliers for select to authenticated using (public.is_member(auth.uid(), organization_id));
create policy "mgr+ write suppliers" on public.suppliers for insert to authenticated with check (public.has_any_role(auth.uid(), organization_id, array['admin','manager','store_manager']::app_role[]));
create policy "mgr+ update suppliers" on public.suppliers for update to authenticated using (public.has_any_role(auth.uid(), organization_id, array['admin','manager','store_manager']::app_role[]));
create policy "admin delete suppliers" on public.suppliers for delete to authenticated using (public.has_role(auth.uid(), organization_id, 'admin'));

-- Purchase Orders
create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  supplier_id uuid not null,
  event_id uuid,
  location_id uuid,
  status public.po_status not null default 'draft',
  order_number text,
  expected_date date,
  subtotal numeric not null default 0,
  tax_rate numeric not null default 0,
  total numeric not null default 0,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.purchase_orders(organization_id, created_at desc);
grant select, insert, update, delete on public.purchase_orders to authenticated;
grant all on public.purchase_orders to service_role;
alter table public.purchase_orders enable row level security;
create policy "members view po" on public.purchase_orders for select to authenticated using (public.is_member(auth.uid(), organization_id));
create policy "mgr+ write po" on public.purchase_orders for insert to authenticated with check (public.has_any_role(auth.uid(), organization_id, array['admin','manager','store_manager']::app_role[]) and created_by = auth.uid());
create policy "mgr+ update po" on public.purchase_orders for update to authenticated using (public.has_any_role(auth.uid(), organization_id, array['admin','manager','store_manager']::app_role[]));
create policy "admin delete po" on public.purchase_orders for delete to authenticated using (public.has_role(auth.uid(), organization_id, 'admin'));

-- helper: PO org
create or replace function public.po_org(_po_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.purchase_orders where id = _po_id
$$;

-- PO items
create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null,
  item_id uuid not null,
  description text,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  received_quantity numeric not null default 0,
  created_at timestamptz not null default now()
);
create index on public.purchase_order_items(purchase_order_id);
grant select, insert, update, delete on public.purchase_order_items to authenticated;
grant all on public.purchase_order_items to service_role;
alter table public.purchase_order_items enable row level security;
create policy "members view po items" on public.purchase_order_items for select to authenticated using (public.is_member(auth.uid(), public.po_org(purchase_order_id)));
create policy "mgr+ write po items" on public.purchase_order_items for insert to authenticated with check (public.has_any_role(auth.uid(), public.po_org(purchase_order_id), array['admin','manager','store_manager']::app_role[]));
create policy "mgr+ update po items" on public.purchase_order_items for update to authenticated using (public.has_any_role(auth.uid(), public.po_org(purchase_order_id), array['admin','manager','store_manager']::app_role[]));
create policy "mgr+ delete po items" on public.purchase_order_items for delete to authenticated using (public.has_any_role(auth.uid(), public.po_org(purchase_order_id), array['admin','manager','store_manager']::app_role[]));

-- Receive goods against a PO line: updates received_quantity, inserts stock movement, updates PO status
create or replace function public.receive_po_item(
  _po_item_id uuid,
  _quantity numeric,
  _location_id uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  _po_id uuid;
  _org uuid;
  _item uuid;
  _ordered numeric;
  _received numeric;
  _total_ordered numeric;
  _total_received numeric;
begin
  select poi.purchase_order_id, po.organization_id, poi.item_id, poi.quantity, poi.received_quantity
    into _po_id, _org, _item, _ordered, _received
  from public.purchase_order_items poi
  join public.purchase_orders po on po.id = poi.purchase_order_id
  where poi.id = _po_item_id;

  if _po_id is null then raise exception 'PO item not found'; end if;
  if not public.has_any_role(auth.uid(), _org, array['admin','manager','store_manager']::app_role[]) then
    raise exception 'Not authorized';
  end if;
  if _quantity <= 0 then raise exception 'Quantity must be positive'; end if;

  update public.purchase_order_items
    set received_quantity = received_quantity + _quantity
    where id = _po_item_id;

  insert into public.stock_movements(organization_id, item_id, location_id, type, quantity, reason, purchase_order_id, created_by)
  values (_org, _item, _location_id, 'in', _quantity, 'PO receipt', _po_id, auth.uid());

  -- Recompute PO status
  select coalesce(sum(quantity),0), coalesce(sum(received_quantity),0)
    into _total_ordered, _total_received
  from public.purchase_order_items where purchase_order_id = _po_id;

  update public.purchase_orders
    set status = case
      when _total_received >= _total_ordered and _total_ordered > 0 then 'received'::po_status
      when _total_received > 0 then 'partial'::po_status
      else status
    end,
    updated_at = now()
  where id = _po_id;
end; $$;