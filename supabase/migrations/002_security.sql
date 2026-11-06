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
