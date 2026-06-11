create table public.notifications (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid references public.organizations(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete cascade not null,
    type text not null,
    title text not null,
    message text not null,
    link text,
    entity_type text,
    entity_id uuid,
    read boolean not null default false,
    created_at timestamp with time zone not null default now()
);

create index idx_notifications_user_read_created on public.notifications(user_id, read, created_at desc);
create index idx_notifications_org_created on public.notifications(organization_id, created_at desc);
create index idx_notifications_entity on public.notifications(entity_type, entity_id, user_id);

grant select, insert, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;

alter table public.notifications enable row level security;

create policy "Users can view their own notifications"
on public.notifications for select
to authenticated
using (user_id = auth.uid());

create policy "Users can insert own notifications"
on public.notifications for insert
to authenticated
with check (user_id = auth.uid() and is_member(auth.uid(), organization_id));

create policy "Users can update own notifications"
on public.notifications for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete own notifications"
on public.notifications for delete
to authenticated
using (user_id = auth.uid());