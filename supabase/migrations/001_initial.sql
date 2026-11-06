create extension if not exists pgcrypto;
create table public.profiles(id uuid primary key references auth.users on delete cascade, display_name text not null default '', created_at timestamptz not null default now());
create table public.lead_records(id uuid primary key default gen_random_uuid(),owner_id uuid not null default auth.uid() references auth.users on delete cascade,business_name text not null,city text not null,category text not null,website text not null default '',email text not null default '',phone text not null default '',status text not null default 'New' check(status in ('New','Qualified','Contacted','Replied','Meeting Scheduled','Proposal Sent','Negotiation','Won','Lost','Not Interested')),notes text not null default '',deal_value numeric not null default 0 check(deal_value>=0),do_not_contact boolean not null default false,source_url text not null default '',verification text not null default 'Unverified' check(verification in ('Verified','Unverified','Not found')),score integer not null default 0 check(score between 0 and 100),score_reasons jsonb not null default '[]',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(owner_id,business_name,city),unique(id,owner_id));
create table public.app_settings(id uuid primary key default gen_random_uuid(),owner_id uuid not null default auth.uid() unique references auth.users on delete cascade,daily_calls integer not null default 0,daily_searches integer not null default 0,max_results integer not null default 10,monthly_budget numeric not null default 0,google_unit_cost numeric not null default 0,enabled boolean not null default false,created_at timestamptz not null default now());
create table public.api_usage(id uuid primary key default gen_random_uuid(),owner_id uuid not null default auth.uid() references auth.users on delete cascade,provider text not null,sku text not null,estimated_cost numeric not null default 0,created_at timestamptz not null default now());
create table public.search_jobs(id uuid primary key default gen_random_uuid(),owner_id uuid not null default auth.uid() references auth.users on delete cascade,query text not null,status text not null default 'pending',place_ids jsonb not null default '[]',created_at timestamptz not null default now());
do $$ declare t text; begin foreach t in array array['lead_sources','website_audits','lead_scores','lead_activities','follow_ups','sales_notes','ai_generations'] loop execute format('create table public.%I(id uuid primary key default gen_random_uuid(),owner_id uuid not null default auth.uid() references auth.users on delete cascade,lead_id uuid not null,payload jsonb not null default ''{}'',due_at timestamptz,completed boolean not null default false,created_at timestamptz not null default now(),foreign key(lead_id,owner_id) references public.lead_records(id,owner_id) on delete cascade)',t);end loop; end $$;
do $$ declare t text; begin foreach t in array array['profiles','lead_records','lead_sources','website_audits','lead_scores','lead_activities','follow_ups','sales_notes','search_jobs','api_usage','app_settings','ai_generations'] loop execute format('alter table public.%I enable row level security',t);if t='profiles' then execute 'create policy own on public.profiles for all to authenticated using(id=auth.uid()) with check(id=auth.uid())';else execute format('create policy own on public.%I for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid())',t);execute format('create index on public.%I(owner_id,created_at)',t);end if;end loop;end $$;
create index on public.lead_records(owner_id,status,city);
create index on public.follow_ups(owner_id,due_at) where completed=false;
create function public.touch_lead() returns trigger language plpgsql set search_path=public as $$begin new.updated_at=now();return new;end$$;
create trigger touch_lead before update on public.lead_records for each row execute function public.touch_lead();
create function public.reserve_google_call() returns void language plpgsql security definer set search_path=public as $$
declare s public.app_settings; day_count integer; month_cost numeric;begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select * into s from app_settings where owner_id=auth.uid();
 if not found or not s.enabled then raise exception 'Discovery is disabled';end if;
 select count(*) into day_count from api_usage where owner_id=auth.uid() and provider='google' and created_at>=date_trunc('day',now());
 select coalesce(sum(estimated_cost),0) into month_cost from api_usage where owner_id=auth.uid() and created_at>=date_trunc('month',now());
 if day_count>=least(s.daily_calls,s.daily_searches) or s.monthly_budget<=0 or s.google_unit_cost<=0 or month_cost+s.google_unit_cost>s.monthly_budget then raise exception 'Configured API usage limit reached';end if;
 insert into api_usage(owner_id,provider,sku,estimated_cost) values(auth.uid(),'google','Text Search Essentials IDs Only',s.google_unit_cost);
end$$;
revoke all on function public.reserve_google_call() from public;
grant execute on function public.reserve_google_call() to authenticated;
-- Usage reservations cannot be edited/deleted by clients, including the owner.
drop policy own on public.api_usage;
create policy read_usage on public.api_usage for select to authenticated using(owner_id=auth.uid());
