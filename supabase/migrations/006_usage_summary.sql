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
