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
