
-- ============ ENUMS ============
create type public.app_role as enum ('admin','manager','accountant','store_manager','staff');
create type public.event_status as enum ('inquiry','quotation','confirmed','planning','execution','delivered','closed','cancelled');
create type public.quotation_status as enum ('draft','sent','accepted','rejected','expired');

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end; $$;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============ ORGANIZATIONS ============
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'USD',
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.organizations to authenticated;
grant all on public.organizations to service_role;
alter table public.organizations enable row level security;

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
grant select, insert, delete on public.organization_members to authenticated;
grant all on public.organization_members to service_role;
alter table public.organization_members enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, organization_id, role)
);
grant select, insert, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

-- ============ SECURITY DEFINER HELPERS ============
create or replace function public.is_member(_user_id uuid, _org_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members
    where user_id = _user_id and organization_id = _org_id
  )
$$;

create or replace function public.has_role(_user_id uuid, _org_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and organization_id = _org_id and role = _role
  )
$$;

create or replace function public.has_any_role(_user_id uuid, _org_id uuid, _roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and organization_id = _org_id and role = any(_roles)
  )
$$;

-- ============ ORG POLICIES ============
create policy "members view orgs" on public.organizations
  for select to authenticated using (public.is_member(auth.uid(), id));
create policy "anyone create org" on public.organizations
  for insert to authenticated with check (owner_id = auth.uid());
create policy "admin update org" on public.organizations
  for update to authenticated using (public.has_role(auth.uid(), id, 'admin'));

create policy "members view memberships" on public.organization_members
  for select to authenticated using (public.is_member(auth.uid(), organization_id));
create policy "admin add member" on public.organization_members
  for insert to authenticated with check (public.has_role(auth.uid(), organization_id, 'admin'));
create policy "admin remove member" on public.organization_members
  for delete to authenticated using (public.has_role(auth.uid(), organization_id, 'admin'));

create policy "members view roles" on public.user_roles
  for select to authenticated using (public.is_member(auth.uid(), organization_id));
create policy "admin assign role" on public.user_roles
  for insert to authenticated with check (public.has_role(auth.uid(), organization_id, 'admin'));
create policy "admin remove role" on public.user_roles
  for delete to authenticated using (public.has_role(auth.uid(), organization_id, 'admin'));

-- ============ CREATE ORG RPC (owner becomes admin + member atomically) ============
create or replace function public.create_organization(_name text, _currency text default 'USD')
returns uuid language plpgsql security definer set search_path = public as $$
declare _org_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into public.organizations(name, currency, owner_id) values (_name, _currency, auth.uid()) returning id into _org_id;
  insert into public.organization_members(organization_id, user_id) values (_org_id, auth.uid());
  insert into public.user_roles(user_id, organization_id, role) values (auth.uid(), _org_id, 'admin');
  return _org_id;
end; $$;
grant execute on function public.create_organization(text, text) to authenticated;

-- ============ AUDIT LOG ============
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text,
  entity_id uuid,
  payload jsonb,
  created_at timestamptz not null default now()
);
grant select, insert on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "admin view audit" on public.audit_log for select to authenticated
  using (public.has_role(auth.uid(), organization_id, 'admin'));
create policy "members write audit" on public.audit_log for insert to authenticated
  with check (user_id = auth.uid() and public.is_member(auth.uid(), organization_id));

-- ============ CUSTOMERS ============
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address text,
  preferences text,
  tags text[] not null default '{}',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.customers(organization_id);
grant select, insert, update, delete on public.customers to authenticated;
grant all on public.customers to service_role;
alter table public.customers enable row level security;
create policy "members view customers" on public.customers for select to authenticated
  using (public.is_member(auth.uid(), organization_id));
create policy "staff+ create customers" on public.customers for insert to authenticated
  with check (public.is_member(auth.uid(), organization_id) and created_by = auth.uid());
create policy "mgr+ update customers" on public.customers for update to authenticated
  using (public.has_any_role(auth.uid(), organization_id, array['admin','manager']::public.app_role[]));
create policy "admin delete customers" on public.customers for delete to authenticated
  using (public.has_role(auth.uid(), organization_id, 'admin'));

-- ============ EVENTS ============
create table public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  title text not null,
  status public.event_status not null default 'inquiry',
  event_date date,
  start_time time,
  end_time time,
  venue text,
  guest_count int,
  notes text,
  total_amount numeric(12,2) not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.events(organization_id, event_date);
grant select, insert, update, delete on public.events to authenticated;
grant all on public.events to service_role;
alter table public.events enable row level security;
create policy "members view events" on public.events for select to authenticated
  using (public.is_member(auth.uid(), organization_id));
create policy "mgr+ create events" on public.events for insert to authenticated
  with check (public.has_any_role(auth.uid(), organization_id, array['admin','manager']::public.app_role[]) and created_by = auth.uid());
create policy "mgr+ update events" on public.events for update to authenticated
  using (public.has_any_role(auth.uid(), organization_id, array['admin','manager']::public.app_role[]));
create policy "admin delete events" on public.events for delete to authenticated
  using (public.has_role(auth.uid(), organization_id, 'admin'));

-- ============ EVENT ITEMS ============
create table public.event_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  description text,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
create index on public.event_items(event_id);
grant select, insert, update, delete on public.event_items to authenticated;
grant all on public.event_items to service_role;
alter table public.event_items enable row level security;

create or replace function public.event_org(_event_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.events where id = _event_id
$$;

create policy "members view event items" on public.event_items for select to authenticated
  using (public.is_member(auth.uid(), public.event_org(event_id)));
create policy "mgr+ write event items" on public.event_items for insert to authenticated
  with check (public.has_any_role(auth.uid(), public.event_org(event_id), array['admin','manager']::public.app_role[]));
create policy "mgr+ update event items" on public.event_items for update to authenticated
  using (public.has_any_role(auth.uid(), public.event_org(event_id), array['admin','manager']::public.app_role[]));
create policy "mgr+ delete event items" on public.event_items for delete to authenticated
  using (public.has_any_role(auth.uid(), public.event_org(event_id), array['admin','manager']::public.app_role[]));

-- ============ QUOTATIONS ============
create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  version int not null default 1,
  status public.quotation_status not null default 'draft',
  subtotal numeric(12,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  valid_until date,
  sent_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.quotations(event_id);
grant select, insert, update, delete on public.quotations to authenticated;
grant all on public.quotations to service_role;
alter table public.quotations enable row level security;
create policy "members view quotations" on public.quotations for select to authenticated
  using (public.is_member(auth.uid(), public.event_org(event_id)));
create policy "mgr+ write quotations" on public.quotations for insert to authenticated
  with check (public.has_any_role(auth.uid(), public.event_org(event_id), array['admin','manager']::public.app_role[]));
create policy "mgr+ update quotations" on public.quotations for update to authenticated
  using (public.has_any_role(auth.uid(), public.event_org(event_id), array['admin','manager']::public.app_role[]));
create policy "mgr+ delete quotations" on public.quotations for delete to authenticated
  using (public.has_any_role(auth.uid(), public.event_org(event_id), array['admin','manager']::public.app_role[]));

-- ============ FOLLOW-UPS ============
create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  due_date date not null,
  note text,
  done boolean not null default false,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.follow_ups(organization_id, due_date);
grant select, insert, update, delete on public.follow_ups to authenticated;
grant all on public.follow_ups to service_role;
alter table public.follow_ups enable row level security;
create policy "members view follow ups" on public.follow_ups for select to authenticated
  using (public.is_member(auth.uid(), organization_id));
create policy "members write follow ups" on public.follow_ups for insert to authenticated
  with check (public.is_member(auth.uid(), organization_id) and created_by = auth.uid());
create policy "members update follow ups" on public.follow_ups for update to authenticated
  using (public.is_member(auth.uid(), organization_id));
create policy "mgr+ delete follow ups" on public.follow_ups for delete to authenticated
  using (public.has_any_role(auth.uid(), organization_id, array['admin','manager']::public.app_role[]));
