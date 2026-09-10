-- Attendance
create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  staff_member_id uuid not null references public.staff_members(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  work_date date not null default current_date,
  check_in timestamptz,
  check_out timestamptz,
  hours numeric(8,2) not null default 0,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.attendance_records to authenticated;
grant all on public.attendance_records to service_role;
alter table public.attendance_records enable row level security;
create policy "attendance_select" on public.attendance_records for select to authenticated
  using (public.is_member(auth.uid(), organization_id));
create policy "attendance_insert" on public.attendance_records for insert to authenticated
  with check (public.has_any_role(auth.uid(), organization_id, array['admin','manager','accountant']::app_role[]));
create policy "attendance_update" on public.attendance_records for update to authenticated
  using (public.has_any_role(auth.uid(), organization_id, array['admin','manager','accountant']::app_role[]))
  with check (public.has_any_role(auth.uid(), organization_id, array['admin','manager','accountant']::app_role[]));
create policy "attendance_delete" on public.attendance_records for delete to authenticated
  using (public.has_any_role(auth.uid(), organization_id, array['admin','manager']::app_role[]));

create index idx_attendance_org_date on public.attendance_records(organization_id, work_date desc);
create index idx_attendance_staff on public.attendance_records(staff_member_id);

create or replace function public.calc_attendance_hours()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.check_in is not null and new.check_out is not null and new.check_out > new.check_in then
    new.hours := round(extract(epoch from (new.check_out - new.check_in)) / 3600.0, 2);
  end if;
  new.updated_at := now();
  return new;
end; $$;

create trigger trg_calc_attendance_hours before insert or update on public.attendance_records
for each row execute function public.calc_attendance_hours();

create trigger trg_audit_attendance_records after insert or update or delete on public.attendance_records
for each row execute function public.log_audit_event();

-- Payroll
create type public.payroll_status as enum ('draft','approved','paid');

create table public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status public.payroll_status not null default 'draft',
  total_amount numeric(12,2) not null default 0,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.payroll_runs to authenticated;
grant all on public.payroll_runs to service_role;
alter table public.payroll_runs enable row level security;
create policy "payroll_runs_select" on public.payroll_runs for select to authenticated
  using (public.is_member(auth.uid(), organization_id));
create policy "payroll_runs_insert" on public.payroll_runs for insert to authenticated
  with check (public.has_any_role(auth.uid(), organization_id, array['admin','manager','accountant']::app_role[]));
create policy "payroll_runs_update" on public.payroll_runs for update to authenticated
  using (public.has_any_role(auth.uid(), organization_id, array['admin','manager','accountant']::app_role[]))
  with check (public.has_any_role(auth.uid(), organization_id, array['admin','manager','accountant']::app_role[]));
create policy "payroll_runs_delete" on public.payroll_runs for delete to authenticated
  using (public.has_any_role(auth.uid(), organization_id, array['admin','manager']::app_role[]));

create trigger trg_touch_payroll_runs before update on public.payroll_runs
for each row execute function public.touch_updated_at();
create trigger trg_audit_payroll_runs after insert or update or delete on public.payroll_runs
for each row execute function public.log_audit_event();

create table public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payroll_run_id uuid not null references public.payroll_runs(id) on delete cascade,
  staff_member_id uuid not null references public.staff_members(id) on delete cascade,
  hours numeric(8,2) not null default 0,
  hourly_rate numeric(12,2) not null default 0,
  gross_amount numeric(12,2) not null default 0,
  adjustments numeric(12,2) not null default 0,
  net_amount numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.payroll_items to authenticated;
grant all on public.payroll_items to service_role;
alter table public.payroll_items enable row level security;
create policy "payroll_items_select" on public.payroll_items for select to authenticated
  using (public.is_member(auth.uid(), organization_id));
create policy "payroll_items_insert" on public.payroll_items for insert to authenticated
  with check (public.has_any_role(auth.uid(), organization_id, array['admin','manager','accountant']::app_role[]));
create policy "payroll_items_update" on public.payroll_items for update to authenticated
  using (public.has_any_role(auth.uid(), organization_id, array['admin','manager','accountant']::app_role[]))
  with check (public.has_any_role(auth.uid(), organization_id, array['admin','manager','accountant']::app_role[]));
create policy "payroll_items_delete" on public.payroll_items for delete to authenticated
  using (public.has_any_role(auth.uid(), organization_id, array['admin','manager','accountant']::app_role[]));

create index idx_payroll_items_run on public.payroll_items(payroll_run_id);

create or replace function public.sync_payroll_total()
returns trigger language plpgsql security definer set search_path = public as $$
declare _run uuid; _total numeric(12,2);
begin
  _run := coalesce(new.payroll_run_id, old.payroll_run_id);
  select coalesce(sum(net_amount),0) into _total from public.payroll_items where payroll_run_id = _run;
  update public.payroll_runs set total_amount = _total, updated_at = now() where id = _run;
  return null;
end; $$;

create trigger trg_sync_payroll_total after insert or update or delete on public.payroll_items
for each row execute function public.sync_payroll_total();