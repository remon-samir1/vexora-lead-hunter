-- VEXORA: first-time installation only. All changes are committed together.
-- Run in the SQL Editor of project hjcasgpxwlizvygsjbth as the postgres role.
BEGIN;
DO $$ BEGIN IF to_regclass('public.lead_records') IS NOT NULL THEN RAISE EXCEPTION 'VEXORA tables already exist. Use versioned migrations instead of running setup again.'; END IF; END $$;

-- 001_initial.sql
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


-- 002_security.sql
create table public.request_windows(owner_id uuid not null references auth.users on delete cascade,bucket timestamptz not null,calls integer not null default 1,primary key(owner_id,bucket));
alter table public.request_windows enable row level security;
create function public.check_rate_limit() returns void language plpgsql security definer set search_path=public as $$declare c integer;begin
 if auth.uid() is null then raise exception 'Unauthorized';end if;
 insert into request_windows values(auth.uid(),date_trunc('minute',now()),1) on conflict(owner_id,bucket) do update set calls=request_windows.calls+1 returning calls into c;
 if c>30 then raise exception 'Too many requests';end if;
end$$;
revoke all on function public.check_rate_limit() from public;
grant execute on function public.check_rate_limit() to authenticated;
-- Supabase Auth provides separate password-login rate limits.
create function public.log_lead_change() returns trigger language plpgsql security definer set search_path=public as $$begin
 insert into lead_activities(owner_id,lead_id,payload) values(new.owner_id,new.id,jsonb_build_object('action',TG_OP,'before',case when TG_OP='UPDATE' then to_jsonb(old) else null end,'after',to_jsonb(new)));
 return new;
end$$;
create trigger log_lead_change after insert or update on public.lead_records for each row execute function public.log_lead_change();
drop policy own on public.lead_activities;
create policy read_activities on public.lead_activities for select to authenticated using(owner_id=auth.uid());
create policy insert_activities on public.lead_activities for insert to authenticated with check(owner_id=auth.uid());


-- 003_ai_budget.sql
alter table public.app_settings add column ai_unit_cost numeric not null default 0 check(ai_unit_cost>=0);
create function public.reserve_ai_call() returns void language plpgsql security definer set search_path=public as $$
declare s public.app_settings; day_count integer; month_cost numeric;begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select * into s from app_settings where owner_id=auth.uid();
 if not found or not s.enabled then raise exception 'Provider usage disabled';end if;
 select count(*) into day_count from api_usage where owner_id=auth.uid() and created_at>=date_trunc('day',now());
 select coalesce(sum(estimated_cost),0) into month_cost from api_usage where owner_id=auth.uid() and created_at>=date_trunc('month',now());
 if day_count>=s.daily_calls or s.monthly_budget<=0 or s.ai_unit_cost<=0 or month_cost+s.ai_unit_cost>s.monthly_budget then raise exception 'Configured API usage limit reached';end if;
 insert into api_usage(owner_id,provider,sku,estimated_cost) values(auth.uid(),'anthropic','Messages reservation',s.ai_unit_cost);
end$$;
revoke all on function public.reserve_ai_call() from public;
grant execute on function public.reserve_ai_call() to authenticated;


-- 004_constraints.sql
create unique index lead_name_city_dedupe on public.lead_records(owner_id,lower(trim(business_name)),lower(trim(city)));
alter table public.app_settings add constraint valid_limits check(daily_calls>=0 and daily_searches>=0 and max_results between 1 and 20 and monthly_budget>=0 and google_unit_cost>=0);
create index on public.lead_sources(owner_id,lead_id);
create index on public.website_audits(owner_id,lead_id);
create index on public.lead_activities(owner_id,lead_id);
-- Persistent timestamps on child records, plus normalized provenance payload checks.
alter table public.lead_sources add constraint source_payload_object check(jsonb_typeof(payload)='object');


-- 005_global_daily_limit.sql
create or replace function public.reserve_google_call() returns void language plpgsql security definer set search_path=public as $$
declare s public.app_settings; day_count integer; searches integer; month_cost numeric;begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select * into s from app_settings where owner_id=auth.uid();
 if not found or not s.enabled then raise exception 'Discovery is disabled';end if;
 select count(*),count(*) filter(where provider='google') into day_count,searches from api_usage where owner_id=auth.uid() and created_at>=date_trunc('day',now());
 select coalesce(sum(estimated_cost),0) into month_cost from api_usage where owner_id=auth.uid() and created_at>=date_trunc('month',now());
 if day_count>=s.daily_calls or searches>=s.daily_searches or s.monthly_budget<=0 or s.google_unit_cost<=0 or month_cost+s.google_unit_cost>s.monthly_budget then raise exception 'Configured API usage limit reached';end if;
 insert into api_usage(owner_id,provider,sku,estimated_cost) values(auth.uid(),'google','Text Search Essentials IDs Only',s.google_unit_cost);
end$$;


-- 006_usage_summary.sql
create function public.usage_summary() returns jsonb language sql stable security invoker set search_path=public as $$
select jsonb_build_object(
 'today',count(*) filter(where created_at>=date_trunc('day',now())),
 'month',count(*) filter(where created_at>=date_trunc('month',now())),
 'cost',coalesce(sum(estimated_cost) filter(where created_at>=date_trunc('month',now())),0),
 'budget',coalesce((select monthly_budget from app_settings where owner_id=auth.uid()),0),
 'by_sku',coalesce((select jsonb_agg(t) from (select provider,sku,count(*) as requests from api_usage where owner_id=auth.uid() and created_at>=date_trunc('month',now()) group by provider,sku)t),'[]'::jsonb)
) from api_usage where owner_id=auth.uid();
$$;
revoke all on function public.usage_summary() from public;
grant execute on function public.usage_summary() to authenticated;

COMMIT;
-- Success: the database is installed. Create an internal Auth user next.