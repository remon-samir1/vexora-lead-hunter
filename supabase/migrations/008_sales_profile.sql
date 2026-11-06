-- Optional company-wide playbook settings; core qualification works without this migration.
create table if not exists public.sales_profiles(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() unique references auth.users on delete cascade,
 data jsonb not null default '{}' check(jsonb_typeof(data)='object'),
 created_at timestamptz not null default now()
);
alter table public.sales_profiles enable row level security;
drop policy if exists own on public.sales_profiles;
create policy own on public.sales_profiles for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
grant select,insert,update,delete on public.sales_profiles to authenticated;
