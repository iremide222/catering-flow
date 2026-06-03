-- Enums
create type public.task_status as enum ('todo', 'in_progress', 'done');
create type public.task_priority as enum ('low', 'medium', 'high');

-- Staff members
create table public.staff_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid,
  name text not null,
  email text,
  phone text,
  role_title text,
  hourly_rate numeric not null default 0,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_staff_org on public.staff_members(organization_id);

grant select, insert, update, delete on public.staff_members to authenticated;
grant all on public.staff_members to service_role;
alter table public.staff_members enable row level security;

create policy "members view staff" on public.staff_members for select to authenticated
  using (public.is_member(auth.uid(), organization_id));
create policy "mgr+ write staff" on public.staff_members for insert to authenticated
  with check (public.has_any_role(auth.uid(), organization_id, array['admin','manager']::app_role[]));
create policy "mgr+ update staff" on public.staff_members for update to authenticated
  using (public.has_any_role(auth.uid(), organization_id, array['admin','manager']::app_role[]));
create policy "admin delete staff" on public.staff_members for delete to authenticated
  using (public.has_role(auth.uid(), organization_id, 'admin'::app_role));

-- Event staff assignments
create table public.event_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  staff_member_id uuid not null references public.staff_members(id) on delete cascade,
  role text,
  notes text,
  created_at timestamptz not null default now(),
  unique (event_id, staff_member_id)
);
create index idx_esa_event on public.event_staff_assignments(event_id);
create index idx_esa_staff on public.event_staff_assignments(staff_member_id);

grant select, insert, update, delete on public.event_staff_assignments to authenticated;
grant all on public.event_staff_assignments to service_role;
alter table public.event_staff_assignments enable row level security;

create policy "members view esa" on public.event_staff_assignments for select to authenticated
  using (public.is_member(auth.uid(), public.event_org(event_id)));
create policy "mgr+ write esa" on public.event_staff_assignments for insert to authenticated
  with check (public.has_any_role(auth.uid(), public.event_org(event_id), array['admin','manager']::app_role[]));
create policy "mgr+ update esa" on public.event_staff_assignments for update to authenticated
  using (public.has_any_role(auth.uid(), public.event_org(event_id), array['admin','manager']::app_role[]));
create policy "mgr+ delete esa" on public.event_staff_assignments for delete to authenticated
  using (public.has_any_role(auth.uid(), public.event_org(event_id), array['admin','manager']::app_role[]));

-- Tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  event_id uuid references public.events(id) on delete set null,
  title text not null,
  description text,
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium',
  due_date date,
  assigned_to_staff_id uuid references public.staff_members(id) on delete set null,
  created_by uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_tasks_org on public.tasks(organization_id);
create index idx_tasks_event on public.tasks(event_id);
create index idx_tasks_assignee on public.tasks(assigned_to_staff_id);

grant select, insert, update, delete on public.tasks to authenticated;
grant all on public.tasks to service_role;
alter table public.tasks enable row level security;

create policy "members view tasks" on public.tasks for select to authenticated
  using (public.is_member(auth.uid(), organization_id));
create policy "members write tasks" on public.tasks for insert to authenticated
  with check (public.is_member(auth.uid(), organization_id) and created_by = auth.uid());
create policy "members update tasks" on public.tasks for update to authenticated
  using (public.is_member(auth.uid(), organization_id));
create policy "mgr+ delete tasks" on public.tasks for delete to authenticated
  using (public.has_any_role(auth.uid(), organization_id, array['admin','manager']::app_role[]));

-- FK hints for PostgREST embedding
alter table public.event_staff_assignments
  add constraint event_staff_assignments_event_fk foreign key (event_id) references public.events(id) on delete cascade,
  add constraint event_staff_assignments_staff_fk foreign key (staff_member_id) references public.staff_members(id) on delete cascade;
